import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { sessionConfig } from "@/lib/config";
import { getTracker } from "@/lib/analytics/tracker";
import { mergeSessionAndAwardBonus } from "@/app/api/auth/merge-session/route";

// ---------------------------------------------------------------------------
// GET /api/auth/callback?code=...&returnTo=/ar
//
// Called by Supabase after user clicks the email confirmation link.
// PKCE flow: exchanges the code for a session server-side, sets auth cookies
// on the response so the browser is properly authenticated, then runs the
// anonymous-session merge + credit award automatically.
//
// Failure modes handled:
//   - missing/expired code → redirect to /?auth_error=invalid_code
//   - email not confirmed  → redirect to /?auth_error=email_not_verified
//   - session merge conflict → user is still authenticated; log server-side
//   - credit award fails   → user is still authenticated; log server-side
// ---------------------------------------------------------------------------

const SAFE_RETURN_REGEX = /^\/[^/]/; // must start with / and not be //

function safeReturnTo(raw: string | null, defaultPath: string): string {
  if (!raw) return defaultPath;
  const decoded = decodeURIComponent(raw);
  return SAFE_RETURN_REGEX.test(decoded) ? decoded : defaultPath;
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const token_hash = searchParams.get("token_hash");
  const type = searchParams.get("type");
  const returnTo = safeReturnTo(searchParams.get("returnTo"), "/");
  const tracker = getTracker();

  if (!code && (!token_hash || !type)) {
    console.warn("[auth/callback] Missing code or token_hash parameter");
    return NextResponse.redirect(new URL(`/?auth_error=invalid_code`, request.url));
  }

  // Build the redirect response early so we can attach auth cookies to it.
  // The @supabase/ssr client writes session cookies directly onto this response
  // object, ensuring the browser receives valid auth cookies after the redirect.
  const redirectResponse = NextResponse.redirect(new URL(returnTo, request.url));

  try {
    // Use a cookie-aware Supabase client so exchangeCodeForSession writes the
    // session cookies onto redirectResponse instead of discarding them.
    const supabaseForExchange = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll: () => request.cookies.getAll(),
          setAll: (cookiesToSet) => {
            cookiesToSet.forEach(({ name, value, options }) => {
              redirectResponse.cookies.set(name, value, options);
            });
          },
        },
      }
    );

    // Exchange the PKCE code or Token Hash for a session — cookies written to redirectResponse
    let session = null;
    let sessionError = null;

    if (code) {
      const { data, error } = await supabaseForExchange.auth.exchangeCodeForSession(code);
      session = data?.session;
      sessionError = error;
    } else if (token_hash && type) {
      const { data, error } = await supabaseForExchange.auth.verifyOtp({
        token_hash,
        type: type as any,
      });
      session = data?.session;
      sessionError = error;
    }

    if (sessionError || !session?.user) {
      console.error("[auth/callback] Auth exchange failed:", sessionError?.message);
      return NextResponse.redirect(new URL(`/?auth_error=invalid_code`, request.url));
    }

    const user = session.user;

    // Verify email was actually confirmed
    if (!user.email_confirmed_at) {
      console.warn("[auth/callback] User email not confirmed:", user.id);
      return NextResponse.redirect(new URL(`/?auth_error=email_not_verified`, request.url));
    }

    // Track confirmation event (no PII in properties)
    tracker.track("email_verification_completed", { userId: user.id });

    // Merge anonymous session + award bonus
    const sessionToken = request.cookies.get(sessionConfig.cookieName)?.value ?? null;
    const mergeResult = await mergeSessionAndAwardBonus(user.id, sessionToken);

    if (!mergeResult.success) {
      // Bonus failure is recoverable — the user is already authenticated.
      console.error("[auth/callback] Merge failed for user:", user.id, "reason:", mergeResult.error);
    }

    return redirectResponse;

  } catch (error) {
    console.error("[auth/callback] Unexpected error:", error);
    return NextResponse.redirect(new URL(`/?auth_error=server_error`, request.url));
  }
}
