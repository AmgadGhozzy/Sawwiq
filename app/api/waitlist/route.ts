// ---------------------------------------------------------------------------
// POST /api/waitlist — Lead capture with anti-abuse bonus protection
//
// Flow:
//  1. Validate email + optional fingerprint (Zod)
//  2. HMAC-SHA256 the fingerprint with ANTI_ABUSE_SECRET
//  3. Extract trusted client IP
//  4. Resolve session_id from cookie
//  5. Call register_waitlist RPC (atomic — handles all checks + bonus)
//
// Design: Registration is always allowed. Bonus is conditional on:
//   - Fingerprint not previously seen (risk signal)
//   - IP not exceeding bonus rate limit (temporal throttle)
//   - Session max_limit below cap (damage limiter)
//
// Anti-abuse constants are hardcoded in the RPC — not sent from here.
// ---------------------------------------------------------------------------

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createHmac } from "crypto";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { sessionConfig } from "@/lib/config";
import { getClientIp } from "@/lib/utils/client-ip";

const waitlistSchema = z.object({
  email: z.string().email("WAITLIST_INVALID_EMAIL"),
  fingerprint: z.string().min(1).max(128).optional(),
});

type WaitlistResponse =
  | { success: true; bonus: boolean }
  | { success: false; error: { code: string } };

/**
 * HMAC-SHA256 the raw fingerprint with a server secret.
 * 
 * SECURITY NOTE: The fingerprint is a risk signal, not an identity.
 * It may change naturally or be shared across users on the same network/device.
 * It is used here exclusively for waitlist bonus throttling.
 *
 * Returns null if fingerprint or secret is unavailable.
 */
function hashFingerprint(fingerprint: string | undefined): string | null {
  if (!fingerprint) return null;

  const secret = process.env.ANTI_ABUSE_SECRET;
  if (!secret) {
    console.warn("[Waitlist] ANTI_ABUSE_SECRET not set — fingerprint check disabled");
    return null;
  }

  return createHmac("sha256", secret).update(fingerprint).digest("hex");
}

export async function POST(
  request: NextRequest
): Promise<NextResponse<WaitlistResponse>> {
  // ----- Supabase required -----
  if (
    !process.env.NEXT_PUBLIC_SUPABASE_URL ||
    !process.env.SUPABASE_SERVICE_ROLE_KEY
  ) {
    return NextResponse.json(
      { success: false, error: { code: "SERVICE_UNAVAILABLE" } },
      { status: 503 }
    );
  }

  // ----- Parse body -----
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { success: false, error: { code: "VALIDATION_ERROR" } },
      { status: 400 }
    );
  }

  const parsed = waitlistSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: { code: "WAITLIST_INVALID_EMAIL" } },
      { status: 400 }
    );
  }

  const { email, fingerprint } = parsed.data;

  // ----- Derive anti-abuse signals -----
  const fingerprintHash = hashFingerprint(fingerprint);
  const clientIp = getClientIp(request);

  // ----- Resolve session -----
  const sessionToken = request.cookies.get(sessionConfig.cookieName)?.value;
  const supabase = getSupabaseAdmin();

  let sessionId: string | null = null;

  if (sessionToken) {
    const { data } = await supabase
      .from("sessions")
      .select("id")
      .eq("session_token", sessionToken)
      .single();

    if (data) sessionId = data.id;
  }

  // ----- Call atomic RPC -----
  const { data: result, error: rpcError } = await supabase.rpc(
    "register_waitlist",
    {
      p_email: email,
      p_session_id: sessionId,
      p_fingerprint_hash: fingerprintHash,
      p_client_ip: clientIp,
    }
  );

  if (rpcError) {
    console.error("[Waitlist] RPC error:", rpcError);
    return NextResponse.json(
      { success: false, error: { code: "WAITLIST_ERROR" } },
      { status: 500 }
    );
  }

  const rpcResult = result as {
    registered: boolean;
    bonus: boolean;
    reason: string | null;
  };

  // ----- Observability -----
  // Log the decision securely without PII (email, raw fingerprint, or IP)
  console.info(JSON.stringify({
    event: "waitlist_registration",
    bonus_granted: rpcResult.bonus,
    bonus_reason: rpcResult.reason,
    session_exists: !!sessionId,
    timestamp: new Date().toISOString()
  }));

  // Email already exists — not an error, just no bonus
  if (!rpcResult.registered) {
    return NextResponse.json({ success: true, bonus: false });
  }

  return NextResponse.json({
    success: true,
    bonus: rpcResult.bonus,
  });
}
