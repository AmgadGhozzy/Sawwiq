// ---------------------------------------------------------------------------
// Evaluation Engine — two-level quality measurement
//
// Level 1: Deterministic (code-only, no API calls)
//   Schema, content lengths, hashtag rules, mustContain/mustNotContain,
//   structural hygiene (HTML, Markdown, JSON artifacts).
//
// Level 2: Semantic (LLM-as-judge, requires API call)
//   Factuality, dialect accuracy, marketing quality, readability,
//   hook/CTA quality, hallucination safety.
//
// Scoring gate:
//   If deterministic.passed === false → combinedScore = 0
//   Else → combinedScore = deterministic.score * 0.4 + semantic.overall * 0.6
//   If no semantic evaluation → combinedScore = deterministic.score
// ---------------------------------------------------------------------------

import { GoogleGenAI, Type } from "@google/genai";
import { z } from "zod";
import type { GeneratedContent, ArabicStyle, ContentType } from "@/types/content";

const ARABIC_STYLE_LABELS: Record<ArabicStyle, string> = {
  saudi_marketing: "سعودي تسويقي",
  gulf_premium: "خليجي فخم",
  egyptian_colloquial: "مصري عامية",
  white_arabic: "عربية بيضاء",
  formal_b2b: "فصحى أعمال",
};

const CONTENT_TYPE_LABELS: Record<ContentType, string> = {
  sponsored_ad: "إعلان ممول",
  interactive_post: "منشور تفاعلي",
  ecommerce_product: "وصف منتج",
  real_estate: "وصف عقار",
  short_video_script: "سكريبت فيديو",
  marketing_email: "إيميل تسويقي",
};
import type {
  TestCaseExpectations,
  DeterministicScore,
  DeterministicCheck,
  SemanticScore,
} from "./types";


// ---------------------------------------------------------------------------
// Arabic Text Normalization — orthographic normalization only, NOT stemming.
// Handles alef variants, taa marbuta, and kashida for substring matching.
// ---------------------------------------------------------------------------

