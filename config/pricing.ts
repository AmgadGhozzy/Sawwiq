// ---------------------------------------------------------------------------
// Pricing Configuration — Phase 6 Monetization
// Credit tiers with multi-currency support (SAR / EGP / USD).
// Currency is resolved per-request via lib/geo.ts (PPP-aware).
// ---------------------------------------------------------------------------

export type Currency = "SAR" | "EGP" | "USD";

export interface CreditPack {
  id: string;
  credits: number;
  /** Display label (used in UI) */
  label: string;
  prices: Record<Currency, number>;
}

export const CREDIT_PACKS: CreditPack[] = [
  {
    id: "starter",
    credits: 100,
    label: "Starter",
    prices: { SAR: 39, EGP: 199, USD: 10 },
  },
  {
    id: "growth",
    credits: 300,
    label: "Growth",
    prices: { SAR: 99, EGP: 499, USD: 25 },
  },
  {
    id: "pro",
    credits: 1000,
    label: "Pro",
    prices: { SAR: 249, EGP: 1299, USD: 65 },
  },
];

// Currency symbols for display
export const CURRENCY_SYMBOLS: Record<Currency, string> = {
  SAR: "ر.س",
  EGP: "ج.م",
  USD: "$",
};

/**
 * Returns the correct currency + packs for a given ISO-3166 country code.
 * Defaults to USD for unknown / null countries.
 */
export function getGeoPricing(countryCode: string | null): {
  currency: Currency;
  packs: CreditPack[];
} {
  let currency: Currency = "USD";

  if (countryCode === "EG") {
    currency = "EGP";
  } else if (
    countryCode === "SA" ||
    countryCode === "AE" ||
    countryCode === "KW" ||
    countryCode === "QA" ||
    countryCode === "BH" ||
    countryCode === "OM"
  ) {
    currency = "SAR";
  }

  return { currency, packs: CREDIT_PACKS };
}

/** Find a pack by its id — returns undefined if not found */
export function findPack(packId: string): CreditPack | undefined {
  return CREDIT_PACKS.find((p) => p.id === packId);
}
