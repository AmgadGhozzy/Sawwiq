// ---------------------------------------------------------------------------
// Pipeline B Error Boundary
//
// Two-stage translation: unknown Edge Function response → canonical ERROR_CODES.
//
//   Pipeline B response (unknown shape)
//       ↓
//   extractPipelineBErrorCode()   →  string | null
//       ↓
//   normalizePipelineBError()     →  ERROR_CODES value
//       ↓
//   UI (only sees canonical codes)
//
// Invariant: The UI can receive ONLY canonical user-facing ERROR_CODES.
// ---------------------------------------------------------------------------

import { ERROR_CODES } from "@/types/content";

// ---------------------------------------------------------------------------
// Stage 1: Extract — unknown → string | null
//
// The Edge Function returns error responses in two shapes:
//   Flat:   { error: "IR_SCHEMA_VIOLATION" }
//   Object: { error: { code: "RENDERER_LENGTH_VIOLATION", message: "..." } }
//
// This function handles both without any `as any` casts.
// ---------------------------------------------------------------------------
export function extractPipelineBErrorCode(
  responseData: Record<string, unknown> | null | undefined
): string | null {
  if (!responseData) return null;

  const errorField = responseData.error;

  // Shape 1: flat string  — { error: "SOME_CODE" }
  if (typeof errorField === "string") {
    return errorField;
  }

  // Shape 2: object with code — { error: { code: "SOME_CODE" } }
  if (
    typeof errorField === "object" &&
    errorField !== null &&
    "code" in errorField &&
    typeof (errorField as Record<string, unknown>).code === "string"
  ) {
    return (errorField as Record<string, unknown>).code as string;
  }

  // Unknown shape — caller should fall back to GENERATION_FAILED
  return null;
}

// ---------------------------------------------------------------------------
// Stage 2: Normalize — string → canonical ERROR_CODES
//
// Maps internal Pipeline B error codes to the public UI contract.
// Every internal code resolves to exactly one user-facing code.
// Unknown codes fall through to GENERATION_FAILED as last-resort defense.
// ---------------------------------------------------------------------------

const PIPELINE_B_ERROR_MAP: Record<string, string> = {
  // ── Hard IR failures → GENERATION_FAILED ─────────────────────────────
  "IR_SCHEMA_VIOLATION": ERROR_CODES.GENERATION_FAILED,
  "PLANNER_IR_VERSION_MISMATCH": ERROR_CODES.GENERATION_FAILED,
  "PLANNER_PERSONA_MISMATCH": ERROR_CODES.GENERATION_FAILED,

  // ── Soft failures exhausted → GENERATION_FAILED ──────────────────────
  "IR_VALIDATION_FAILED_AFTER_RETRY": ERROR_CODES.GENERATION_FAILED,
  "IR_RETRY_PLANNER_FAILED": ERROR_CODES.GENERATION_FAILED,

  // ── Renderer failures ────────────────────────────────────────────────
  // RENDERER_LENGTH_VIOLATION: content was rendered but exceeded platform
  // length limits after retry. This is a final output quality issue.
  "RENDERER_LENGTH_VIOLATION": ERROR_CODES.GENERATION_FAILED,
  // VALIDATION_ERROR from renderer: the rendered content failed quality
  // checks (missing fields, hallucinated claims, cliché density, etc.).
  // This maps to OUTPUT_VALIDATION_FAILED because it IS about the final
  // rendered output quality — not an internal IR/planner issue.
  "VALIDATION_ERROR": ERROR_CODES.OUTPUT_VALIDATION_FAILED,

  // ── Planner/Compiler parse failures (human-readable strings) ─────────
  "Planner LLM Output Validation Failed": ERROR_CODES.GENERATION_FAILED,
  "Renderer LLM Output Validation Failed": ERROR_CODES.GENERATION_FAILED,
  "IR Compiler Validation Failed": ERROR_CODES.GENERATION_FAILED,

  // ── Infrastructure ───────────────────────────────────────────────────
  "Pipeline B is currently disabled": ERROR_CODES.INTERNAL_ERROR,
  "SERVICE_UNAVAILABLE": ERROR_CODES.INTERNAL_ERROR,
  "Internal Server Error": ERROR_CODES.INTERNAL_ERROR,
  "Internal Database Error": ERROR_CODES.PERSISTENCE_FAILED,
  "PERSISTENCE_FAILED": ERROR_CODES.PERSISTENCE_FAILED,
  "DUPLICATE_REQUEST": ERROR_CODES.GENERATION_FAILED,

  // ── Pass-through (already canonical) ─────────────────────────────────
  "RATE_LIMIT_REACHED": ERROR_CODES.RATE_LIMIT_REACHED,
  "GENERATION_FAILED": ERROR_CODES.GENERATION_FAILED,
};

export function normalizePipelineBError(rawCode: string): string {
  return PIPELINE_B_ERROR_MAP[rawCode] ?? ERROR_CODES.GENERATION_FAILED;
}
