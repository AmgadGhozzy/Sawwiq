import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  buildSystemPrompt,
  getPromptLayers,
} from "../supabase/functions/generate/prompts/promptBuilder.ts";
import { generateInputSchema } from "../lib/validation/generation.ts";
import type { InputDTO } from "../supabase/functions/generate/validation/schema.ts";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const BASE = {
  platform: "instagram",
  contentType: "sponsored_ad",
  arabicStyle: "egyptian_colloquial",
  rawInput: "منتج جديد لتبييض الأسنان طبيعي وآمن",
} as const;

function makeInput(
  language: "ar" | "en" | "bilingual" | undefined,
  mode: "marketing" | "creator" | "personal_creator" = "marketing"
): InputDTO {
  if (mode === "marketing") {
    return { ...BASE, mode: "marketing", language } as unknown as InputDTO;
  }
  return { ...BASE, mode: "creator", language } as unknown as InputDTO;
}

// ---------------------------------------------------------------------------
// 1. Schema validation
// ---------------------------------------------------------------------------

describe("generateInputSchema — language field", () => {
  test("accepts language: ar", () => {
    const input = { ...BASE, mode: "marketing", language: "ar" };
    assert.doesNotThrow(() => generateInputSchema.parse(input));
  });

  test("accepts language: en", () => {
    const input = { ...BASE, mode: "marketing", language: "en" };
    assert.doesNotThrow(() => generateInputSchema.parse(input));
  });

  test("accepts language: bilingual", () => {
    const input = { ...BASE, mode: "marketing", language: "bilingual" };
    assert.doesNotThrow(() => generateInputSchema.parse(input));
  });

  test("accepts language: undefined (backward compat)", () => {
    const input = { ...BASE, mode: "marketing" };
    assert.doesNotThrow(() => generateInputSchema.parse(input));
  });

  test("rejects language: 'fr' (invalid value)", () => {
    const input = { ...BASE, mode: "marketing", language: "fr" };
    assert.throws(() => generateInputSchema.parse(input));
  });
});

// ---------------------------------------------------------------------------
// 2. Prompt Builder — language layer presence
// ---------------------------------------------------------------------------

describe("promptBuilder — language layer injection", () => {
  test("language: ar — produces LANGUAGE layer with Arabic instruction", () => {
    const prompt = buildSystemPrompt(makeInput("ar"));
    assert.ok(
      prompt.includes("<language>"),
      "Missing <language> tag for ar"
    );
    assert.ok(
      prompt.includes("Write strictly in Arabic"),
      "Missing Arabic instruction for language: ar"
    );
  });

  test("language: en — produces LANGUAGE layer with English instruction", () => {
    const prompt = buildSystemPrompt(makeInput("en"));
    assert.ok(
      prompt.includes("<language>"),
      "Missing <language> tag for en"
    );
    assert.ok(
      prompt.includes("Write entirely in English"),
      "Missing English instruction for language: en"
    );
  });

  test("language: bilingual — produces LANGUAGE layer with bilingual contract", () => {
    const prompt = buildSystemPrompt(makeInput("bilingual"));
    assert.ok(
      prompt.includes("<language>"),
      "Missing <language> tag for bilingual"
    );
    assert.ok(
      prompt.includes("Arabic for emotional") && prompt.includes("English only where technical"),
      "Missing bilingual instruction"
    );
  });

  test("language: undefined — no <language> tag, falls back to global rules", () => {
    const prompt = buildSystemPrompt(makeInput(undefined));
    // No explicit language override -> no <language> tag. global_rules handles it.
    assert.ok(
      !prompt.includes("<language>"),
      "Language tag should be absent for undefined language"
    );
    assert.ok(
      prompt.includes("DIALECT:"),
      "Dialect layer missing when language is undefined"
    );
  });
});

// ---------------------------------------------------------------------------
// 3. Arabic dialect suppression when language = "en"
// ---------------------------------------------------------------------------

describe("promptBuilder — arabicStyle suppression for language: en", () => {
  test("language: en suppresses the dialect layer", () => {
    const prompt = buildSystemPrompt(makeInput("en"));
    // DIALECT: should NOT appear when language is explicitly English
    assert.ok(
      !prompt.includes("DIALECT:"),
      "Dialect layer must NOT appear when language is en"
    );
  });

  test("language: ar preserves the dialect layer", () => {
    const prompt = buildSystemPrompt(makeInput("ar"));
    assert.ok(
      prompt.includes("DIALECT:"),
      "Dialect layer must appear when language is ar"
    );
  });

  test("language: bilingual preserves the dialect layer", () => {
    const prompt = buildSystemPrompt(makeInput("bilingual"));
    assert.ok(
      prompt.includes("DIALECT:"),
      "Dialect layer must appear when language is bilingual"
    );
  });
});

// ---------------------------------------------------------------------------
// 4. Layer ordering — language must come before dialect
// ---------------------------------------------------------------------------

describe("promptBuilder — language layer ordering", () => {
  test("language layer appears before dialect_and_tone layer", () => {
    const layers = getPromptLayers(makeInput("ar"));
    const langIdx = layers.findIndex((l) => l.tag === "language");
    const dialectIdx = layers.findIndex((l) => l.tag === "dialect_and_tone");
    assert.ok(langIdx !== -1, "language layer must exist");
    assert.ok(
      langIdx < dialectIdx || dialectIdx === -1,
      "language must come before dialect_and_tone"
    );
  });
});
