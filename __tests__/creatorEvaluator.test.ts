import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { evaluateCreatorOutput } from "../lib/evaluation/creatorEvaluator";
import { normalizeGenerationConfig } from "../lib/content/normalizer";
import type { GenerationConfig, GeneratedContent } from "../types/content";

describe("Creator Evaluator & Genericness Metric", () => {
  const baseConfig: GenerationConfig = {
    mode: "creator",
    platform: "x",
    format: "thread",
    content: {
      type: "thread",
      topic: "لماذا أصعب أخطاء البرمجة تكون ناتجة عن افتراضات بسيطة",
    },
    objective: "awareness",
    creator: {
      persona: { id: "developer" },
      style: { id: "mystery" },
      intent: "insight",
      originality: "high",
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

  test("scores high on high-quality, authentic, cliché-free output", () => {
    const output: GeneratedContent = {
      title: "لغز الـ Bug الصامت",
      hook: "أصعب خطأ برمجي واجهته لم يكن في الكود المعقد، بل في سطر كان يبدو بديهياً جداً.",
      body: "المشكلة في البرمجة أننا نفترض أن الأنظمة تفهم نيتنا. الكود كان يعمل، لكن الافتراض في المنطق كان مقلوباً. المفارقة أن الحل لم يتطلب كتابة كود جديد بل حذف افتراض ساذج.",
      callToAction: "راجع افتراضاتك قبل أن تراجع أسطر الكود.",
      hashtags: ["برمجة", "هندسة_البرمجيات", "تطوير", "تقنية", "كود"],
    };

    const normalized = normalizeGenerationConfig(baseConfig);
    const result = evaluateCreatorOutput(output, normalized);

    assert.ok(result.passed);
    assert.strictEqual(result.genericnessScore, 100);
    assert.strictEqual(result.antiHallucinationScore, 100);
    assert.strictEqual(result.noEmojiScore, 100);
    assert.ok(result.overallScore >= 90);
  });

  test("penalizes cliché phrases and generic intros", () => {
    const output: GeneratedContent = {
      title: "البرمجة اليوم",
      hook: "في عالمنا المتسارع، لا يخفى على أحد أهمية البرمجة.",
      body: "يلعب دورا كبيرا في حياتنا ونتحدث اليوم عن الأخطاء.",
      callToAction: "شاركنا رأيك في التعليقات.",
      hashtags: ["برمجة", "تقنية", "تطوير", "معلومات", "نصائح"],
    };

    const normalized = normalizeGenerationConfig(baseConfig);
    const result = evaluateCreatorOutput(output, normalized);

    assert.ok(result.clicheMatches.length >= 2);
    assert.ok(result.genericnessScore < 60);
    assert.strictEqual(result.passed, false);
  });

  test("penalizes fake credential hallucination", () => {
    const output: GeneratedContent = {
      title: "خبرتي في الكود",
      hook: "بصفتي خبير برمجة درست في جامعة هارفارد وعملت لسنوات في جوجل.",
      body: "أخبركم عن سر الكود السليم.",
      callToAction: "تابع الحساب للمزيد.",
      hashtags: ["برمجة", "تقنية", "تطوير", "معلومات", "نصائح"],
    };

    const normalized = normalizeGenerationConfig(baseConfig);
    const result = evaluateCreatorOutput(output, normalized);

    assert.ok(result.hallucinationWarnings.length >= 2);
    assert.ok(result.antiHallucinationScore <= 50);
    assert.strictEqual(result.passed, false);
  });
});