function normalizeArabicText(text: string): string {
  return text
    .normalize("NFKC")
    .replace(/[أإآٱ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/ؤ/g, "و")
    .replace(/ئ/g, "ي")
    .replace(/ـ/g, "")
    .toLowerCase()
    .trim();
}
// ---------------------------------------------------------------------------
// Level 1 — Deterministic Evaluator (pure function)
// ---------------------------------------------------------------------------

export function evaluateDeterministic(
  output: GeneratedContent,
  expectations?: TestCaseExpectations
): DeterministicScore {
  const checks: DeterministicCheck[] = [];

  // 1. Fields present with meaningful content
  checks.push({
    name: "fieldsPresent",
    passed:
      output.title.length > 0 &&
      output.hook.length > 0 &&
      output.body.length > 0 &&
      output.callToAction.length > 0 &&
      output.hashtags.length > 0,
  });

  // 2. Meaningful content length (not just "abc")
  checks.push({
    name: "contentLength",
    passed:
      output.title.length > 3 &&
      output.hook.length > 5 &&
      output.body.length > 20 &&
      output.callToAction.length > 3,
  });

  // 3. Hashtag count
  const minH = expectations?.minHashtags ?? 5;
  const maxH = expectations?.maxHashtags ?? 8;
  checks.push({
    name: "hashtagCount",
    passed:
      output.hashtags.length >= minH && output.hashtags.length <= maxH,
    detail:
      output.hashtags.length < minH || output.hashtags.length > maxH
        ? `${output.hashtags.length} هاشتاغ (المطلوب ${minH}-${maxH})`
        : undefined,
  });

  // 4. Hashtags clean — no #
  checks.push({
    name: "hashtagsNoHash",
    passed: output.hashtags.every((t) => !t.includes("#")),
    detail: output.hashtags.some((t) => t.includes("#"))
      ? `هاشتاغات تحتوي #: ${output.hashtags.filter((t) => t.includes("#")).join(", ")}`
      : undefined,
  });

  // 5. Hashtags unique
  const uniqueSet = new Set(output.hashtags.map((t) => t.trim()));
  checks.push({
    name: "hashtagsUnique",
    passed: uniqueSet.size === output.hashtags.length,
    detail:
      uniqueSet.size !== output.hashtags.length
        ? `${output.hashtags.length - uniqueSet.size} هاشتاغ مكرر`
        : undefined,
  });

  // 6. No HTML
  const fullText = `${output.title} ${output.hook} ${output.body} ${output.callToAction}`;
  checks.push({
    name: "noHtml",
    passed: !/<[a-z][^>]*>/i.test(fullText),
  });

  // 7. No Markdown artifacts
  checks.push({
    name: "noMarkdown",
    passed: !/^#{1,6}\s/m.test(fullText) && !/```/.test(fullText),
  });

  // 8. No JSON artifacts
  checks.push({
    name: "noJsonArtifacts",
    passed: !/\{"/.test(fullText) && !/"\}/.test(fullText),
  });

  // 9. mustContain (with Arabic orthographic normalization and OR support via "|")
  if (expectations?.mustContain && expectations.mustContain.length > 0) {
    const normalizedFullText = normalizeArabicText(fullText);
    const missing = expectations.mustContain.filter((s) => {
      const options = s.split("|").map(opt => normalizeArabicText(opt.trim()));
      return !options.some(opt => normalizedFullText.includes(opt));
    });
    checks.push({
      name: "mustContain",
      passed: missing.length === 0,
      detail:
        missing.length > 0
          ? `مفقود: ${missing.join("، ")}`
          : undefined,
    });
  }

  // 10. mustNotContain (with Arabic orthographic normalization)
  if (expectations?.mustNotContain && expectations.mustNotContain.length > 0) {
    const normalizedFullText = normalizeArabicText(fullText);
    const found = expectations.mustNotContain.filter((s) =>
      normalizedFullText.includes(normalizeArabicText(s))
    );
    checks.push({
      name: "mustNotContain",
      passed: found.length === 0,
      detail:
        found.length > 0
          ? `موجود: ${found.join("، ")}`
          : undefined,
    });
  }

  const passedCount = checks.filter((c) => c.passed).length;
  const totalCount = checks.length;
  const score = Math.round((passedCount / totalCount) * 100);

  return {
    checks,
    score,
    passed: checks.every((c) => c.passed),
    details: checks
      .filter((c) => !c.passed)
      .map((c) => `❌ ${c.name}${c.detail ? `: ${c.detail}` : ""}`),
  };
}

// ---------------------------------------------------------------------------
// Level 2 — Semantic Evaluator (LLM-as-judge)
// ---------------------------------------------------------------------------

const semanticScoreSchema = z.object({
  factuality: z.number().min(0).max(100),
  dialectAccuracy: z.number().min(0).max(100),
  marketingQuality: z.number().min(0).max(100),
  readability: z.number().min(0).max(100),
  hookQuality: z.number().min(0).max(100),
  ctaQuality: z.number().min(0).max(100),
  hallucinationSafety: z.number().min(0).max(100),
  overall: z.number().min(0).max(100),
  violations: z.array(z.string()),
});

const semanticJudgeGeminiSchema = {
  type: Type.OBJECT,
  properties: {
    factuality: {
      type: Type.NUMBER,
      description: "دقة الحقائق: هل المحتوى يلتزم فقط بمعلومات المستخدم (0-100)",
    },
    dialectAccuracy: {
      type: Type.NUMBER,
      description: "دقة اللهجة: هل الأسلوب مطابق للمطلوب ويبدو طبيعيًا (0-100)",
    },
    marketingQuality: {
      type: Type.NUMBER,
      description: "جودة تسويقية: هل المحتوى مقنع ويركز على القيمة والفوائد (0-100)",
    },
    readability: {
      type: Type.NUMBER,
      description: "سهولة القراءة: هل المحتوى منظم وسهل القراءة (0-100)",
    },
    hookQuality: {
      type: Type.NUMBER,
      description: "جودة الافتتاحية: هل تشد الانتباه فعلًا (0-100)",
    },
    ctaQuality: {
      type: Type.NUMBER,
      description: "جودة دعوة العمل: هل واضحة ومحفزة (0-100)",
    },
    hallucinationSafety: {
      type: Type.NUMBER,
      description: "أمان من الهلوسة: 100=آمن تمامًا، 0=اختراع كامل (0-100)",
    },
    overall: {
      type: Type.NUMBER,
      description: "التقييم العام الشامل (0-100)",
    },
    violations: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: "قائمة بأي مخالفات لمعايير التقييم",
    },
  },
  required: [
    "factuality",
    "dialectAccuracy",
    "marketingQuality",
    "readability",
    "hookQuality",
    "ctaQuality",
    "hallucinationSafety",
    "overall",
    "violations",
  ],
};

