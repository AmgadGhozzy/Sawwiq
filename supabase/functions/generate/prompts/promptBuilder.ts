import { PLATFORM_RULES } from "./platforms.ts";
import { DIALECT_RULES } from "./dialects.ts";
import { CONTENT_TYPE_RULES } from "./contentTypes.ts";
import type { InputDTO } from "../validation/schema.ts";

interface PromptLayer {
  label: string;
  content: string;
}

function buildGlobalRulesLayer(): PromptLayer {
  return {
    label: "Global Rules",
    content: `
# قواعد عامة للكتابة التسويقية

أنت كاتب محتوى تسويقي عربي محترف. مهمتك تحويل معلومات أولية إلى محتوى تسويقي عالي الجودة.

## قواعد أساسية:
1. اكتب بالعربية فقط — تجنب الكلمات الإنجليزية إلا إذا كانت أسماء علامات تجارية أو مصطلحات تقنية لا بديل عربي لها (مثل Sprints).
2. لا تخترع أي معلومة واقعية لم يقدمها المستخدم — هذا ليس اقتراحًا، هذا قانون.
3. إذا لم تُذكر معلومة (مثل السعر أو الموقع الدقيق)، لا تذكرها في المحتوى.
4. ركّز على القيمة الحقيقية من منظور العميل.
5. تجنب الحشو والجمل العامة التي لا تضيف معلومة.
6. كل جملة يجب أن تخدم هدفًا واضحًا.
7. حافظ على ذكر المميزات الهامة والأسماء الخاصة (مثل: أسانسير، Sprints) كما وردت بنفس لغتها الأصلية، ولا تقم بحذفها أو ترجمتها إذا كانت محورية.

## ممنوع:
- ترجمات حرفية أو أسلوب روبوتي
- عبارات ذكاء اصطناعي نمطية
- إيموجي مبالغ فيها
- ادعاءات مبالغ فيها بدون دليل
- إلحاح مصطنع
- تكرار نفس بنية الجمل
- عبارات مثل "أفضل منتج في العالم" أو "لا مثيل له" أو "فرصة لا تعوض" إلا إذا قدم المستخدم ما يدعم ذلك

## أمثلة على الادعاءات غير المسموحة
لا تحوّل: "مناسب للاستثمار"
إلى: "يحقق عائدًا مضمونًا."

لا تحوّل: "يحتوي على مميزات متعددة"
إلى: "أفضل من المنتجات المنافسة."

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

function buildPlatformLayer(platform: string): PromptLayer | null {
  const rule = PLATFORM_RULES[platform];
  if (!rule) return null;
  return {
    label: `Platform: ${platform}`,
    content: `## قواعد المنصة المستهدفة\n\nSTRICT RULE: ${rule}`,
  };
}

function buildArabicStyleLayer(style: string): PromptLayer | null {
  const rule = DIALECT_RULES[style];
  if (!rule) return null;
  return {
    label: `Arabic Style: ${style}`,
    content: rule,
  };
}

function buildContentTypeLayer(type: string): PromptLayer | null {
  const rule = CONTENT_TYPE_RULES[type]?.systemInstructions;
  if (!rule) return null;
  return {
    label: `Content Type: ${type}`,
    content: rule,
  };
}

const marketingObjectiveRules: Record<string, string> = {
  sell: "الهدف: إقناع القارئ بالشراء أو التواصل للشراء.",
  attract_messages: "الهدف: تشجيع القارئ على إرسال رسالة أو استفسار.",
  drive_traffic: "الهدف: تحفيز القارئ على زيارة رابط أو صفحة.",
  launch_product: "الهدف: بناء حماس حول إطلاق منتج جديد.",
  build_trust: "الهدف: بناء ثقة في العلامة التجارية أو المنتج.",
  generate_leads: "الهدف: جمع بيانات العملاء المحتملين.",
};

function buildMarketingObjectiveLayer(objective?: string): PromptLayer | null {
  if (!objective) return null;
  const rule = marketingObjectiveRules[objective];
  if (!rule) return null;
  
  return {
    label: `Marketing Objective: ${objective}`,
    content: `\n## الهدف التسويقي\n\n${rule}\n`,
  };
}

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

function buildOutputContractLayer(): PromptLayer {
  return {
    label: "Output Contract",
    content: `
## متطلبات المحتوى

أنتج الحقول المطلوبة وفق المخطط.
لا تضف أي تعليمات برمجية للـ JSON، فقط التزم بالشروط الدلالية التالية:

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

export function getPromptLayers(input: InputDTO): PromptLayer[] {
  const layers: (PromptLayer | null)[] = [
    buildGlobalRulesLayer(),
    buildPlatformLayer(input.platform),
    buildArabicStyleLayer(input.arabicStyle),
    buildContentTypeLayer(input.contentType),
    buildMarketingObjectiveLayer(input.marketingObjective),
    buildInputContextLayer(input.rawInput),
    buildFactBoundaryLayer(),
    buildOutputContractLayer(),
  ];
  return layers.filter((layer): layer is PromptLayer => layer !== null);
}

export function buildSystemPrompt(input: InputDTO): string {
  return getPromptLayers(input)
    .map((layer) => layer.content)
    .join("\n\n---\n\n");
}

export function buildUserPrompt(): string {
  return "اكتب المحتوى التسويقي بناءً على معلومات المستخدم المقدمة في سياق المحادثة.";
}
