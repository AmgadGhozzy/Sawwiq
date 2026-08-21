import { test } from "node:test";
import assert from "node:assert/strict";
import { repairVideoScriptTiming } from "../supabase/functions/generate/utils/repair.ts";

test("repairVideoScriptTiming", async (t) => {
  await t.test("5s hook reduces to 3s and adds 2s to scene 2", () => {
    const input = `[Scene 1 - 5s]
[Visual] Hook visual
[Audio] Hook audio
[Scene 2 - 4s]
[Visual] Scene 2 visual`;

    const expected = `[Scene 1 - 3s]
[Visual] Hook visual
[Audio] Hook audio
[Scene 2 - 6s]
[Visual] Scene 2 visual`;

    const result = repairVideoScriptTiming(input);
    assert.strictEqual(result, expected);
  });

  await t.test("3s hook remains unchanged", () => {
    const input = `[Scene 1 - 3s]
[Visual] Hook visual
[Scene 2 - 4s]`;
    const result = repairVideoScriptTiming(input);
    assert.strictEqual(result, input);
  });

  await t.test("safely fails if only 1 scene exists", () => {
    const input = `[Scene 1 - 5s]
[Visual] Hook visual
[Audio] Hook audio`;
    const result = repairVideoScriptTiming(input);
    assert.strictEqual(result, input);
  });

  await t.test("preserves formatting, dashes, and other text", () => {
    const input = `Some intro text.
[Scene 1 — 4s]
[Visual] Visual 1
[Audio] Audio 1

[Scene 2 – 5s]
[Visual] Visual 2
[Scene 3 - 6s]`;

    const expected = `Some intro text.
[Scene 1 — 3s]
[Visual] Visual 1
[Audio] Audio 1

[Scene 2 – 6s]
[Visual] Visual 2
[Scene 3 - 6s]`;

    const result = repairVideoScriptTiming(input);
    assert.strictEqual(result, expected);
  });

  await t.test("ignores non-video scripts completely", () => {
    const input = "This is a normal post with no scenes.";
    const result = repairVideoScriptTiming(input);
    assert.strictEqual(result, input);
  });
});
