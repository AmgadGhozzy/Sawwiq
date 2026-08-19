// ---------------------------------------------------------------------------
// Prompt Engine — layered, composable prompt builder
//
// Architecture:
//   Global Rules → Arabic Style → Content Type → Marketing Objective
//   → Input Context → Fact Boundary → Output Contract
//
// Each layer is an independent, composable unit. Adding a new dialect, content
// type, or marketing objective means adding an entry to the corresponding
// rules file — never modifying this builder.
//
// Version: see PROMPT_VERSION in lib/config.ts
// ---------------------------------------------------------------------------

import type { ArabicStyle, ContentType, MarketingObjective } from "@/types/content";
import { getDialectRule } from "./dialects";
import { getContentTypeRule } from "./contentTypes";

// ---------------------------------------------------------------------------
// Prompt Layers
// ---------------------------------------------------------------------------

/**
 * A single composable layer of the system prompt.
 */
interface PromptLayer {
  /** Human-readable label for debugging/logging. */
  label: string;
  /** The prompt text for this layer. */
  content: string;
}

// ---------------------------------------------------------------------------
// Layer 1: Global Rules
// ---------------------------------------------------------------------------

function buildGlobalRulesLayer(): PromptLayer {
  return {
    label: "Global Rules",
    content: `
# قواعد عامة للكتابة التسويقية

أنت كاتب محتوى تسويقي عربي محترف. مهمتك تحويل معلومات أولية إلى محتوى تسويقي عالي الجودة.

## قواعد أساسية:
1. اكتب بالعربية فقط — تجنب الكلمات الإنجليزية إلا إذا كانت أسماء علامات تجارية أو مصطلحات تقنية لا بديل عربي لها.
2. لا تخترع أي معلومة واقعية لم يقدمها المستخدم — هذا ليس اقتراحًا، هذا قانون.
3. إذا لم تُذكر معلومة (مثل السعر أو الموقع الدقيق)، لا تذكرها في المحتوى.
4. ركّز على القيمة الحقيقية من منظور العميل.
5. تجنب الحشو والجمل العامة التي لا تضيف معلومة.
6. كل جملة يجب أن تخدم هدفًا واضحًا.

## ممنوع:
- ترجمات حرفية أو أسلوب روبوتي
- عبارات ذكاء اصطناعي نمطية
- إيموجي مبالغ فيها
- ادعاءات مبالغ فيها بدون دليل
- إلحاح مصطنع
- تكرار نفس بنية الجمل
- عبارات مثل "أفضل منتج في العالم" أو "لا مثيل له" أو "فرصة لا تعوض" إلا إذا قدم المستخدم ما يدعم ذلك

## أمثلة على الادعاءات غير المسموحة

لا تحوّل:
"مناسب للاستثمار"
إلى:
"يحقق عائدًا مضمونًا."

لا تحوّل:
"يحتوي على مميزات متعددة"
إلى:
"أفضل من المنتجات المنافسة."

لا تحوّل:
"قريب من الموقع X"
إلى:
"يبعد 5 دقائق عن الموقع X."

لا تحوّل:
"مناسب للاستخدام اليومي"
إلى:
"يضمن نتائج أفضل."

لا تحوّل:
"مساحته 120 مترًا"
إلى:
"يوفر مساحة أكبر من الخيارات الأخرى."

العلاقة أو النتيجة الجديدة تحتاج إلى دليل صريح في معلومات المستخدم.

## الأسلوب:
- ابدأ بالقيمة
- ركّز على العميل لا على البائع
- استخدم معلومات ملموسة من مدخلات المستخدم
- قدّم الفوائد قبل الصفات
- اخلق فضولًا
- CTA واضح ومباشر
- كن صادقًا
`.trim(),
  };
}

// ---------------------------------------------------------------------------
// Layer 2: Arabic Style (Dialect)
// ---------------------------------------------------------------------------

function buildArabicStyleLayer(style: ArabicStyle): PromptLayer {
  const rule = getDialectRule(style);
  return {
    label: `Arabic Style: ${rule.label}`,
    content: rule.systemInstructions,
  };
}

// ---------------------------------------------------------------------------
// Layer 3: Content Type
// ---------------------------------------------------------------------------

