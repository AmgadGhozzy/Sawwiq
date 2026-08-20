// ---------------------------------------------------------------------------
// Client IP Extraction Utility
//
// Returns the most trusted client IP from request headers, or null if
// unavailable. Using null (not "unknown") prevents poisoning IP-based
// rate limiting — when IP is null, IP checks are skipped entirely.
//
// Priority:
//   1. x-real-ip    — set by Vercel/Cloudflare edge (trusted)
//   2. x-forwarded-for — first IP only (may be spoofed behind some proxies)
//   3. null          — IP unavailable, skip IP-based checks
//
// WARNING: In non-Vercel deployments, review which headers your reverse
// proxy sets and adjust the priority accordingly.
// ---------------------------------------------------------------------------

import { NextRequest } from "next/server";

export function getClientIp(request: NextRequest): string | null {
  // Vercel / Cloudflare set this from the actual connection IP
  const realIp = request.headers.get("x-real-ip")?.trim();
  if (realIp) return realIp;

  // Fallback: first entry in x-forwarded-for chain
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }

  return null;
}
