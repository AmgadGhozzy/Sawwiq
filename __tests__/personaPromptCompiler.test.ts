import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { compilePrompt } from "../lib/content/prompt/compiler";
import { normalizeGenerationConfig } from "../lib/content/normalizer";
import type { GenerationConfig } from "../types/content";

describe("Prompt Compiler with Persona & Style Layers", () => {
  test("compiles prompt without persona in marketing mode", () => {
    const config: GenerationConfig = {
      mode: "marketing",
      platform: "linkedin",
      format: "text_post",
      content: {
        type: "social_post",
        topic: "عرض خدمة استشارات تسويقية",
      },
      objective: "leads",
      language: {
        language: "ar",
        dialect: "white_arabic",
      },
      voice: {
        tone: "professional",
        style: "direct_response",
      },
      constraints: {},
    };

    const normalized = normalizeGenerationConfig(config);
    const prompt = compilePrompt(normalized);

    assert.ok(prompt.includes("قواعد عامة للكتابة التسويقية"));
    assert.ok(prompt.includes("قواعد المنصة المستهدفة"));
    assert.ok(prompt.includes("الهدف التسويقي"));
    assert.ok(!prompt.includes("منظور الكاتب وهويته"));
  });

  test("compiles prompt with Persona and Style layers in personal_creator mode", () => {
    const config: GenerationConfig = {
      mode: "personal_creator",
      platform: "x",
      format: "thread",
      content: {
        type: "thread",
        topic: "لماذا أصعب أخطاء البرمجة تكون ناتجة عن افتراضات بسيطة وليس تعقيد الكود",
      },
      objective: "awareness",
      persona: {
        id: "developer",
        interests: ["البرمجة", "علم النفس المعرفي"],
        characteristics: ["تحليلي", "مستبصر"],
      },
      styleConfig: {
        id: "mystery",
      },
      language: {
        language: "ar",
        dialect: "egyptian",
      },
      voice: {
        tone: "casual",
        style: "storytelling",
      },
      constraints: {},
    };

    const normalized = normalizeGenerationConfig(config);
    const prompt = compilePrompt(normalized);

    assert.ok(prompt.includes("Creator Persona"));
    assert.ok(prompt.includes("المبرمج والتقني"));
    assert.ok(prompt.includes("الغموض والمفارقة"));
    assert.ok(prompt.includes("Content Style"));
    assert.ok(prompt.includes("قاعدة: استخدم الشخصية كعدسة لتأطير الموضوع"));
  });
});
