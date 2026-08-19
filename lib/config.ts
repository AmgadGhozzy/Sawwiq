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

export const appConfig = {
  productName: "سَوِّق",
  productTagline: "أداتك الذكية لإنشاء محتوى تسويقي في ثوانٍ.",
};
