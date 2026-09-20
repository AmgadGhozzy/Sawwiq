import { test, describe } from "node:test";
import assert from "node:assert/strict";

import { extractJSON, parsePlannerOutput, parseRendererOutput } from "../lib/planner/output/parser";

describe("LLM Output Parser & Validators", () => {
  // ── JSON EXTRACTION (ADVERSARIAL) ──────────────────────────────────────────
  test("strips perfectly wrapped markdown fences and parses JSON", () => {
    const raw = `\`\`\`json
{
  "key": "value"
}
\`\`\``;
    const parsed = extractJSON(raw) as any;
    assert.strictEqual(parsed.key, "value");
  });

  test("handles perfectly wrapped output with no markdown fences", () => {
    const raw = `{"key": "value"}`;
    const parsed = extractJSON(raw) as any;
    assert.strictEqual(parsed.key, "value");
  });

  test("rejects if JSON is embedded inside conversational text", () => {
    const raw = `Here is your output:
\`\`\`json
{
  "key": "value"
}
\`\`\`
Have a good day!`;
    assert.throws(() => extractJSON(raw), /Parser Error: Failed to parse LLM output/);
  });

  test("rejects malformed JSON", () => {
    const raw = `\`\`\`json { "key": "value" \`\`\``; // missing closing brace
    assert.throws(() => extractJSON(raw), /Parser Error: Failed to parse LLM output/);
  });

  test("rejects if text has multiple JSON blocks", () => {
    const raw = `\`\`\`json
{"a":1}
\`\`\`
\`\`\`json
{"b":2}
\`\`\``;
    assert.throws(() => extractJSON(raw), /Parser Error: Failed to parse LLM output/);
  });

  test("rejects null or array when object is expected (caught by schema later, but good to note)", () => {
    const raw = `[1, 2, 3]`;
    const parsed = extractJSON(raw);
    assert.ok(Array.isArray(parsed));
  });

  // ── PLANNER PARSER ─────────────────────────────────────────────────────────
  test("valid planner output passes", () => {
    const raw = JSON.stringify({
      nodes: [
        { id: "node1", content: "hello", confidence: 0.9 },
        { id: "node2", content: "world" }
      ]
    });
    const parsed = parsePlannerOutput(raw);
    assert.strictEqual(parsed.nodes.length, 2);
    assert.strictEqual(parsed.nodes[0].id, "node1");
    assert.strictEqual(parsed.nodes[0].confidence, 0.9);
  });

  test("rejects missing nodes array", () => {
    const raw = JSON.stringify({ wrongKey: [] });
    assert.throws(() => parsePlannerOutput(raw), /Parser Error: Planner output validation failed/);
  });

  test("rejects empty nodes array", () => {
    const raw = JSON.stringify({ nodes: [] });
    assert.throws(() => parsePlannerOutput(raw), /empty nodes array/);
  });

  test("rejects empty content string", () => {
    const raw = JSON.stringify({
      nodes: [{ id: "node1", content: "" }]
    });
    assert.throws(() => parsePlannerOutput(raw), /validation failed/);
  });

  test("rejects invalid confidence bounds", () => {
    const raw = JSON.stringify({
      nodes: [{ id: "node1", content: "text", confidence: 1.5 }]
    });
    assert.throws(() => parsePlannerOutput(raw), /validation failed/);
  });

  test("strict schema rejects extra fields in planner output", () => {
    const raw = JSON.stringify({
      nodes: [{ id: "node1", content: "hello" }],
      extra_field: "should fail"
    });
    assert.throws(() => parsePlannerOutput(raw), /validation failed/);
  });

  // ── RENDERER PARSER ────────────────────────────────────────────────────────
  const validRendererRaw = JSON.stringify({
    title: "T",
    hook: "H",
    body: "B",
    callToAction: "C",
    hashtags: ["#A"]
  });

  test("valid renderer output passes", () => {
    const parsed = parseRendererOutput(validRendererRaw);
    assert.strictEqual(parsed.title, "T");
  });

  test("renderer parser rejects missing fields", () => {
    const raw = JSON.stringify({ title: "T", body: "B" });
    assert.throws(() => parseRendererOutput(raw), /validation failed/);
  });

  test("strict schema rejects extra fields in renderer output", () => {
    const raw = JSON.stringify({
      title: "T", hook: "H", body: "B", callToAction: "C", hashtags: [],
      inventedField: "magic"
    });
    assert.throws(() => parseRendererOutput(raw), /validation failed/);
  });

  // NOTE: length enforcement was removed from the parser.
  // LENGTH_EXCEEDED is now a soft diagnostic signal emitted by the validator
  // (lib/planner/output/validator.ts). The parser only checks JSON schema validity.
  // See plannerConstraintsPrecedence.test.ts for length signal assertions.
});
