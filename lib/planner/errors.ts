// ---------------------------------------------------------------------------
// Pipeline B — Planner Error Contract
//
// Design principles:
//   1. Hard separation: user-facing vs internal errors.
//   2. No API keys, no stack traces, no model internals in userMessage.
//   3. Namespace prefix "PLANNER_" prevents collision with ERROR_CODES
//      in types/content.ts — we do NOT modify that registry.
//   4. diagnostic is server-side only and must never reach the client.
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Error Code Registry
// ---------------------------------------------------------------------------

export const PLANNER_ERROR_CODES = {
  // ── Request validation ───────────────────────────────────────────────────
  /** The request body failed schema validation. */
  INVALID_REQUEST: "PLANNER_INVALID_REQUEST",
  /** The persona id is not registered in TOPOLOGY_REQUIRED. */
  INVALID_PERSONA: "PLANNER_INVALID_PERSONA",
  /** The platform is not in PLATFORMS_V2. */
  UNSUPPORTED_PLATFORM: "PLANNER_UNSUPPORTED_PLATFORM",
  /** topic is too short (< 10 chars after trim). */
  TOPIC_TOO_SHORT: "PLANNER_TOPIC_TOO_SHORT",
  /** topic exceeds max length (> 500 chars). */
  TOPIC_TOO_LONG: "PLANNER_TOPIC_TOO_LONG",
  /** customInstructions exceeds max length (> 300 chars). */
  INSTRUCTIONS_TOO_LONG: "PLANNER_INSTRUCTIONS_TOO_LONG",
  /** forbiddenTerms or requiredTerms list exceeds max count (> 10). */
  TERMS_LIMIT_EXCEEDED: "PLANNER_TERMS_LIMIT_EXCEEDED",

  // ── IR validation ────────────────────────────────────────────────────────
  /** The IR object does not conform to the IRGraph schema. */
  INVALID_IR: "PLANNER_INVALID_IR",
  /** One or more required topology nodes are absent from the IR. */
  MISSING_NODES: "PLANNER_MISSING_NODES",
  /** The IR contains a node not in TOPOLOGY_REQUIRED[persona].nodes. */
  FORBIDDEN_NODE: "PLANNER_FORBIDDEN_NODE",
  /** The IR contains edges that diverge from the required topology. */
  TOPOLOGY_VIOLATION: "PLANNER_TOPOLOGY_VIOLATION",
  /** One or more node content strings are empty or whitespace-only. */
  EMPTY_NODE_CONTENT: "PLANNER_EMPTY_NODE_CONTENT",
  /** Duplicate node ids detected in the IR. */
  DUPLICATE_NODES: "PLANNER_DUPLICATE_NODES",
  /** Duplicate edges (same from+to) detected in the IR. */
  DUPLICATE_EDGES: "PLANNER_DUPLICATE_EDGES",
  /** IR personaId does not match the request persona. */
  PERSONA_MISMATCH: "PLANNER_PERSONA_MISMATCH",
  /** IR version string is absent or does not match the expected schema version. */
  IR_VERSION_MISMATCH: "PLANNER_IR_VERSION_MISMATCH",
  /** A node confidence value is outside the [0, 1] range. */
  INVALID_CONFIDENCE: "PLANNER_INVALID_CONFIDENCE",

  // ── Execution ────────────────────────────────────────────────────────────
  /** The planner LLM call failed or returned an unusable result. */
  PLANNER_FAILURE: "PLANNER_FAILURE",
  /** The renderer LLM call failed. */
  RENDER_FAILURE: "PLANNER_RENDER_FAILURE",
  /** The total pipeline exceeded the latency budget. */
  TIMEOUT: "PLANNER_TIMEOUT",
  /** Unexpected internal error. */
  INTERNAL_ERROR: "PLANNER_INTERNAL_ERROR",
} as const;

export type PlannerErrorCode =
  (typeof PLANNER_ERROR_CODES)[keyof typeof PLANNER_ERROR_CODES];

// ---------------------------------------------------------------------------
// Error Shapes
// ---------------------------------------------------------------------------

/**
 * Internal diagnostic payload — logged server-side only.
 * MUST NOT be serialized into any client response.
 */
export interface PlannerErrorDiagnostic {
  field?: string;
  expected?: unknown;
  received?: unknown;
  /** Additional freeform context for debugging. */
  detail?: string;
}

/**
 * User-facing error — safe to surface.
 */
export interface PlannerUserFacingError {
  code: PlannerErrorCode;
  /** Arabic-language message, safe for end-user display. */
  userMessage: string;
  isUserFacing: true;
  requestId?: string;
}

/**
 * Internal error — logged only, never sent to the client.
 */
