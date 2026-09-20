import { test, describe } from "node:test";
import assert from "node:assert/strict";

import { buildPlannerPrompt } from "../lib/planner/thought/plannerPrompt";
import { buildRendererPrompt } from "../lib/planner/thought/thoughtRendererPrompt";
import { TOPOLOGY_REQUIRED } from "../lib/content/personas/topologyDefinitions";
import type { PlannerRequestDTO } from "../lib/planner/validation";
import type { IRGraph } from "../lib/planner/types";
import { PLANNER_SUPPORTED_PERSONAS } from "../lib/planner/validation";
import type { PersonaId } from "../lib/evaluation/types";
import crypto from "crypto";

const dummyRequest: PlannerRequestDTO = {
  persona: "intellectual",
  topic: "Procrastination",
  platform: "linkedin",
  objective: "education",
  language: "ar",
  constraints: {
    maxLength: 1500
  }
};

const dummyIr: IRGraph = {
  version: "1.0.0",
  personaId: "intellectual",
  nodes: [
    { id: "assumption", content: "Assume XYZ" },
    { id: "contradiction", content: "Contradicts ABC" }
  ],
  edges: [
    { from: "assumption", to: "contradiction", rel: "leads_to" }
  ]
};

describe("Prompt Builder Contracts", () => {
  // ── PLANNER PROMPT TESTS ──────────────────────────────────────────────────
  test("planner prompt contains persona semantic constraints (I1)", () => {
    const prompt = buildPlannerPrompt(dummyRequest);
    assert.ok(prompt.includes("INTELLECTUAL SEMANTIC PLANNER"), "Should include persona identifier");
    assert.ok(prompt.includes("INTELLECTUAL BOUNDARY"), "Should include I1 constraints");
  });

  test("planner prompt contains exact topology nodes", () => {
    const prompt = buildPlannerPrompt(dummyRequest);
    const topo = TOPOLOGY_REQUIRED["intellectual"].nodes;
    for (const node of topo) {
      assert.ok(prompt.includes(`- ${node}`), `Prompt missing node: ${node}`);
    }
  });

  test("planner prompt forbids arbitrary nodes", () => {
    const prompt = buildPlannerPrompt(dummyRequest);
    assert.ok(prompt.includes("DO NOT ADD EXTRA NODES"), "Must forbid arbitrary nodes");
  });

  test("planner prompt forbids planner-generated edges", () => {
    const prompt = buildPlannerPrompt(dummyRequest);
    assert.ok(prompt.includes("DO NOT INVENT EDGES"), "Must forbid generating edges");
  });

  test("same input -> same planner prompt (pure function)", () => {
    const p1 = buildPlannerPrompt(dummyRequest);
    const p2 = buildPlannerPrompt(dummyRequest);
    assert.strictEqual(p1, p2, "Prompt builder must be deterministic");
  });

  test("different persona -> different topology and constraints", () => {
    const p1 = buildPlannerPrompt(dummyRequest);
    const p2 = buildPlannerPrompt({ ...dummyRequest, persona: "creative" });
    
    assert.notStrictEqual(p1, p2);
    assert.ok(!p2.includes("INTELLECTUAL SEMANTIC PLANNER"));
    assert.ok(p2.includes("CREATIVE SEMANTIC PLANNER"));
    
    const creativeTopo = TOPOLOGY_REQUIRED["creative"].nodes;
    for (const node of creativeTopo) {
      assert.ok(p2.includes(`- ${node}`), `Prompt missing creative node: ${node}`);
    }
  });

  test("no secrets or request IDs present in planner prompt", () => {
    const requestId = crypto.randomUUID();
    // We pass extra undocumented properties to request ( simulating JS pass-through )
    const dirtyRequest = { ...dummyRequest, request_id: requestId, secret: "super_secret" } as unknown as PlannerRequestDTO;
    
    const prompt = buildPlannerPrompt(dirtyRequest);
    assert.ok(!prompt.includes(requestId), "Prompt must not leak request ID");
    assert.ok(!prompt.includes("super_secret"), "Prompt must not leak arbitrary secrets");
  });

  test("Planner Prompt Builder adapts to runtime topology change (Single Source of Truth)", () => {
    const testPersonaId = "__test_prompt_persona__" as PersonaId;
    
    // Inject fake topology
    (TOPOLOGY_REQUIRED as Record<string, unknown>)[testPersonaId] = {
      nodes: ["fake_start", "fake_end"],
      edges: [],
    };
    PLANNER_SUPPORTED_PERSONAS.push(testPersonaId);

    try {
      const prompt = buildPlannerPrompt({ ...dummyRequest, persona: testPersonaId });
      
      assert.ok(prompt.includes("- fake_start"), "Must include injected start node");
      assert.ok(prompt.includes("- fake_end"), "Must include injected end node");
      
    } finally {
      delete (TOPOLOGY_REQUIRED as Record<string, unknown>)[testPersonaId];
      PLANNER_SUPPORTED_PERSONAS.pop();
    }
  });

  // ── RENDERER PROMPT TESTS ─────────────────────────────────────────────────
  test("renderer accepts only validated IR (incorporates IR verbatim)", () => {
    const prompt = buildRendererPrompt(dummyIr, dummyRequest);
    assert.ok(prompt.includes("[assumption]: Assume XYZ"), "Must include exact node content");
    assert.ok(prompt.includes("assumption --(leads_to)--> contradiction"), "Must include exact edge relationships");
    assert.ok(prompt.includes("YOU MUST ACCEPT AND RENDER THE PROVIDED IR GRAPH EXACTLY"), "Must instruct adherence to IR");
  });

  test("renderer output schema instructions present", () => {
    const prompt = buildRendererPrompt(dummyIr, dummyRequest);
    assert.ok(prompt.includes("[OUTPUT SCHEMA]"), "Must define output schema");
    assert.ok(prompt.includes('"title": "String'), "Must demand title");
    assert.ok(prompt.includes('"body": "String'), "Must demand body");
  });

  test("language/platform/objective preserved in renderer", () => {
    const prompt = buildRendererPrompt(dummyIr, dummyRequest);
    assert.ok(prompt.includes("Language: ar"), "Language must be preserved");
    assert.ok(prompt.includes("Platform: linkedin"), "Platform must be preserved");
    assert.ok(prompt.includes("Objective: education"), "Objective must be preserved");
  });

  test("maxLength propagated to both planner and renderer", () => {
    const plannerPrompt = buildPlannerPrompt(dummyRequest);
    const rendererPrompt = buildRendererPrompt(dummyIr, dummyRequest);

    // Assert the numeric budget appears in both prompts.
    // We match the number itself, not the surrounding copy, so the test doesn't
    // break if the wording changes in the future.
    assert.ok(plannerPrompt.includes("1500"), "maxLength (1500) must appear in planner prompt");
    assert.ok(rendererPrompt.includes("1500"), "maxLength (1500) must appear in renderer prompt");
  });

  test("no secrets or request IDs present in renderer prompt", () => {
    const requestId = crypto.randomUUID();
    const dirtyRequest = { ...dummyRequest, request_id: requestId, secret: "super_secret" } as unknown as PlannerRequestDTO;
    
    const prompt = buildRendererPrompt(dummyIr, dirtyRequest);
    assert.ok(!prompt.includes(requestId), "Prompt must not leak request ID");
    assert.ok(!prompt.includes("super_secret"), "Prompt must not leak arbitrary secrets");
  });
});
