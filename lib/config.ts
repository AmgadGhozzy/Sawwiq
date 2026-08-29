// ---------------------------------------------------------------------------
// Central Configuration — single source of truth
// ---------------------------------------------------------------------------

/** Increment when prompt layers change. Tracked in benchmark results. */
export const PROMPT_VERSION = "1.1.0";

/** Increment when evaluation dataset changes. Tracked in benchmark results. */
export const DATASET_VERSION = "1.1.0";

/** Maximum permitted prompt growth versus the reviewed prompt budget snapshot. */
export const PROMPT_MAX_GROWTH_PERCENT = 10;

/** An experiment label changes per candidate; PROMPT_VERSION changes only on acceptance. */
export const PROMPT_EXPERIMENT_ID = process.env.PROMPT_EXPERIMENT_ID ?? "baseline";

export const aiConfig = {
  provider: "gemini" as const,
  model: process.env.GEMINI_MODEL ?? "gemini-2.5-flash-lite",
  maxInputLength: 2000,
  generationTimeoutMs: 30_000,
  temperature: 0.7,
  topP: 0.9,
};

export const sessionConfig = {
  cookieName: "sawwiq_session",
  freeGenerations: 3,
};
