// ---------------------------------------------------------------------------
// middleware.ts — The Gatekeeper
//
// Runs on every request before the page/API route.
// Ensures every visitor has a persistent anonymous session cookie.
// If cookie is missing → generates UUID → writes new session row to Supabase
// → sets the HttpOnly cookie → lets the request through.
//
// Cookie spec: sawwiq_session | HttpOnly | SameSite=Lax | 1-year max age
// ---------------------------------------------------------------------------

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";

const SESSION_COOKIE = "sawwiq_session";
const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;

export async function middleware(request: NextRequest) {
  const response = NextResponse.next();

  // Skip if Supabase is not yet configured (dev without keys)
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    return response;
  }

  const existingToken = request.cookies.get(SESSION_COOKIE)?.value;

  // Session already exists — just let the request through
  if (existingToken) return response;

  // No session → create one
  const newToken = crypto.randomUUID();

  try {
    const supabase = createClient<Database>(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false },
    });

    await supabase.from("sessions").insert({
      session_token: newToken,
      generations_count: 0,
      max_limit: 3,
    });
  } catch (err) {
    console.error("[Middleware] Failed to create session:", err);
    // Non-fatal: the session will be created on the first API call
  }

  // Set cookie on the outgoing response
  response.cookies.set(SESSION_COOKIE, newToken, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: ONE_YEAR_SECONDS,
    path: "/",
  });

  return response;
}

export const config = {
  // Apply to all pages & API routes — skip static assets
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
