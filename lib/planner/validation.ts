// ---------------------------------------------------------------------------
// Pipeline B — Planner Validation
//
// ARCHITECTURE RULES:
//   1. Pure: zero network calls, zero LLM calls, zero Supabase.
//   2. Single source of truth:
//      - PLATFORMS_V2 from types/content (platforms)
//      - TOPOLOGY_REQUIRED from topologyDefinitions (IR structure)
//      - PERSONA_REGISTRY / isPersonaSupported from registry (persona ids)
//      - Object.keys(TOPOLOGY_REQUIRED) drives the Zod persona enum —
//        never a hand-written string literal list.
//   3. IRGraph validation is DYNAMIC, not a static z.object().
//      validateIRGraph() is the authoritative IR guard.
//   4. This file is consumed exclusively by Pipeline B (lib/planner/* and
//      future app/api/planner). Pipeline A never imports from here.
// ---------------------------------------------------------------------------

import { z } from "zod";
import { PLATFORMS_V2 } from "@/types/content.ts";
import { TOPOLOGY_REQUIRED } from "@/lib/content/personas/topologyDefinitions.ts";
import { isPersonaSupported } from "@/lib/content/personas/registry.ts";
import type { PersonaId } from "@/lib/evaluation/types.ts";
import type { IRGraph, IRPersonaId } from "./types.ts";
import {
  PLANNER_ERROR_CODES,
  PLANNER_USER_MESSAGES,
  type PlannerError,
} from "./errors.ts";
import { resolveTone } from "./marketing/toneResolver.ts";
import type { NormalizedPlannerRequest } from "./types.ts";
import type { MarketingToneId, CopyFramework } from "@/types/content.ts";

// ---------------------------------------------------------------------------
// Supported personas for Pipeline B
//
// Derived from TOPOLOGY_REQUIRED — NOT a hand-written list.
// Only personas with a defined topology can be planned.
// (e.g. "science" is in the persona registry but has no topology → excluded)
// ---------------------------------------------------------------------------

export const PLANNER_SUPPORTED_PERSONAS = Object.keys(
  TOPOLOGY_REQUIRED
) as PersonaId[];

// The current IR schema version. Bump on any breaking IR shape change.
export const IR_SCHEMA_VERSION = "1.0.0";

// ---------------------------------------------------------------------------
// Zod Schemas (static request validation)
// ---------------------------------------------------------------------------

const PlannerConstraintsSchema = z.object({
  forbiddenTerms: z
    .array(z.string().min(1))
    .max(10, "forbiddenTerms: الحد الأقصى 10 عناصر.")
    .optional(),
  requiredTerms: z
    .array(z.string().min(1))
    .max(10, "requiredTerms: الحد الأقصى 10 عناصر.")
    .optional(),
  maxLength: z.number().int().positive().optional(),
  customInstructions: z
    .string()
    .max(300, "customInstructions: الحد الأقصى 300 حرف.")
    .optional(),
  /**
   * Evaluation-only: forces the renderer into a specific rhetorical mode.
   * Used by the Intellectual Diversity benchmark (--diversity flag).
   * Not exposed in the production API.
   */
  forcedIntellectualMode: z
    .enum(["thought_provoking", "analytical", "philosophical"])
    .optional(),
  /**
   * Evaluation-only: forces compact topology for short-budget platforms (e.g. X).
   * Only applies when persona = "intellectual".
   * Not exposed in the production API.
   */
  forcedIntellectualModeVariant: z
    .enum(["standard", "compact"])
    .optional(),
});

/**
 * Validates a raw PlannerRequest.
 *
 * Persona enum is derived from TOPOLOGY_REQUIRED at module load time —
 * adding a new persona+topology automatically makes it valid here.
 */
