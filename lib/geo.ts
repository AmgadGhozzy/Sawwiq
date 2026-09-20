// ---------------------------------------------------------------------------
// Geo Detection — lib/geo.ts
// Extracts the visitor's country from standard CDN / Vercel request headers.
// Falls back gracefully to null when headers are absent (local dev, tests).
// ---------------------------------------------------------------------------

import type { ReadonlyHeaders } from "next/dist/server/web/spec-extension/adapters/headers";

/**
 * Extract the ISO-3166-1 alpha-2 country code from request headers.
 *
 * Priority:
 *   1. `x-vercel-ip-country`  — injected by Vercel Edge Network
 *   2. `cf-ipcountry`         — injected by Cloudflare
 *
 * Returns null when running locally without a CDN (dev mode).
 */
export function getCountryFromHeaders(
  headers: ReadonlyHeaders | Headers
): string | null {
  const country =
    headers.get("x-vercel-ip-country") ?? headers.get("cf-ipcountry");

  if (!country || country === "XX" || country === "T1") {
    // XX = unknown, T1 = Tor exit node
    return null;
  }

  return country.toUpperCase();
}
