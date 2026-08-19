// ---------------------------------------------------------------------------
// POST /api/waitlist — Lead capture endpoint
//
// Flow:
//  1. Validate email with Zod
//  2. Extract session_id from sawwiq_session cookie
//  3. Upsert email into waitlist table (idempotent — UNIQUE on email)
//  4. Bonus: +1 to max_limit on the session as a thank-you reward
// ---------------------------------------------------------------------------

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { sessionConfig } from "@/lib/config";

const waitlistSchema = z.object({
  email: z.string().email("WAITLIST_INVALID_EMAIL"),
});

type WaitlistResponse =
  | { success: true; bonus: boolean }
  | { success: false; error: { code: string } };

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
    return NextResponse.json({ success: false, error: { code: "VALIDATION_ERROR" } }, { status: 400 });
  }

  const parsed = waitlistSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: { code: parsed.error.issues[0]?.message ?? "WAITLIST_INVALID_EMAIL" } },
      { status: 400 }
    );
  }

  const { email } = parsed.data;
  const sessionToken = request.cookies.get(sessionConfig.cookieName)?.value;
  const supabase = getSupabaseAdmin();

  // ----- Resolve session (nullable — not blocking) -----
  let sessionId: string | null = null;
  let currentMaxLimit = 3;

  if (sessionToken) {
    const { data } = await supabase
      .from("sessions")
      .select("id, max_limit")
      .eq("session_token", sessionToken)
      .single();

    if (data) {
      sessionId = data.id;
      currentMaxLimit = data.max_limit;
    }
  }

  // ----- Upsert email — idempotent via UNIQUE(email) -----
  const { error: upsertError } = await supabase.from("waitlist").upsert(
    { email, session_id: sessionId },
    { onConflict: "email", ignoreDuplicates: true }
  );

  if (upsertError) {
    console.error("[Waitlist] Upsert error:", upsertError);
    return NextResponse.json(
      { success: false, error: { code: "WAITLIST_ERROR" } },
      { status: 500 }
    );
  }

  // ----- Bonus reward: +1 generation to their session -----
  let bonus = false;
  if (sessionId) {
    const { error: bonusError } = await supabase
      .from("sessions")
      .update({ max_limit: currentMaxLimit + 1 })
      .eq("id", sessionId);

    if (!bonusError) bonus = true;
  }

  return NextResponse.json({
    success: true,
    bonus,
  });
}
