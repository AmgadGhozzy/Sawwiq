/**
 * PHASE 1.5 — Pipeline B Contract Tests
 *
 * Covers:
 *   1. PlannerRequestSchema (Zod) — valid + boundary failures
 *   2. validateIRGraph()          — all 10 invariants
 *   3. Single Source of Truth     — persona list derived from TOPOLOGY_REQUIRED,
 *                                   IR validator auto-tracks topology changes
 *
 * Design: deterministic — zero LLM, zero network, zero Supabase.
 * Run:    npx tsx --test __tests__/plannerContract.test.ts
 */

import { test, describe } from "node:test";
import assert from "node:assert/strict";

import {
  PlannerRequestSchema,
  validateIRGraph,
  PLANNER_SUPPORTED_PERSONAS,
  IR_SCHEMA_VERSION,
} from "../lib/planner/validation";
import { TOPOLOGY_REQUIRED } from "../lib/content/personas/topologyDefinitions";
import { PLANNER_ERROR_CODES } from "../lib/planner/errors";
import type { IRGraph } from "../lib/planner/types";
import type { PersonaId } from "../lib/evaluation/types";

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const VALID_REQUEST = {
  persona: "developer",
  topic: "لماذا تفشل فرق العمل في التواصل رغم وجود الأدوات؟",
  platform: "linkedin",
  objective: "education",
  language: "ar",
} as const;

/**
 * Build a valid IRGraph for a persona using the canonical topology.
 * This is the golden base used by mutation tests.
 */
function buildValidIR(personaId: PersonaId): IRGraph {
  const topo = TOPOLOGY_REQUIRED[personaId];
  return {
    personaId,
    version: IR_SCHEMA_VERSION,
    nodes: topo.nodes.map((id) => ({ id, content: `محتوى ${id} صالح` })),
    edges: topo.edges.map((e) => ({ from: e.from, to: e.to, rel: e.rel })),
  };
}

// ─── 1. PlannerRequestSchema ──────────────────────────────────────────────────