export const PlannerRequestSchema = z.object({
  purpose: z.enum(["thought", "marketing"]).optional(),
  // z.enum() requires a non-empty tuple; we cast safely after the runtime guard.
  persona: z
    .string()
    .refine(
      (v) => PLANNER_SUPPORTED_PERSONAS.includes(v as PersonaId),
      (v) => ({
        message: `الشخصية "${v}" غير مدعومة في Pipeline B. المدعومة: ${PLANNER_SUPPORTED_PERSONAS.join(", ")}.`,
      })
    )
    .refine(isPersonaSupported, {
      message: "الشخصية غير مسجّلة في PERSONA_REGISTRY.",
    })
    .optional(),
  arabicStyle: z.string().optional(),
  tone: z.string().optional(),
  copyFramework: z.string().optional(),
  keyMessage: z.string().optional(),
  topic: z
    .string()
    .trim()
    .min(10, PLANNER_USER_MESSAGES[PLANNER_ERROR_CODES.TOPIC_TOO_SHORT])
    .max(500, PLANNER_USER_MESSAGES[PLANNER_ERROR_CODES.TOPIC_TOO_LONG]),
  platform: z.enum(PLATFORMS_V2, {
    errorMap: () => ({
      message: PLANNER_USER_MESSAGES[PLANNER_ERROR_CODES.UNSUPPORTED_PLATFORM],
    }),
  }),
  objective: z.enum(
    [
      "awareness",
      "engagement",
      "traffic",
      "leads",
      "sales",
      "messages",
      "app_installs",
      "retention",
      "community",
      "education",
    ] as const,
    {
      errorMap: () => ({ message: "الهدف التسويقي غير صالح." }),
    }
  ),
  language: z.enum(["ar", "en", "bilingual"] as const, {
    errorMap: () => ({ message: "اللغة غير صالحة." }),
  }),
  audience: z.string().max(200, "audience: الحد الأقصى 200 حرف.").optional(),
  constraints: PlannerConstraintsSchema.optional(),
  useLegacyEngine: z.boolean().optional(),
});

export type PlannerRequestDTO = z.infer<typeof PlannerRequestSchema>;

/**
 * Normalizes the request and enforces structural invariants.
 * Throws if invariants are violated.
 */
export function normalizeAndEnforceInvariants(dto: PlannerRequestDTO): NormalizedPlannerRequest {
  const purpose = dto.purpose ?? "thought";

  if (purpose === "marketing") {
    // Structural invariant: marketing NEVER sees persona
    return {
      topic: dto.topic,
      platform: dto.platform,
      objective: dto.objective,
      language: dto.language,
      audience: dto.audience,
      constraints: dto.constraints,
      purpose: "marketing",
      persona: undefined,
      tone: (dto.tone as MarketingToneId) ?? resolveTone(dto.arabicStyle || "white_arabic", dto.objective),
      copyFramework: (dto.copyFramework as CopyFramework) ?? "auto",
      keyMessage: dto.keyMessage,
      useLegacyEngine: dto.useLegacyEngine,
    };
  }

  if (purpose === "thought" && !dto.persona) {
    throw new Error("purpose=thought requires persona");
  }

    return {
      topic: dto.topic,
      platform: dto.platform,
      objective: dto.objective,
      language: dto.language,
      audience: dto.audience,
      constraints: dto.constraints,
      purpose: "thought",
      persona: dto.persona as PersonaId,
      useLegacyEngine: dto.useLegacyEngine,
    };
}

// ---------------------------------------------------------------------------
// IR Validation — Dynamic (topology-aware)
// ---------------------------------------------------------------------------

export interface IRValidationIssue {
  code: (typeof PLANNER_ERROR_CODES)[keyof typeof PLANNER_ERROR_CODES];
  detail: string;
}

export interface IRValidationResult {
  valid: boolean;
  issues: IRValidationIssue[];
}

/**
 * Validates an IRGraph against TOPOLOGY_REQUIRED for the given persona.
 *
 * This is the authoritative IR guard. It checks:
 *   ✓ personaId matches the expected persona
 *   ✓ IR version matches IR_SCHEMA_VERSION
 *   ✓ no duplicate node ids
 *   ✓ no missing required nodes
 *   ✓ no unexpected (forbidden) nodes
 *   ✓ no empty node content (whitespace-only counts as empty)
 *   ✓ confidence values, when present, are in [0, 1]
 *   ✓ edges exactly mirror TOPOLOGY_REQUIRED[persona].edges
 *   ✓ no duplicate edges (same from+to pair)
 *
 * Returns a result with all discovered issues — not just the first.
 */
