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

/** @deprecated — Supabase session-based rate limiting is now the default.
 * The memory limiter is kept as a local-dev fallback when Supabase is not configured. */
export const rateLimitConfig = {
  mode: (process.env.RATE_LIMITER ?? "memory") as "memory" | "external",
  windowMs: 60_000,
  maxRequests: 10,
};

export const appConfig = {
  productName: "سَوِّق",
  productTagline: "منصة الذكاء الاصطناعي الأقوى لصياغة المحتوى التسويقي في ثوانٍ.",
};