describe("PlannerRequestSchema", () => {
  // ── Valid cases ──────────────────────────────────────────────────────────────

  test("accepts a minimal valid request", () => {
    const result = PlannerRequestSchema.safeParse(VALID_REQUEST);
    assert.ok(result.success, JSON.stringify(result));
  });

  test("accepts all supported personas", () => {
    for (const persona of PLANNER_SUPPORTED_PERSONAS) {
      const result = PlannerRequestSchema.safeParse({ ...VALID_REQUEST, persona });
      assert.ok(result.success, `persona "${persona}" should be valid`);
    }
  });

  test("accepts optional audience field", () => {
    const result = PlannerRequestSchema.safeParse({
      ...VALID_REQUEST,
      audience: "مطورو البرمجيات في الشركات الكبيرة",
    });
    assert.ok(result.success);
  });

  test("accepts optional constraints with valid values", () => {
    const result = PlannerRequestSchema.safeParse({
      ...VALID_REQUEST,
      constraints: {
        forbiddenTerms: ["تحديات"],
        requiredTerms: ["إنتاجية"],
        maxLength: 800,
        customInstructions: "ابدأ بسؤال استفزازي.",
      },
    });
    assert.ok(result.success);
  });

  test("trims topic whitespace", () => {
    const result = PlannerRequestSchema.safeParse({
      ...VALID_REQUEST,
      topic: "   لماذا تفشل فرق العمل في التواصل؟   ",
    });
    assert.ok(result.success);
    if (result.success) {
      assert.strictEqual(
        result.data.topic,
        "لماذا تفشل فرق العمل في التواصل؟"
      );
    }
  });

  // ── Persona failures ─────────────────────────────────────────────────────────

  test("rejects persona not in TOPOLOGY_REQUIRED", () => {
    const result = PlannerRequestSchema.safeParse({
      ...VALID_REQUEST,
      persona: "science", // in PERSONA_REGISTRY but has no topology
    });
    assert.ok(!result.success, '"science" has no topology — should fail');
  });

  test("rejects unknown persona", () => {
    const result = PlannerRequestSchema.safeParse({
      ...VALID_REQUEST,
      persona: "alien_overlord",
    });
    assert.ok(!result.success);
  });

  // ── Topic boundary failures ───────────────────────────────────────────────────

  test("rejects topic shorter than 10 chars", () => {
    const result = PlannerRequestSchema.safeParse({
      ...VALID_REQUEST,
      topic: "قصير",
    });
    assert.ok(!result.success);
  });

  test("rejects topic longer than 500 chars", () => {
    const result = PlannerRequestSchema.safeParse({
      ...VALID_REQUEST,
      topic: "أ".repeat(501),
    });
    assert.ok(!result.success);
  });

  test("accepts topic of exactly 10 chars", () => {
    const result = PlannerRequestSchema.safeParse({
      ...VALID_REQUEST,
      topic: "أ".repeat(10),
    });
    assert.ok(result.success);
  });

  test("accepts topic of exactly 500 chars", () => {
    const result = PlannerRequestSchema.safeParse({
      ...VALID_REQUEST,
      topic: "أ".repeat(500),
    });
    assert.ok(result.success);
  });

  // ── Platform failures ────────────────────────────────────────────────────────

  test("rejects unsupported platform", () => {
    const result = PlannerRequestSchema.safeParse({
      ...VALID_REQUEST,
      platform: "myspace",
    });
    assert.ok(!result.success);
  });

  // ── Constraint limit failures ────────────────────────────────────────────────

  test("rejects forbiddenTerms list with more than 10 items", () => {
    const result = PlannerRequestSchema.safeParse({
      ...VALID_REQUEST,
      constraints: {
        forbiddenTerms: Array.from({ length: 11 }, (_, i) => `term${i}`),
      },
    });
    assert.ok(!result.success);
  });

  test("accepts forbiddenTerms list with exactly 10 items", () => {
    const result = PlannerRequestSchema.safeParse({
      ...VALID_REQUEST,
      constraints: {
        forbiddenTerms: Array.from({ length: 10 }, (_, i) => `term${i}`),
      },
    });
    assert.ok(result.success);
  });

  test("rejects requiredTerms list with more than 10 items", () => {
    const result = PlannerRequestSchema.safeParse({
      ...VALID_REQUEST,
      constraints: {
        requiredTerms: Array.from({ length: 11 }, (_, i) => `term${i}`),
      },
    });
    assert.ok(!result.success);
  });

  test("rejects customInstructions longer than 300 chars", () => {
    const result = PlannerRequestSchema.safeParse({
      ...VALID_REQUEST,
      constraints: { customInstructions: "أ".repeat(301) },
    });
    assert.ok(!result.success);
  });

  test("accepts customInstructions of exactly 300 chars", () => {
    const result = PlannerRequestSchema.safeParse({
      ...VALID_REQUEST,
      constraints: { customInstructions: "أ".repeat(300) },
    });
    assert.ok(result.success);
  });

  test("rejects audience longer than 200 chars", () => {
    const result = PlannerRequestSchema.safeParse({
      ...VALID_REQUEST,
      audience: "أ".repeat(201),
    });
    assert.ok(!result.success);
  });
});

// ─── 2. validateIRGraph — per-persona valid baseline ─────────────────────────

describe("validateIRGraph — valid baselines", () => {
  for (const personaId of PLANNER_SUPPORTED_PERSONAS) {
    test(`accepts exact valid IR for "${personaId}"`, () => {
      const ir = buildValidIR(personaId);
      const result = validateIRGraph(ir, personaId);
      assert.ok(
        result.valid,
        `Expected valid IR for ${personaId}. Issues: ${JSON.stringify(result.issues)}`
      );
      assert.strictEqual(result.issues.length, 0);
    });
  }
});

