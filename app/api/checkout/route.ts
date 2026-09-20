// ---------------------------------------------------------------------------
// Checkout API Route — app/api/checkout/route.ts
// Phase 6: Tap Payments integration with transparent Mock fallback.
//
// Mock Mode activates when TAP_SECRET_KEY is absent or equals "mock".
// When the real key is present (sk_test_* / sk_live_*) the route calls
// the live Tap Charges API and returns the hosted-payment redirect URL.
//
// Environment variables:
//   TAP_SECRET_KEY  — Tap secret key (sk_test_* or sk_live_*).
//                     Leave unset or set to "mock" for Mock Mode.
// ---------------------------------------------------------------------------

import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { getCountryFromHeaders } from "@/lib/geo";
import { findPack, getGeoPricing } from "@/config/pricing";

// ── Types ───────────────────────────────────────────────────────────────────

interface CheckoutSuccessResponse {
  checkoutUrl: string;
}

interface CheckoutErrorResponse {
  error: string;
}

// Subset of Tap Charges API response we care about
interface TapChargeResponse {
  id: string;
  transaction: {
    url: string;
  };
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function isMockMode(key: string | undefined): boolean {
  return !key || key === "mock";
}

// ── Route Handler ─────────────────────────────────────────────────────────────

export async function POST(
  req: NextRequest
): Promise<NextResponse<CheckoutSuccessResponse | CheckoutErrorResponse>> {
  // ── 1. Auth — must be a logged-in user ────────────────────────────────────
  const authHeader = req.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }

  const token = authHeader.split(" ")[1];
  const supabase = getSupabaseAdmin();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser(token);

  if (userError || !user) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }

  // ── 2. Parse & validate body ──────────────────────────────────────────────
  let packId: string;
  try {
    const body = (await req.json()) as { packId?: unknown };
    if (typeof body.packId !== "string" || !body.packId) {
      return NextResponse.json({ error: "INVALID_PACK" }, { status: 400 });
    }
    packId = body.packId;
  } catch {
    return NextResponse.json({ error: "INVALID_BODY" }, { status: 400 });
  }

  const pack = findPack(packId);
  if (!pack) {
    return NextResponse.json({ error: "INVALID_PACK" }, { status: 400 });
  }

  // ── 3. Resolve currency via geo ───────────────────────────────────────────
  const reqHeaders = await headers();
  const countryCode = getCountryFromHeaders(reqHeaders);
  const { currency } = getGeoPricing(countryCode);
  const amount = pack.prices[currency];

  // ── 4. Origin for redirect / webhook URLs ─────────────────────────────────
  const origin =
    process.env.NEXT_PUBLIC_APP_URL ??
    (req.headers.get("origin") || "http://localhost:3000");

  // ── 5. Mock Mode ──────────────────────────────────────────────────────────
  const tapKey = process.env.TAP_SECRET_KEY;

  if (isMockMode(tapKey)) {
    console.warn(
      `[MOCK CHECKOUT]: Simulating Tap checkout for user: ${user.id} | pack: ${packId} | ${amount} ${currency}`
    );
    const mockUrl = `${origin}/ar?payment=mock_success&packId=${packId}`;
    return NextResponse.json({ checkoutUrl: mockUrl });
  }

  // ── 6. Live Tap Charges API ───────────────────────────────────────────────
  try {
    const tapRes = await fetch("https://api.tap.company/v2/charges", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${tapKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        amount,
        currency,
        customer: {
          email: user.email ?? "",
        },
        source: { id: "src_all" },
        redirect: { url: `${origin}/ar?payment=success` },
        post: { url: `${origin}/api/webhooks/tap` },
        metadata: {
          user_id: user.id,
          credits: pack.credits,
          pack_id: packId,
        },
      }),
    });

    if (!tapRes.ok) {
      const tapErr = await tapRes.text();
      console.error("[CHECKOUT] Tap API error:", tapRes.status, tapErr);
      return NextResponse.json(
        { error: "PAYMENT_PROVIDER_ERROR" },
        { status: 502 }
      );
    }

    const tapData = (await tapRes.json()) as TapChargeResponse;
    const checkoutUrl = tapData.transaction?.url;

    if (!checkoutUrl) {
      console.error("[CHECKOUT] Tap response missing transaction.url", tapData);
      return NextResponse.json(
        { error: "PAYMENT_PROVIDER_ERROR" },
        { status: 502 }
      );
    }

    return NextResponse.json({ checkoutUrl });
  } catch (err) {
    console.error("[CHECKOUT] Network error calling Tap API:", err);
    return NextResponse.json(
      { error: "PAYMENT_PROVIDER_ERROR" },
      { status: 502 }
    );
  }
}
