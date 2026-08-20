// ---------------------------------------------------------------------------
// Central Configuration — single source of truth
// ---------------------------------------------------------------------------

/** Increment when prompt layers change. Tracked in benchmark results. */
export const PROMPT_VERSION = "1.0.0";

/** Increment when evaluation dataset changes. Tracked in benchmark results. */
export const DATASET_VERSION = "1.0.0";

export const aiConfig = {
  provider: "gemini" as const,
  model: process.env.GEMINI_MODEL ?? "gemini-2.5-flash-lite",
  maxInputLength: 2000,
  generationTimeoutMs: 30_000,
};

export const sessionConfig = {
  cookieName: "sawwiq_session",
  freeGenerations: 3,
};

export const waitlistConfig = {
  /** Max value for session.max_limit (original 3 + max bonus). Must match RPC constant. */
  maxBonusCap: 5,
  /** Max bonus-granting registrations per IP within the window. Must match RPC constant. */
  ipBonusLimit: 3,
  /** Time window in hours for IP-based bonus rate limiting. Must match RPC constant. */
  ipBonusWindowHours: 24,
};


export const appConfig = {
  productName: "سَوِّق",
  productTagline: "أداتك الذكية لإنشاء محتوى تسويقي في ثوانٍ.",
};
