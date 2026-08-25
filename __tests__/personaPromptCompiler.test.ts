import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { buildSystemPrompt, buildUserPrompt, getPromptLayers } from "../lib/content/prompt/compiler";

const marketingInput = {
  mode: "marketing",
  platform: "linkedin",
  arabicStyle: "white_arabic",
  contentType: "social_post",
  marketingObjective: "leads",
  rawInput: "عرض خدمة استشارات تسويقية",
};

const creatorInput = {
  mode: "personal_creator",
  platform: "x",
  arabicStyle: "egyptian",
  contentType: "thread",
  rawInput: "لماذا أصعب أخطاء البرمجة تكون ناتجة عن افتراضات بسيطة",
  persona: {
    id: "developer",
    interests: ["البرمجة", "علم النفس المعرفي"],
    characteristics: ["تحليلي", "مستبصر"],
  },
  style: { name: "mystery" },
};

describe("Prompt Compiler - Layer Architecture", () => {
  test("marketing mode excludes persona and style layers", () => {
    const layers = getPromptLayers(marketingInput as never);
    const tags = layers.map((l) => l.tag);

    assert.ok(tags.includes("global_rules"), "Missing global_rules layer");
    assert.ok(tags.includes("platform_context"), "Missing platform_context layer");
    assert.ok(tags.includes("marketing_objective"), "Missing marketing_objective layer");
    assert.ok(!tags.includes("persona"), "persona layer must not appear in marketing mode");
    assert.ok(!tags.includes("style"), "style layer must not appear in marketing mode");
  });

  test("system prompt enforces Arabic output in every mode", () => {
    const marketing = buildSystemPrompt(marketingInput as never);
    const creator = buildSystemPrompt(creatorInput as never);

    assert.ok(marketing.includes("Write strictly in Arabic"), "Missing language rule (marketing)");
    assert.ok(creator.includes("Write strictly in Arabic"), "Missing language rule (creator)");
  });

  test("personal_creator mode injects persona and style layers", () => {
    const prompt = buildSystemPrompt(creatorInput as never);
    const tags = getPromptLayers(creatorInput as never).map((l) => l.tag);

    assert.ok(tags.includes("persona"), "Missing persona layer in creator mode");
    assert.ok(tags.includes("style"), "Missing style layer in creator mode");

    assert.ok(
      prompt.includes("<identity>developer</identity>"),
      "Persona layer must reference the persona id"
    );
    assert.ok(prompt.includes("النمط: mystery"), "Style layer must reference style name");
  });

  test("persona layer DOES NOT carry perspective constraint by default (rejected in EXP-005)", () => {
    const prompt = buildSystemPrompt(creatorInput as never);
    assert.ok(!prompt.includes("<reasoning_contract>"), "v2 reasoning contract must NOT be injected by default");
  });

  test("usePerspectiveConstraint=true explicitly enables injection", () => {
    const input = {
      ...creatorInput,
      persona: { ...creatorInput.persona, usePerspectiveConstraint: true },
    };
    const prompt = buildSystemPrompt(input as never);
    assert.ok(prompt.includes("<reasoning_contract>"), "constraint must be injected when explicitly requested");
    assert.ok(prompt.includes("<identity>developer</identity>"), "persona layer itself must remain");
  });

  test("unknown persona id gets no constraint but keeps the layer", () => {
    const input = { ...creatorInput, persona: { id: "unknown_persona" } };
    const prompt = buildSystemPrompt(input as never);
    assert.ok(!prompt.includes("<reasoning_contract>"));
    assert.ok(prompt.includes("<identity>unknown_persona</identity>"));
  });

  test("SAWWIQ_PERSPECTIVE_OFF=1 disables injection globally", () => {
    const previous = process.env.SAWWIQ_PERSPECTIVE_OFF;
    process.env.SAWWIQ_PERSPECTIVE_OFF = "1";
    try {
      const prompt = buildSystemPrompt(creatorInput as never);
      assert.ok(!prompt.includes("<reasoning_contract>"), "env toggle must remove constraint");
      assert.ok(!prompt.includes("<perspective_constraint>"), "env toggle must also remove v1 blocks");
    } finally {
      if (previous === undefined) delete process.env.SAWWIQ_PERSPECTIVE_OFF;
      else process.env.SAWWIQ_PERSPECTIVE_OFF = previous;
    }
  });

  test("string persona and string style inputs are normalized", () => {
    const input = {
      mode: "personal_creator",
      platform: "linkedin",
      contentType: "social_post",
      arabicStyle: "white_arabic",
      rawInput: "موضوع",
      metadata: { persona: "psychology", style: "storytelling", intent: "education" },
    };
    const tags = getPromptLayers(input as never).map((l) => l.tag);
    assert.ok(tags.includes("persona"), "string persona must produce a persona layer");
    assert.ok(tags.includes("style"), "string style must produce a style layer");
    assert.ok(tags.includes("intent"), "metadata.intent must be hoisted");

    const prompt = buildSystemPrompt(input as never);
    assert.ok(prompt.includes("<identity>psychology</identity>"));
    assert.ok(prompt.includes("النمط: storytelling"));
    assert.ok(!prompt.includes("<reasoning_contract>"), "string persona defaults to OFF");
  });

  test("user prompt delegates topic delivery to the conversation context", () => {
    assert.strictEqual(
      buildUserPrompt(),
      "اكتب المحتوى التسويقي بناءً على معلومات المستخدم المقدمة في سياق المحادثة."
    );
  });
});
