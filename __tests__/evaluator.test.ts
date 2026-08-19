import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { evaluateDeterministic } from "../lib/evaluation/evaluator";

describe("Evaluator - Deterministic", () => {
  const dummyOutput = {
    title: "Test",
    hook: "This is a hook",
    body: "This is a body of text with some length to pass.",
    callToAction: "Call now",
    hashtags: ["one", "two", "three", "four", "five"]
  };

  test("mustContain with | (OR logic) passes when one option exists", () => {
    const textOutput = { ...dummyOutput, body: "This contains ROI as requested." };
    const result = evaluateDeterministic(textOutput, {
      mustContain: ["ROI|عائد"]
    });
    const check = result.checks.find(c => c.name === "mustContain");
    assert.equal(check?.passed, true);
  });

  test("mustContain with | (OR logic) passes when the other option exists", () => {
    const textOutput = { ...dummyOutput, body: "This contains عائد as requested." };
    const result = evaluateDeterministic(textOutput, {
      mustContain: ["ROI|عائد"]
    });
    const check = result.checks.find(c => c.name === "mustContain");
    assert.equal(check?.passed, true);
  });

  test("mustContain with | (OR logic) fails when neither option exists", () => {
    const textOutput = { ...dummyOutput, body: "This contains something else entirely." };
    const result = evaluateDeterministic(textOutput, {
      mustContain: ["ROI|عائد"]
    });
    const check = result.checks.find(c => c.name === "mustContain");
    assert.equal(check?.passed, false);
  });
});
