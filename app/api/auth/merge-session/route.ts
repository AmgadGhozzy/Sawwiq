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

  // ── 1. Session ownership check ─────────────────────────────────────────────
  if (sessionToken) {
    const { data: session } = await supabase
      .from("sessions")
      .select("id, user_id")
      .eq("session_token", sessionToken)
      .single();

    if (session) {
      // Reject if the session is already owned by a DIFFERENT user.
      if (session.user_id && session.user_id !== userId) {
        return { success: false as const, error: "SESSION_ALREADY_LINKED", status: 409 };
      }

      if (!session.user_id) {
        // Atomically claim the session
        await supabase
          .from("sessions")
          .update({ user_id: userId })
          .eq("id", session.id)
          .is("user_id", null); // WHERE user_id IS NULL (prevents race)

        // Move all anonymous generations to this user
        await supabase
          .from("generations")
          .update({ user_id: userId })
          .eq("session_id", session.id)
          .is("user_id", null);
      }
    }
  }

  // ── 2. Award signup bonus (idempotent) ────────────────────────────────────
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

  if (creditData?.success && !creditData.duplicate && signupBonus > 0) {
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