export interface PlannerInternalError {
  code: PlannerErrorCode;
  /** Arabic-language fallback for the user (generic, no internals). */
  userMessage: string;
  isUserFacing: false;
  requestId?: string;
  diagnostic?: PlannerErrorDiagnostic;
}

export type PlannerError = PlannerUserFacingError | PlannerInternalError;

// ---------------------------------------------------------------------------
// Factory Helpers
// ---------------------------------------------------------------------------

/** Create a user-facing planner error. */
export function userFacingError(
  code: PlannerErrorCode,
  userMessage: string,
  requestId?: string
): PlannerUserFacingError {
  return { code, userMessage, isUserFacing: true, requestId };
}

/** Create an internal-only planner error (never reaches the client). */
export function internalError(
  code: PlannerErrorCode,
  diagnostic?: PlannerErrorDiagnostic,
  requestId?: string
): PlannerInternalError {
  return {
    code,
    // Generic Arabic message — reveals nothing about the internal failure.
    userMessage: "حدث خطأ داخلي. يُرجى المحاولة مجددًا.",
    isUserFacing: false,
    requestId,
    diagnostic,
  };
}

// ---------------------------------------------------------------------------
// User Messages (Arabic) — centralised so they stay consistent
// ---------------------------------------------------------------------------

export const PLANNER_USER_MESSAGES: Record<PlannerErrorCode, string> = {
  [PLANNER_ERROR_CODES.INVALID_REQUEST]:
    "الطلب غير مكتمل أو يحتوي على بيانات غير صالحة.",
  [PLANNER_ERROR_CODES.INVALID_PERSONA]:
    "الشخصية المحددة غير مدعومة حاليًا.",
  [PLANNER_ERROR_CODES.UNSUPPORTED_PLATFORM]:
    "المنصة المحددة غير مدعومة.",
  [PLANNER_ERROR_CODES.TOPIC_TOO_SHORT]:
    "الموضوع قصير جدًا. اكتب على الأقل 10 أحرف.",
  [PLANNER_ERROR_CODES.TOPIC_TOO_LONG]:
    "الموضوع طويل جدًا. الحد الأقصى 500 حرف.",
  [PLANNER_ERROR_CODES.INSTRUCTIONS_TOO_LONG]:
    "التعليمات المخصصة طويلة جدًا. الحد الأقصى 300 حرف.",
  [PLANNER_ERROR_CODES.TERMS_LIMIT_EXCEEDED]:
    "عدد الكلمات المحظورة أو المطلوبة يتجاوز الحد الأقصى (10 لكل قائمة).",
  [PLANNER_ERROR_CODES.INVALID_IR]:
    "حدث خطأ داخلي. يُرجى المحاولة مجددًا.",
  [PLANNER_ERROR_CODES.MISSING_NODES]:
    "حدث خطأ داخلي. يُرجى المحاولة مجددًا.",
  [PLANNER_ERROR_CODES.FORBIDDEN_NODE]:
    "حدث خطأ داخلي. يُرجى المحاولة مجددًا.",
  [PLANNER_ERROR_CODES.TOPOLOGY_VIOLATION]:
    "حدث خطأ داخلي. يُرجى المحاولة مجددًا.",
  [PLANNER_ERROR_CODES.EMPTY_NODE_CONTENT]:
    "حدث خطأ داخلي. يُرجى المحاولة مجددًا.",
  [PLANNER_ERROR_CODES.DUPLICATE_NODES]:
    "حدث خطأ داخلي. يُرجى المحاولة مجددًا.",
  [PLANNER_ERROR_CODES.DUPLICATE_EDGES]:
    "حدث خطأ داخلي. يُرجى المحاولة مجددًا.",
  [PLANNER_ERROR_CODES.PERSONA_MISMATCH]:
    "حدث خطأ داخلي. يُرجى المحاولة مجددًا.",
  [PLANNER_ERROR_CODES.IR_VERSION_MISMATCH]:
    "حدث خطأ داخلي. يُرجى المحاولة مجددًا.",
  [PLANNER_ERROR_CODES.INVALID_CONFIDENCE]:
    "حدث خطأ داخلي. يُرجى المحاولة مجددًا.",
  [PLANNER_ERROR_CODES.PLANNER_FAILURE]:
    "تعذّر على النظام إنشاء الخطة. يُرجى المحاولة مجددًا.",
  [PLANNER_ERROR_CODES.RENDER_FAILURE]:
    "تعذّر على النظام إنشاء المحتوى. يُرجى المحاولة مجددًا.",
  [PLANNER_ERROR_CODES.TIMEOUT]:
    "استغرق الطلب وقتًا أطول من المتوقع. يُرجى المحاولة مجددًا.",
  [PLANNER_ERROR_CODES.INTERNAL_ERROR]:
    "حدث خطأ داخلي. يُرجى المحاولة مجددًا.",
};