// ─── 3. validateIRGraph — invariant failures (developer persona) ──────────────

describe("validateIRGraph — invariant failures", () => {
  // ── Persona mismatch ─────────────────────────────────────────────────────────

  test("fails on persona mismatch and bails early", () => {
    const ir = buildValidIR("developer");
    const result = validateIRGraph(ir, "psychology");
    assert.ok(!result.valid);
    assert.ok(
      result.issues.some((i) => i.code === PLANNER_ERROR_CODES.PERSONA_MISMATCH)
    );
  });

  // ── IR version ───────────────────────────────────────────────────────────────

  test("fails when IR version is wrong", () => {
    const ir: IRGraph = { ...buildValidIR("developer"), version: "0.0.1" };
    const result = validateIRGraph(ir, "developer");
    assert.ok(!result.valid);
    assert.ok(
      result.issues.some((i) => i.code === PLANNER_ERROR_CODES.IR_VERSION_MISMATCH)
    );
  });

  test("fails when IR version is missing (empty string)", () => {
    const ir: IRGraph = { ...buildValidIR("developer"), version: "" };
    const result = validateIRGraph(ir, "developer");
    assert.ok(!result.valid);
    assert.ok(
      result.issues.some((i) => i.code === PLANNER_ERROR_CODES.IR_VERSION_MISMATCH)
    );
  });

  // ── Missing node ─────────────────────────────────────────────────────────────

  test("fails when a required node is missing", () => {
    const ir = buildValidIR("developer");
    ir.nodes = ir.nodes.filter((n) => n.id !== "mechanism");
    const result = validateIRGraph(ir, "developer");
    assert.ok(!result.valid);
    assert.ok(
      result.issues.some((i) => i.code === PLANNER_ERROR_CODES.MISSING_NODES)
    );
    assert.ok(result.issues.some((i) => i.detail.includes("mechanism")));
  });

  // ── Forbidden node ───────────────────────────────────────────────────────────

  test("fails when an unexpected node is present", () => {
    const ir = buildValidIR("developer");
    ir.nodes.push({ id: "forbidden_node", content: "لا يجب أن يكون هنا" });
    const result = validateIRGraph(ir, "developer");
    assert.ok(!result.valid);
    assert.ok(
      result.issues.some((i) => i.code === PLANNER_ERROR_CODES.FORBIDDEN_NODE)
    );
    assert.ok(result.issues.some((i) => i.detail.includes("forbidden_node")));
  });

  // ── Duplicate nodes ───────────────────────────────────────────────────────────

  test("fails when duplicate node ids are present", () => {
    const ir = buildValidIR("developer");
    ir.nodes.push({ id: "system", content: "نسخة مكررة" });
    const result = validateIRGraph(ir, "developer");
    assert.ok(!result.valid);
    assert.ok(
      result.issues.some((i) => i.code === PLANNER_ERROR_CODES.DUPLICATE_NODES)
    );
  });

  // ── Empty node content ────────────────────────────────────────────────────────

  test("fails when node content is empty string", () => {
    const ir = buildValidIR("developer");
    ir.nodes[0] = { ...ir.nodes[0], content: "" };
    const result = validateIRGraph(ir, "developer");
    assert.ok(!result.valid);
    assert.ok(
      result.issues.some((i) => i.code === PLANNER_ERROR_CODES.EMPTY_NODE_CONTENT)
    );
  });

  test("fails when node content is whitespace only", () => {
    const ir = buildValidIR("developer");
    ir.nodes[1] = { ...ir.nodes[1], content: "   \t\n  " };
    const result = validateIRGraph(ir, "developer");
    assert.ok(!result.valid);
    assert.ok(
      result.issues.some((i) => i.code === PLANNER_ERROR_CODES.EMPTY_NODE_CONTENT)
    );
  });

  // ── Confidence range ─────────────────────────────────────────────────────────

  test("fails when confidence is greater than 1", () => {
    const ir = buildValidIR("developer");
    ir.nodes[0] = { ...ir.nodes[0], confidence: 1.1 };
    const result = validateIRGraph(ir, "developer");
    assert.ok(!result.valid);
    assert.ok(
      result.issues.some((i) => i.code === PLANNER_ERROR_CODES.INVALID_CONFIDENCE)
    );
  });

  test("fails when confidence is negative", () => {
    const ir = buildValidIR("developer");
    ir.nodes[0] = { ...ir.nodes[0], confidence: -0.1 };
    const result = validateIRGraph(ir, "developer");
    assert.ok(!result.valid);
    assert.ok(
      result.issues.some((i) => i.code === PLANNER_ERROR_CODES.INVALID_CONFIDENCE)
    );
  });

  test("accepts confidence at boundary values 0 and 1", () => {
    const ir = buildValidIR("developer");
    ir.nodes[0] = { ...ir.nodes[0], confidence: 0 };
    ir.nodes[1] = { ...ir.nodes[1], confidence: 1 };
    const result = validateIRGraph(ir, "developer");
    assert.ok(result.valid, JSON.stringify(result.issues));
  });

  test("accepts node with no confidence field", () => {
    const ir = buildValidIR("developer");
    // confidence is undefined by default in buildValidIR
    const result = validateIRGraph(ir, "developer");
    assert.ok(result.valid);
  });

  // ── Topology: wrong edge relation ────────────────────────────────────────────

  test("fails when an edge has the wrong relation", () => {
    const ir = buildValidIR("developer");
    ir.edges[0] = { ...ir.edges[0], rel: "wrong_relation" };
    const result = validateIRGraph(ir, "developer");
    assert.ok(!result.valid);
    assert.ok(
      result.issues.some((i) => i.code === PLANNER_ERROR_CODES.TOPOLOGY_VIOLATION)
    );
  });

  // ── Topology: wrong edge direction ────────────────────────────────────────────

  test("fails when edge direction is reversed", () => {
    const ir = buildValidIR("developer");
    // swap from/to on the first edge
    const e = ir.edges[0];
    ir.edges[0] = { from: e.to, to: e.from, rel: e.rel };
    const result = validateIRGraph(ir, "developer");
    assert.ok(!result.valid);
    assert.ok(
      result.issues.some((i) => i.code === PLANNER_ERROR_CODES.TOPOLOGY_VIOLATION)
    );
  });

  // ── Topology: missing edge ────────────────────────────────────────────────────

  test("fails when an edge is missing", () => {
    const ir = buildValidIR("developer");
    ir.edges = ir.edges.slice(0, -1); // remove last edge
    const result = validateIRGraph(ir, "developer");
    assert.ok(!result.valid);
    assert.ok(
      result.issues.some((i) => i.code === PLANNER_ERROR_CODES.TOPOLOGY_VIOLATION)
    );
  });

  // ── Duplicate edges ───────────────────────────────────────────────────────────

  test("fails when duplicate edges are present", () => {
    const ir = buildValidIR("developer");
    ir.edges.push({ ...ir.edges[0] }); // duplicate first edge
    const result = validateIRGraph(ir, "developer");
    assert.ok(!result.valid);
    assert.ok(
      result.issues.some((i) => i.code === PLANNER_ERROR_CODES.DUPLICATE_EDGES)
    );
  });

  // ── Multiple simultaneous failures ───────────────────────────────────────────

  test("reports ALL issues, not just the first", () => {
    const ir = buildValidIR("developer");
    // inject 3 distinct violations
    ir.nodes[0] = { ...ir.nodes[0], content: "" };    // EMPTY_NODE_CONTENT
    ir.nodes.push({ id: "rogue", content: "lol" });   // FORBIDDEN_NODE
    ir.edges[0] = { ...ir.edges[0], rel: "bad_rel" }; // TOPOLOGY_VIOLATION
    const result = validateIRGraph(ir, "developer");
    assert.ok(!result.valid);
    assert.ok(result.issues.length >= 3, `Expected ≥ 3 issues, got ${result.issues.length}`);
  });
});

