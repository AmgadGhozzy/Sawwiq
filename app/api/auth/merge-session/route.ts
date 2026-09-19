import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { sessionConfig } from "@/lib/config";
import { getTracker } from "@/lib/analytics/tracker";

// ---------------------------------------------------------------------------
// Shared merge logic — called by both:
//   POST /api/auth/merge-session   (login path)
//   GET  /api/auth/callback        (signup email-verification path)
// ---------------------------------------------------------------------------
export async function mergeSessionAndAwardBonus(userId: string, sessionToken: string | null) {
  const supabase = getSupabaseAdmin();
  const tracker = getTracker();
  const signupBonus = Number(process.env.SIGNUP_BONUS_CREDITS ?? "0");

  // ── 1. Session ownership claim (atomic via DB transaction) ─────────────────
  // claim_and_merge_session uses SELECT … FOR UPDATE inside a single PG
  // transaction so that concurrent callers are serialised at the DB level.
  // No two UPDATE statements that can race — one RPC call, one winner.
  if (sessionToken) {
    const { data: claimData, error: claimErr } = await supabase.rpc(
      "claim_and_merge_session",
      { p_user_id: userId, p_session_token: sessionToken }
    );

    if (claimErr) {
      console.error("[merge-session] claim_and_merge_session RPC error:", claimErr);
      return { success: false as const, error: "SESSION_MERGE_FAILED", status: 500 };
    }

    const claim = claimData as unknown as {
      success: boolean;
      merged?: boolean;
      reason?: string;
      error?: string;
    };

    if (!claim.success) {
      // SESSION_ALREADY_LINKED: this session belongs to a different user
      return { success: false as const, error: claim.error ?? "SESSION_MERGE_FAILED", status: 409 };
    }
    // claim.success = true covers: merged=true, ALREADY_OWNED, SESSION_NOT_FOUND — all idempotent OK
  }

  // ── 2. Award signup bonus (idempotent) ────────────────────────────────────
  // If bonus is 0 (or negative), skip the RPC — award_credits rejects
  // p_amount <= 0 with INVALID_AMOUNT which would cause a false failure.
  if (signupBonus <= 0) {
    const { data: balData } = await supabase.rpc("get_credit_balance", {
      p_user_id: userId,
    });
    const bal = balData as unknown as { balance: number } | null;
    return { success: true as const, balance: bal?.balance ?? 0 };
  }

  const idempotencyKey = `signup_bonus:${userId}`;
  const { data: creditRes, error: creditErr } = await supabase.rpc("award_credits", {
    p_user_id: userId,
    p_amount: signupBonus,
    p_reason: "signup_bonus",
    p_idempotency_key: idempotencyKey,
  });

  if (creditErr) {
    console.error("[merge-session] Failed to award credits:", creditErr);
    return { success: false as const, error: "CREDIT_AWARD_FAILED", status: 500 };
  }

  const creditData = creditRes as unknown as {
    success: boolean;
    duplicate: boolean;
    balance: number;
    error?: string;
  };

  // Track only on first-time award (not duplicate idempotent calls)
  if (creditData?.success && !creditData.duplicate) {
    tracker.track("credit_bonus_received", { amount: signupBonus, reason: "signup_bonus" });
  }

  return { success: true as const, balance: creditData?.balance ?? 0 };
}

// ---------------------------------------------------------------------------
// POST /api/auth/merge-session  — used by AuthModal on login
// ---------------------------------------------------------------------------
export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json({ success: false, error: "Missing token" }, { status: 401 });
    }
    const token = authHeader.split(" ")[1];

    const supabase = getSupabaseAdmin();
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);

    if (userError || !user) {
      return NextResponse.json({ success: false, error: "Invalid token" }, { status: 401 });
    }

    // Check email_confirmed_at for extra safety (login should have confirmed email)
    if (!user.email_confirmed_at) {
      return NextResponse.json({ success: false, error: "EMAIL_NOT_VERIFIED" }, { status: 403 });
    }

    const sessionToken = request.cookies.get(sessionConfig.cookieName)?.value ?? null;
    const result = await mergeSessionAndAwardBonus(user.id, sessionToken);

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: result.status }
      );
    }

    return NextResponse.json({ success: true, balance: result.balance });

  } catch (error) {
    console.error("[merge-session] Unexpected error:", error);
    return NextResponse.json({ success: false, error: "Internal Server Error" }, { status: 500 });
  }
}
