import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { buildSystemPrompt } from "../supabase/functions/generate/prompts/promptBuilder";
import { PROMPT_BUDGET_MATRIX, measurePromptBudget } from "../lib/evaluation/promptBudget";

describe("Prompt budget", () => {
  test("covers the reviewed cross-layer matrix", () => {
    assert.equal(PROMPT_BUDGET_MATRIX.length, 6);
  });

  test("keeps every reviewed prompt within the 10% growth budget", () => {
    const budget = measurePromptBudget(buildSystemPrompt);
    assert.deepEqual(budget.violations, []);
    assert.ok(budget.measurements.every((measurement) => measurement.characters > 200));
  });
});