export function validateIRGraph(
  ir: IRGraph,
  expectedPersonaId: IRPersonaId
): IRValidationResult {
  const issues: IRValidationIssue[] = [];
  const isMarketing = expectedPersonaId === "marketing";
  // Marketing IRs follow the framework-specific marketing topologies
  // (validated separately via angles); the persona topologies don't apply.
  const topology = isMarketing ? null : TOPOLOGY_REQUIRED[expectedPersonaId];

  // ── 1. Persona mismatch ─────────────────────────────────────────────────
  if (ir.personaId !== expectedPersonaId) {
    issues.push({
      code: PLANNER_ERROR_CODES.PERSONA_MISMATCH,
      detail: `IR personaId "${ir.personaId}" does not match expected "${expectedPersonaId}".`,
    });
    // Topology checks below are meaningless with wrong persona — bail early.
    return { valid: false, issues };
  }

  // ── 2. IR version ───────────────────────────────────────────────────────
  if (!ir.version || ir.version !== IR_SCHEMA_VERSION) {
    issues.push({
      code: PLANNER_ERROR_CODES.IR_VERSION_MISMATCH,
      detail: `IR version "${ir.version}" does not match expected "${IR_SCHEMA_VERSION}".`,
    });
  }

  // ── 3. Duplicate node ids ───────────────────────────────────────────────
  const nodeIds = ir.nodes.map((n) => n.id);
  const uniqueNodeIds = new Set(nodeIds);
  if (uniqueNodeIds.size !== nodeIds.length) {
    const dupes = nodeIds.filter((id, i) => nodeIds.indexOf(id) !== i);
    issues.push({
      code: PLANNER_ERROR_CODES.DUPLICATE_NODES,
      detail: `Duplicate node ids: ${[...new Set(dupes)].join(", ")}.`,
    });
  }

  // ── 4. Required nodes present (missing / forbidden) ────────────────────
  const requiredNodes: Set<string> | null = topology
    ? new Set(topology.nodes)
    : null;
  const actualNodes = new Set(nodeIds);

  if (topology) {
    const requiredNodeSet = new Set(topology.nodes);
    const missingNodes = topology.nodes.filter((n) => !actualNodes.has(n));
    if (missingNodes.length > 0) {
      issues.push({
        code: PLANNER_ERROR_CODES.MISSING_NODES,
        detail: `Missing required nodes: ${missingNodes.join(", ")}.`,
      });
    }

    const forbiddenNodes = nodeIds.filter((id) => !requiredNodeSet.has(id));
    if (forbiddenNodes.length > 0) {
      issues.push({
        code: PLANNER_ERROR_CODES.FORBIDDEN_NODE,
        detail: `Unexpected nodes not in topology: ${[...new Set(forbiddenNodes)].join(", ")}.`,
      });
    }
  }

  // ── 5. Empty node content ───────────────────────────────────────────────
  for (const node of ir.nodes) {
    if (!node.content || node.content.trim().length === 0) {
      issues.push({
        code: PLANNER_ERROR_CODES.EMPTY_NODE_CONTENT,
        detail: `Node "${node.id}" has empty or whitespace-only content.`,
      });
    }
  }

  // ── 6. Node confidence range ────────────────────────────────────────────
  for (const node of ir.nodes) {
    if (
      node.confidence !== undefined &&
      (node.confidence < 0 || node.confidence > 1 || !isFinite(node.confidence))
    ) {
      issues.push({
        code: PLANNER_ERROR_CODES.INVALID_CONFIDENCE,
        detail: `Node "${node.id}" confidence ${node.confidence} is outside [0, 1].`,
      });
    }
  }

  // ── 7. Edge validation ──────────────────────────────────────────────────
  const requiredEdges = topology?.edges ?? null;

  // Duplicate edges (from+to pair)
  const edgeKeys = ir.edges.map((e) => `${e.from}→${e.to}`);
  const uniqueEdgeKeys = new Set(edgeKeys);
  if (uniqueEdgeKeys.size !== edgeKeys.length) {
    const dupes = edgeKeys.filter((k, i) => edgeKeys.indexOf(k) !== i);
    issues.push({
      code: PLANNER_ERROR_CODES.DUPLICATE_EDGES,
      detail: `Duplicate edges: ${[...new Set(dupes)].join(", ")}.`,
    });
  }

  // Edges must exactly mirror TOPOLOGY_REQUIRED (count, direction, relation)
  if (requiredEdges && ir.edges.length !== requiredEdges.length) {
    issues.push({
      code: PLANNER_ERROR_CODES.TOPOLOGY_VIOLATION,
      detail: `Expected ${requiredEdges.length} edges, found ${ir.edges.length}.`,
    });
  } else if (requiredEdges) {
    for (let i = 0; i < requiredEdges.length; i++) {
      const expected = requiredEdges[i];
      const actual = ir.edges[i];
      if (
        actual.from !== expected.from ||
        actual.to !== expected.to ||
        actual.rel !== expected.rel
      ) {
        issues.push({
          code: PLANNER_ERROR_CODES.TOPOLOGY_VIOLATION,
          detail: `Edge[${i}]: expected ${expected.from}→${expected.to} (${expected.rel}), got ${actual.from}→${actual.to} (${actual.rel}).`,
        });
      }
    }
  }

  // ── 8. Marketing Angles Validation ──────────────────────────────────────
  if (expectedPersonaId === "marketing") {
    const marketingIr = ir as any;
    const requiredNodeSet = requiredNodes ?? new Set(ir.nodes.map((n) => n.id));
    if (!marketingIr.angles || !Array.isArray(marketingIr.angles) || marketingIr.angles.length === 0) {
      issues.push({
        code: PLANNER_ERROR_CODES.TOPOLOGY_VIOLATION,
        detail: "Marketing IR requires at least one angle.",
      });
    } else {
      marketingIr.angles.forEach((angle: any, idx: number) => {
        if (!angle.type || !angle.content) {
          issues.push({
            code: PLANNER_ERROR_CODES.TOPOLOGY_VIOLATION,
            detail: `Angle[${idx}] missing required fields (type, content).`,
          });
        }
        if (!["high", "medium", "low"].includes(angle.priority)) {
          issues.push({
            code: PLANNER_ERROR_CODES.TOPOLOGY_VIOLATION,
            detail: `Angle[${idx}] has invalid priority "${angle.priority}". Must be high, medium, or low.`,
          });
        }
        if (!angle.sourceNodes || !Array.isArray(angle.sourceNodes) || angle.sourceNodes.length === 0) {
          issues.push({
            code: PLANNER_ERROR_CODES.TOPOLOGY_VIOLATION,
            detail: `Angle[${idx}] missing required 'sourceNodes' array. Every angle must be traceable to graph nodes.`,
          });
        } else {
          // Check that all sourceNodes exist in the graph
          const invalidNodes = angle.sourceNodes.filter((sn: string) => !requiredNodeSet.has(sn));
          if (invalidNodes.length > 0) {
            issues.push({
              code: PLANNER_ERROR_CODES.TOPOLOGY_VIOLATION,
              detail: `Angle[${idx}] references non-existent sourceNodes: ${invalidNodes.join(", ")}`,
            });
          }
        }
      });
    }
  }

  return { valid: issues.length === 0, issues };
}

// ---------------------------------------------------------------------------
// Request Validation Helper
// ---------------------------------------------------------------------------

export interface RequestValidationResult {
  valid: boolean;
  error?: PlannerError;
}

/**
 * Validates a raw unknown input as a PlannerRequest.
 * Returns a structured PlannerError on failure, ready for use in errors.ts.
 */
export function validatePlannerRequest(input: unknown): RequestValidationResult {
  const result = PlannerRequestSchema.safeParse(input);
  if (result.success) {
    return { valid: true };
  }

  const firstIssue = result.error.issues[0];
  const message =
    firstIssue?.message ??
    PLANNER_USER_MESSAGES[PLANNER_ERROR_CODES.INVALID_REQUEST];

  return {
    valid: false,
    error: {
      code: PLANNER_ERROR_CODES.INVALID_REQUEST,
      userMessage: message,
      isUserFacing: true,
    },
  };
}
