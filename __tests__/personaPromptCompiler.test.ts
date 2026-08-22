import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { buildSystemPrompt, buildUserPrompt, getPromptLayers } from "../lib/content/prompt/compiler";
import { getPersona } from "../lib/content/personas";

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
  styleConfig: { id: "mystery" },
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

    const personaName = getPersona("developer")?.name;
    assert.ok(personaName, "developer persona missing from registry");
    assert.ok(
      prompt.includes("<identity>developer</identity>"),
      "Persona layer must reference the persona id"
    );
    assert.ok(prompt.includes("النمط: mystery"), "Style layer must reference styleConfig.id");
  });

  test("user prompt delegates topic delivery to the conversation context", () => {
    assert.strictEqual(buildUserPrompt(), "Write the marketing content based on the provided context.");
  });
});
