import test from "node:test";
import assert from "node:assert";
import { PlannerRequestDTO } from "../lib/planner/validation.ts";
import { validateRenderedContent } from "../lib/planner/output/validator.ts";

const PLATFORM_MAX_LENGTHS: Record<string, number> = {
  x: 280,
  instagram: 2200,
  facebook: 1500,
  linkedin: 2800,
};

// Minimal valid content that has a proper title/hook/body/cta.
// Body of 300 chars to reliably trigger LENGTH_EXCEEDED on tight platforms.
const longContent = {
  title: "Test Title",
  hook: "Test Hook",
  body: "B".repeat(300),
  callToAction: "Test CTA",
  hashtags: ["test"]
};

test("Effective Constraints Precedence Logic", async (t) => {
  await t.test("Platform default is used when user constraint is absent", () => {
    const req: PlannerRequestDTO = {
      topic: "test", platform: "x", objective: "awareness", persona: "intellectual", language: "ar",
      constraints: {}
    };

    const effectiveMaxLength = req.constraints?.maxLength ?? PLATFORM_MAX_LENGTHS[req.platform];
    assert.strictEqual(effectiveMaxLength, 280, "Should use X default of 280");

    const val = validateRenderedContent(longContent, req, effectiveMaxLength);
    // LENGTH_EXCEEDED is now soft — passed reflects hard failures only.
    // Our longContent has no other issues, so the pipeline accepts it.
    assert.strictEqual(val.passed, true, "Should pass (LENGTH_EXCEEDED is now soft)");
    const lengthSignal = val.signals.find(s => s.code === "LENGTH_EXCEEDED");
    assert.ok(lengthSignal, "LENGTH_EXCEEDED signal should be present");
    assert.strictEqual(lengthSignal!.severity, "soft", "Severity should be soft");
  });

  await t.test("User constraint is used when strictly lower than platform default", () => {
    const req: PlannerRequestDTO = {
      topic: "test", platform: "instagram", objective: "awareness", persona: "intellectual", language: "ar",
      constraints: { maxLength: 150 } // Instagram default is 2200
    };

    const effectiveMaxLength = req.constraints?.maxLength ?? PLATFORM_MAX_LENGTHS[req.platform];
    assert.strictEqual(effectiveMaxLength, 150, "Should use user constraint of 150");

    const val = validateRenderedContent(longContent, req, effectiveMaxLength);
    assert.strictEqual(val.passed, true, "Should pass (LENGTH_EXCEEDED is soft)");
    const lengthSignal = val.signals.find(s => s.code === "LENGTH_EXCEEDED");
    assert.ok(lengthSignal, "LENGTH_EXCEEDED signal should be present");
  });

  await t.test("User constraint overrides platform default even if higher", () => {
    const req: PlannerRequestDTO = {
      topic: "test", platform: "x", objective: "awareness", persona: "intellectual", language: "ar",
      constraints: { maxLength: 500 } // X default is 280
    };

    const effectiveMaxLength = req.constraints?.maxLength ?? PLATFORM_MAX_LENGTHS[req.platform];
    assert.strictEqual(effectiveMaxLength, 500, "Should use user constraint of 500");

    const val = validateRenderedContent(longContent, req, effectiveMaxLength);
    assert.strictEqual(val.passed, true, "Should pass because 300 < 500");
    assert.ok(!val.signals.some(s => s.code === "LENGTH_EXCEEDED"), "No length signal when within budget");
  });
});

