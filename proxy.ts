import createMiddleware from "next-intl/middleware";
import { routing } from "./i18n/routing";
import { NextResponse, type NextRequest } from "next/server";

const intlMiddleware = createMiddleware(routing);

export default function middleware(request: NextRequest) {
  // 1. Determine if this is an API route
  const isApiRoute = request.nextUrl.pathname.startsWith("/api/");

  // 2. Get initial response (NextResponse.next() for API, intlMiddleware for UI)
  const response = isApiRoute ? NextResponse.next() : intlMiddleware(request);

  // 3. Session Cookie Logic
  const SESSION_COOKIE_NAME = "sawwiq_session";
  const hasSession = request.cookies.has(SESSION_COOKIE_NAME);

  if (!hasSession) {
    const sessionId = crypto.randomUUID();
    
    response.cookies.set(SESSION_COOKIE_NAME, sessionId, {
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 365, // 1 year
    });
  }

  return response;
}

export const config = {
  // Match API routes and internationalized pathnames
  matcher: ["/api/:path*", "/", "/(ar|en)/:path*"],
};