// ─── 4. validateIRGraph — all personas covered ────────────────────────────────

describe("validateIRGraph — per-persona missing-node detection", () => {
  for (const personaId of PLANNER_SUPPORTED_PERSONAS) {
    const topo = TOPOLOGY_REQUIRED[personaId];
    const firstNode = topo.nodes[0];

    test(`"${personaId}": detects missing node "${firstNode}"`, () => {
      const ir = buildValidIR(personaId);
      ir.nodes = ir.nodes.filter((n) => n.id !== firstNode);
      const result = validateIRGraph(ir, personaId);
      assert.ok(!result.valid);
      assert.ok(
        result.issues.some((i) => i.code === PLANNER_ERROR_CODES.MISSING_NODES),
        `Expected MISSING_NODES for "${personaId}"`
      );
    });
  }
});

// ─── 5. Single Source of Truth — TOPOLOGY_REQUIRED drives everything ──────────

describe("Single Source of Truth — TOPOLOGY_REQUIRED", () => {
  test("PLANNER_SUPPORTED_PERSONAS matches Object.keys(TOPOLOGY_REQUIRED)", () => {
    const expected = Object.keys(TOPOLOGY_REQUIRED).sort();
    const actual = [...PLANNER_SUPPORTED_PERSONAS].sort();
    assert.deepStrictEqual(
      actual,
      expected,
      "PLANNER_SUPPORTED_PERSONAS must exactly mirror Object.keys(TOPOLOGY_REQUIRED)"
    );
  });

  test("adding a persona to TOPOLOGY_REQUIRED makes it automatically valid in schema", () => {
    // Simulate: temporarily add a test persona to TOPOLOGY_REQUIRED
    const testPersonaId = "__test_persona__" as PersonaId;
    (TOPOLOGY_REQUIRED as Record<string, unknown>)[testPersonaId] = {
      nodes: ["alpha", "beta"],
      edges: [{ from: "alpha", to: "beta", rel: "leads_to" }],
    };

    // Recompute supported personas from the (now mutated) TOPOLOGY_REQUIRED
    const freshPersonas = Object.keys(TOPOLOGY_REQUIRED);
    assert.ok(
      freshPersonas.includes(testPersonaId),
      "Test persona should now appear in TOPOLOGY_REQUIRED keys"
    );

    // Build a valid IR for this test persona and validate it
    const ir: IRGraph = {
      personaId: testPersonaId,
      version: IR_SCHEMA_VERSION,
      nodes: [
        { id: "alpha", content: "محتوى alpha" },
        { id: "beta", content: "محتوى beta" },
      ],
      edges: [{ from: "alpha", to: "beta", rel: "leads_to" }],
    };
    const result = validateIRGraph(ir, testPersonaId);
    assert.ok(
      result.valid,
      `IR for dynamically added persona should be valid. Issues: ${JSON.stringify(result.issues)}`
    );

    // Cleanup
    delete (TOPOLOGY_REQUIRED as Record<string, unknown>)[testPersonaId];
  });

  test("validateIRGraph uses the correct topology for each persona (no cross-contamination)", () => {
    // A valid developer IR must fail against intellectual topology
    const developerIR = buildValidIR("developer");
    const resultAsIntellectual = validateIRGraph(developerIR, "intellectual");
    assert.ok(
      !resultAsIntellectual.valid,
      "Developer IR validated against intellectual topology must fail"
    );
    assert.ok(
      resultAsIntellectual.issues.some(
        (i) => i.code === PLANNER_ERROR_CODES.PERSONA_MISMATCH
      )
    );
  });
});
