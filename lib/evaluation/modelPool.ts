// ─── Shared Model Rotation Pool ───────────────────────────────────────────────
// A global round-robin pool for cheap models that support structured JSON output.
// All evaluators and the runner import and use nextEvalModel() so that 429s on
// one model are naturally absorbed by cycling to the next instead of sleeping.
//
// NOTE: Keep all models here roughly equivalent in capability for the eval tasks.
// Do NOT add production-only models (flash, pro) to the eval pool; keep them
// fast and cheap. The generation step may use a different pool if needed.

const EVAL_MODEL_POOL = [
  "gemini-2.5-flash-lite",
  "gemini-3.1-flash-lite",
];

let evalModelIndex = 0;

export function nextEvalModel(): string {
  const model = EVAL_MODEL_POOL[evalModelIndex % EVAL_MODEL_POOL.length];
  evalModelIndex++;
  return model;
}

// Default eval model — used when rotation is not needed (single call).
export const DEFAULT_EVAL_MODEL = EVAL_MODEL_POOL[0];