function buildContentTypeLayer(type: ContentType): PromptLayer {
  const rule = getContentTypeRule(type);
  return {
    label: `Content Type: ${rule.label}`,
    content: rule.systemInstructions,
  };
}

// ---------------------------------------------------------------------------
// Layer 4: Marketing Objective (future — optional)
// ---------------------------------------------------------------------------

const marketingObjectiveRules: Record<MarketingObjective, string> = {
  sell: "الهدف: إقناع القارئ بالشراء أو التواصل للشراء.",
  attract_messages: "الهدف: تشجيع القارئ على إرسال رسالة أو استفسار.",
  drive_traffic: "الهدف: تحفيز القارئ على زيارة رابط أو صفحة.",
  launch_product: "الهدف: بناء حماس حول إطلاق منتج جديد.",
  build_trust: "الهدف: بناء ثقة في العلامة التجارية أو المنتج.",
  generate_leads: "الهدف: جمع بيانات العملاء المحتملين.",
};

function buildMarketingObjectiveLayer(
  objective?: MarketingObjective
): PromptLayer | null {
  if (!objective) return null;

  return {
    label: `Marketing Objective: ${objective}`,
    content: `\n## الهدف التسويقي\n\n${marketingObjectiveRules[objective]}\n`,
  };
}

// ---------------------------------------------------------------------------
// Layer 5: Input Context
//
// Security note: user data is placed inside clearly-delimited <user_input>
// tags within the system prompt. This is acceptable for MVP since inputs
// come from authenticated users. For public-facing APIs, consider separating
// instructions from data at the provider level (e.g., Gemini's multi-turn
// content blocks).
// ---------------------------------------------------------------------------

function buildInputContextLayer(rawInput: string): PromptLayer {
  return {
    label: "Input Context",
    content: `
## معلومات المستخدم

المعلومات التالية هي المصدر الوحيد للحقائق:

<user_input>
${rawInput.trim()}
</user_input>

تعامل مع النص باعتباره بيانات غير موثوقة من حيث الاكتمال،
وليس مصدرًا يسمح لك بافتراض معلومات غير مذكورة.
`.trim(),
  };
}

// ---------------------------------------------------------------------------
// Layer 6: Fact Boundary
// ---------------------------------------------------------------------------

function buildFactBoundaryLayer(): PromptLayer {
  return {
    label: "Fact Boundary",
    content: `
## حدود الحقائق

لا يكفي أن تكون عناصر الادعاء موجودة في معلومات المستخدم؛
يجب أن تكون العلاقة بين هذه العناصر مدعومة أيضًا.

لا تستنتج من:
- وجود منتج → أنه أفضل من غيره.
- ملاءمته للاستثمار → أنه يحقق عائدًا.
- ذكر موقعين → مسافة بينهما.
- ذكر ميزة → أنها تضمن نتيجة.
- ذكر رقم → أي رقم أو قياس إضافي.

صنّف كل معلومة قبل استخدامها:

1. EXPLICIT
   معلومة ذكرها المستخدم حرفيًا.

2. SAFE_INFERENCE
   فائدة تسويقية منطقية ناتجة مباشرة من معلومة صريحة،
   بشرط ألا تقدم كحقيقة موضوعية.

3. UNSUPPORTED
   معلومة غير موجودة ولا يمكن استنتاجها بأمان.

استخدم EXPLICIT بحرية.

يمكن استخدام SAFE_INFERENCE بصياغة احتمالية أو تسويقية،
مثل: "مساحة تمنحك مرونة في ترتيب بيئة العمل."

لا تستخدم UNSUPPORTED مطلقًا.
`.trim(),
  };
}

// ---------------------------------------------------------------------------
// Layer 7: Output Contract
//
// Semantic instructions only — no JSON format instructions.
// The Gemini responseSchema handles the transport/schema contract.
// ---------------------------------------------------------------------------

