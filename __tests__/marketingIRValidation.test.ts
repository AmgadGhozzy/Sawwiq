import { test, describe } from "node:test";
import assert from "node:assert/strict";

import {
  validateIRGraph,
  IR_SCHEMA_VERSION,
} from "../lib/planner/validation";
import { PLANNER_ERROR_CODES } from "../lib/planner/errors";
import type { MarketingIRGraph } from "../lib/planner/types";

describe("validateIRGraph — marketing persona", () => {
  function buildValidMarketingIR(): MarketingIRGraph {
    return {
      personaId: "marketing",
      version: IR_SCHEMA_VERSION,
      nodes: [
        { id: "benefit_1", content: "فائدة 1" },
        { id: "benefit_2", content: "فائدة 2" },
      ],
      edges: [{ from: "benefit_1", to: "benefit_2", rel: "leads_to" }],
      angles: [
        {
          type: "pain_resolution",
          priority: "high",
          content: "حل مشكلة",
          sourceNodes: ["benefit_1"],
        },
      ],
    };
  }

  test("valid marketing IR passes validation", () => {
    const ir = buildValidMarketingIR();
    const result = validateIRGraph(ir, "marketing");
    assert.ok(result.valid, `Expected valid, got issues: ${JSON.stringify(result.issues)}`);
  });

  test("fails when sourceNodes array is empty", () => {
    const ir = buildValidMarketingIR();
    ir.angles[0].sourceNodes = [];
    const result = validateIRGraph(ir, "marketing");
    
    assert.ok(!result.valid);
    assert.ok(
      result.issues.some((i) => i.code === PLANNER_ERROR_CODES.TOPOLOGY_VIOLATION && i.detail.includes("missing required 'sourceNodes' array")),
      "Expected TOPOLOGY_VIOLATION for empty sourceNodes"
    );
  });

  test("fails when sourceNode references non-existent node", () => {
    const ir = buildValidMarketingIR();
    ir.angles[0].sourceNodes = ["benefit_1", "fake_node"];
    const result = validateIRGraph(ir, "marketing");
    
    assert.ok(!result.valid);
    assert.ok(
      result.issues.some((i) => i.code === PLANNER_ERROR_CODES.TOPOLOGY_VIOLATION && i.detail.includes("non-existent sourceNodes: fake_node")),
      "Expected TOPOLOGY_VIOLATION for non-existent sourceNode"
    );
  });

  test("fails when version is missing or incorrect", () => {
    const ir = buildValidMarketingIR();
    (ir as any).version = "0.0.0";
    const resultInvalidVersion = validateIRGraph(ir, "marketing");
    
    assert.ok(!resultInvalidVersion.valid);
    assert.ok(
      resultInvalidVersion.issues.some((i) => i.code === PLANNER_ERROR_CODES.IR_VERSION_MISMATCH),
      "Expected IR_VERSION_MISMATCH for wrong version"
    );

    const irNoVersion = buildValidMarketingIR();
    delete (irNoVersion as any).version;
    const resultNoVersion = validateIRGraph(irNoVersion, "marketing");
    
    assert.ok(!resultNoVersion.valid);
    assert.ok(
      resultNoVersion.issues.some((i) => i.code === PLANNER_ERROR_CODES.IR_VERSION_MISMATCH),
      "Expected IR_VERSION_MISMATCH for missing version"
    );
  });
});
