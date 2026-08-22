import { test } from "node:test";
import assert from "node:assert/strict";
import {
  parseVideoScript,
  validateVideoScript,
  enforceTiming,
} from "../lib/evaluation/videoValidator.ts";

// ---------------------------------------------------------------------------
// parseVideoScript
// ---------------------------------------------------------------------------

test("parseVideoScript", async (t) => {
  await t.test("returns null for body with no scene headers", () => {
    const result = parseVideoScript("This is a normal marketing post.");
    assert.strictEqual(result, null);
  });

  await t.test("parses a well-formed 3-scene script", () => {
    const body = `[Scene 1 - 3s]
[Visual] Hook visual here
[Audio] Hook audio here

[Scene 2 - 5s]
[Visual] Product close-up
[Audio] Feature narration

[Scene 3 - 4s]
[Visual] CTA screen
[Audio] Call to action`;

    const result = parseVideoScript(body);
    assert.ok(result !== null, "should return a parsed script");
    assert.strictEqual(result!.scenes.length, 3);
    assert.strictEqual(result!.scenes[0].index, 1);
    assert.strictEqual(result!.scenes[0].durationSec, 3);
    assert.strictEqual(result!.scenes[1].index, 2);
    assert.strictEqual(result!.scenes[2].durationSec, 4);
  });

  await t.test("extracts visual and audio per scene", () => {
    const body = `[Scene 1 - 2s]
[Visual] Opening shot
[Audio] Intro music`;

    const result = parseVideoScript(body);
    assert.ok(result !== null);
    assert.strictEqual(result!.scenes[0].visual, "Opening shot");
    assert.strictEqual(result!.scenes[0].audio, "Intro music");
  });

  await t.test("handles em-dash and en-dash separators", () => {
    const body = `[Scene 1 — 3s]
[Visual] V
[Audio] A
[Scene 2 – 5s]
[Visual] V2
[Audio] A2`;

    const result = parseVideoScript(body);
    assert.ok(result !== null);
    assert.strictEqual(result!.scenes.length, 2);
  });
});

// ---------------------------------------------------------------------------
// validateVideoScript
// ---------------------------------------------------------------------------

test("validateVideoScript", async (t) => {
  const makeScript = (overrides?: object) =>
    Object.assign(
      {
        scenes: [
          { index: 1, durationSec: 3, visual: "V1", audio: "A1" },
          { index: 2, durationSec: 5, visual: "V2", audio: "A2" },
          { index: 3, durationSec: 4, visual: "V3", audio: "A3" },
        ],
      },
      overrides
    );

  await t.test("passes a structurally valid 3-scene script", () => {
    const result = validateVideoScript(makeScript());
    assert.strictEqual(result.passed, true);
    assert.deepStrictEqual(result.errors, []);
  });

  await t.test("fails when first scene duration exceeds 3s", () => {
    const script = makeScript({
      scenes: [
        { index: 1, durationSec: 7, visual: "V1", audio: "A1" },
        { index: 2, durationSec: 5, visual: "V2", audio: "A2" },
      ],
    });
    const result = validateVideoScript(script);
    assert.strictEqual(result.passed, false);
    assert.ok(
      result.errors.some((e) => e.includes("First scene duration")),
      `Expected timing error, got: ${result.errors.join(", ")}`
    );
  });

  await t.test("fails on non-sequential scene numbers", () => {
    const script = makeScript({
      scenes: [
        { index: 1, durationSec: 3, visual: "V1", audio: "A1" },
        { index: 3, durationSec: 5, visual: "V3", audio: "A3" }, // skipped 2
      ],
    });
    const result = validateVideoScript(script);
    assert.strictEqual(result.passed, false);
    assert.ok(
      result.errors.some((e) => e.includes("Scene numbering error")),
      `Expected numbering error, got: ${result.errors.join(", ")}`
    );
  });

  await t.test("fails on duplicate scene index", () => {
    const script = makeScript({
      scenes: [
        { index: 1, durationSec: 3, visual: "V1", audio: "A1" },
        { index: 1, durationSec: 5, visual: "V1b", audio: "A1b" }, // duplicate
        { index: 2, durationSec: 4, visual: "V2", audio: "A2" },
      ],
    });
    const result = validateVideoScript(script);
    assert.strictEqual(result.passed, false);
    assert.ok(
      result.errors.some((e) => e.includes("Duplicate scene index")),
      `Expected duplicate error, got: ${result.errors.join(", ")}`
    );
  });

  await t.test("fails when a scene is missing visual direction", () => {
    const script = makeScript({
      scenes: [
        { index: 1, durationSec: 3, visual: "", audio: "A1" },
      ],
    });
    const result = validateVideoScript(script);
    assert.strictEqual(result.passed, false);
    assert.ok(result.errors.some((e) => e.includes("missing [Visual]")));
  });

  await t.test("fails when a scene is missing audio direction", () => {
    const script = makeScript({
      scenes: [
        { index: 1, durationSec: 3, visual: "V1", audio: "" },
      ],
    });
    const result = validateVideoScript(script);
    assert.strictEqual(result.passed, false);
    assert.ok(result.errors.some((e) => e.includes("missing [Audio]")));
  });

  await t.test("fails for empty scenes array", () => {
    const result = validateVideoScript({ scenes: [] });
    assert.strictEqual(result.passed, false);
    assert.ok(result.errors.some((e) => e.includes("no scenes")));
  });
});

// ---------------------------------------------------------------------------
// enforceTiming (integration with repairVideoScriptTiming)
// ---------------------------------------------------------------------------

test("enforceTiming", async (t) => {
  await t.test("reduces a 5s first scene to 3s and compensates Scene 2", () => {
    const body = `[Scene 1 - 5s]
[Visual] Hook
[Audio] Hook audio
[Scene 2 - 4s]
[Visual] Product`;

    const repaired = enforceTiming(body);
    const parsed = parseVideoScript(repaired);
    assert.ok(parsed !== null);
    assert.strictEqual(parsed!.scenes[0].durationSec, 3);
    assert.strictEqual(parsed!.scenes[1].durationSec, 6);
  });

  await t.test("does not modify body when first scene is already ≤ 3s", () => {
    const body = `[Scene 1 - 3s]
[Visual] Hook
[Audio] Hook audio
[Scene 2 - 5s]
[Visual] Product`;

    const repaired = enforceTiming(body);
    assert.strictEqual(repaired, body);
  });
});