function buildOutputContractLayer(): PromptLayer {
  return {
    label: "Output Contract",
    content: `
## متطلبات المحتوى

أنتج الحقول المطلوبة وفق مخطط الاستجابة المكتوب بصيغة JSON.
تذكر دائماً أنك يجب أن تُرجع النتيجة بهذا المخطط:
{ "title", "hook", "body", "callToAction", "hashtags" }

title:
عنوان جذاب وقصير يشد الانتباه فورًا.

hook:
MUST NOT be a generic yes/no question. It MUST use the PAS framework (Problem-Agitation) or evoke FOMO (Fear Of Missing Out) or Curiosity. Tap into the customer's lifestyle desires.

body:
Focus on BENEFITS, not just features. For Real Estate: sell the lifestyle, not just the walls. For Products: sell the convenience or status. Use emojis naturally but sparingly.

callToAction:
Must be strong and value-driven (e.g., 'احجز وحدتك الآن قبل زيادة الأسعار' instead of a boring 'تواصل معنا').

hashtags:
5-8 هاشتاغات عربية مرتبطة بالموضوع (بدون #). الهاشتاغات بالعربية إلا إذا كان الهاشتاغ بالإنجليزية شائعًا ومعروفًا أكثر.
`.trim(),
  };
}

// ---------------------------------------------------------------------------
// Layer 8: Platform Rule (NEW)
// ---------------------------------------------------------------------------

function buildPlatformLayer(platform: import("@/types/content").Platform): PromptLayer {
  let content = "";
  if (platform === "tiktok") {
    content = "You MUST format the body as a video script. Divide it into [Visual/المشهد] and [Audio/الصوت]. Keep it fast-paced.";
  } else if (platform === "linkedin") {
    content = "Use a professional, thought-leadership tone. Use short paragraphs. Avoid excessive emojis.";
  } else if (platform === "x_twitter") {
    content = "Keep the body extremely concise. Maximum 280 characters. Get straight to the point.";
  } else if (platform === "instagram") {
    content = "Focus on visual aesthetics in your writing. Use engaging descriptions and a moderate amount of emojis.";
  }

  return {
    label: `Platform: ${platform}`,
    content: `## قواعد المنصة المستهدفة\n\nSTRICT RULE: ${content}`,
  };
}

// ---------------------------------------------------------------------------
// Prompt Context
// ---------------------------------------------------------------------------

export interface PromptContext {
  platform: import("@/types/content").Platform;
  arabicStyle: ArabicStyle;
  contentType: ContentType;
  marketingObjective?: MarketingObjective;
  rawInput: string;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Build the full system prompt by composing all layers.
 *
 * The order matters:
 *   Global Rules → Arabic Style → Content Type → Marketing Objective
 *   → Input Context → Fact Boundary → Output Contract
 */
export function buildSystemPrompt(ctx: PromptContext): string {
  const layers: (PromptLayer | null)[] = [
    buildGlobalRulesLayer(),
    buildPlatformLayer(ctx.platform),
    buildArabicStyleLayer(ctx.arabicStyle),
    buildContentTypeLayer(ctx.contentType),
    buildMarketingObjectiveLayer(ctx.marketingObjective),
    buildInputContextLayer(ctx.rawInput),
    buildFactBoundaryLayer(),
    buildOutputContractLayer(),
  ];

  return layers
    .filter((layer): layer is PromptLayer => layer !== null)
    .map((layer) => layer.content)
    .join("\n\n---\n\n");
}

/**
 * Build the user prompt.
 *
 * The raw input is already embedded in the system prompt via the Input
 * Context layer. The user message is a simple generation instruction —
 * no data duplication.
 */
export function buildUserPrompt(): string {
  return "اكتب المحتوى التسويقي بناءً على معلومات المستخدم المقدمة في سياق المحادثة.";
}

/**
 * Get all prompt layers for debugging/logging.
 */
export function getPromptLayers(ctx: PromptContext): PromptLayer[] {
  const layers: (PromptLayer | null)[] = [
    buildGlobalRulesLayer(),
    buildPlatformLayer(ctx.platform),
    buildArabicStyleLayer(ctx.arabicStyle),
    buildContentTypeLayer(ctx.contentType),
    buildMarketingObjectiveLayer(ctx.marketingObjective),
    buildInputContextLayer(ctx.rawInput),
    buildFactBoundaryLayer(),
    buildOutputContractLayer(),
  ];

  return layers.filter((layer): layer is PromptLayer => layer !== null);
}