function buildJudgePrompt(
  output: GeneratedContent,
  rawInput: string,
  contentType: ContentType,
  arabicStyle: ArabicStyle,
  criteria: string[]
): string {
  return `
أنت مقيّم جودة محتوى تسويقي عربي. مهمتك تقييم المحتوى المُنتج بموضوعية صارمة.

## المدخلات الأصلية

نوع المحتوى: ${CONTENT_TYPE_LABELS[contentType]}
الأسلوب اللغوي: ${ARABIC_STYLE_LABELS[arabicStyle]}

<user_input>
${rawInput}
</user_input>

## معايير التقييم المحددة
${criteria.map((c, i) => `${i + 1}. ${c}`).join("\n")}

## المحتوى المُنتج للتقييم

العنوان: ${output.title}
الافتتاحية: ${output.hook}
المحتوى: ${output.body}
دعوة العمل: ${output.callToAction}
الهاشتاغات: ${output.hashtags.join("، ")}

## تعليمات التقييم

قيّم المحتوى على كل محور من 0 إلى 100:

- factuality: هل المحتوى يلتزم فقط بالمعلومات المقدمة؟ أي معلومة غير موجودة في المدخلات تعتبر خصمًا.
- dialectAccuracy: هل الأسلوب مطابق للهجة المطلوبة (${ARABIC_STYLE_LABELS[arabicStyle]})؟ هل يبدو طبيعيًا وليس مصطنعًا؟
- marketingQuality: هل المحتوى مقنع تسويقيًا؟ هل يركز على القيمة والفوائد بدل سرد المواصفات؟
- readability: هل المحتوى منظم وسهل القراءة السريعة؟ هل الفقرات قصيرة؟
- hookQuality: هل الافتتاحية تشد الانتباه فعلًا وتحفز إكمال القراءة؟
- ctaQuality: هل دعوة العمل واضحة ومحفزة وقابلة للتنفيذ؟
- hallucinationSafety: هل المحتوى آمن من الادعاءات غير المدعومة؟ (100 = آمن تمامًا، 0 = اختراع كامل)
- overall: التقييم العام — متوسط مرجح يأخذ في الاعتبار أهمية كل محور.
- violations: قائمة بأي مخالفات ملحوظة (مصفوفة فارغة إذا لم توجد).

كن صارمًا وموضوعيًا. لا تمنح درجات عالية إلا إذا كان المحتوى يستحقها فعلًا.
`.trim();
}

/**
 * Evaluate generated content semantically using an LLM judge.
 *
 * Returns null if the judge call fails (transient API errors should not
 * break the benchmark).
 */
export async function evaluateSemantic(
  output: GeneratedContent,
  rawInput: string,
  contentType: ContentType,
  arabicStyle: ArabicStyle,
  criteria: string[]
): Promise<SemanticScore | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;

  const model = process.env.GEMINI_MODEL ?? "gemini-3.1-flash-lite";

  try {
    const client = new GoogleGenAI({ apiKey });

    const judgePrompt = buildJudgePrompt(
      output,
      rawInput,
      contentType,
      arabicStyle,
      criteria
    );

    const response = await client.models.generateContent({
      model,
      contents: judgePrompt,
      config: {
        systemInstruction:
          "أنت مقيّم جودة محتوى. أجب فقط بالتقييم الرقمي المطلوب وفق المخطط المحدد. لا تضف شرحًا.",
        responseMimeType: "application/json",
        responseSchema: semanticJudgeGeminiSchema,
        temperature: 0.1, // Low temperature for consistent evaluation
      },
    });

    const text = response.text;
    if (!text) return null;

    const parsed = JSON.parse(text);
    // Even the judge gets Zod-validated.
    return semanticScoreSchema.parse(parsed);
  } catch (err) {
    console.error(
      "  ⚠️  Semantic evaluation failed:",
      err instanceof Error ? err.message : String(err)
    );
    return null;
  }
}

// ---------------------------------------------------------------------------
// Combined Score
// ---------------------------------------------------------------------------

/**
 * Compute the combined score with structural gate.
 *
 * If deterministic evaluation fails → combined = 0 (structural gate).
 * If no semantic score → combined = deterministic.score.
 * Otherwise → 40% deterministic + 60% semantic.
 */
export function computeCombinedScore(
  deterministic: DeterministicScore,
  semantic?: SemanticScore | null
): number {
  if (!deterministic.passed) return 0;
  if (!semantic) return deterministic.score;

  return Math.round(
    deterministic.score * 0.4 + semantic.overall * 0.6
  );
}
