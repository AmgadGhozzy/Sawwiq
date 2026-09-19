import createMiddleware from "next-intl/middleware";
import { routing } from "./i18n/routing";
import { NextResponse, type NextRequest } from "next/server";

const intlMiddleware = createMiddleware(routing);

export default function middleware(request: NextRequest) {
  const SESSION_COOKIE_NAME = "sawwiq_session";
  const isApiRoute = request.nextUrl.pathname.startsWith("/api/");

  const existingSession = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  const newSessionId = existingSession ? null : crypto.randomUUID();
  const effectiveSession = existingSession ?? newSessionId!;

  // For API routes: forward the new session ID as a request header so the
  // route handler can use it on the very first call (before the browser has
  // stored the cookie that we'll set on this same response).
  if (isApiRoute) {
    const requestHeaders = new Headers(request.headers);
    if (newSessionId) {
      requestHeaders.set("x-new-session-id", newSessionId);
    }

    const response = NextResponse.next({ request: { headers: requestHeaders } });

    if (newSessionId) {
      response.cookies.set(SESSION_COOKIE_NAME, effectiveSession, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        maxAge: 60 * 60 * 24 * 365, // 1 year
      });
    }

    return response;
  }

  // For page routes: let next-intl handle routing (redirects, rewrites, etc.)
  // then attach the session cookie to whatever response it returns so the
  // browser stores it before the user ever submits a form.
  const intlResponse = intlMiddleware(request);

  if (newSessionId) {
    intlResponse.cookies.set(SESSION_COOKIE_NAME, effectiveSession, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 365, // 1 year
    });
  }

  return intlResponse;
}

export const config = {
  // Match API routes and internationalized pathnames
  matcher: ["/api/:path*", "/", "/(ar|en)/:path*"],
};
