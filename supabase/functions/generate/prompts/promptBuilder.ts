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

أنت كاتب محتوى ومفكر عربي محترف. مهمتك تحويل معلومات وأفكار المستخدم إلى محتوى متقن وعالي الجودة.

## قواعد أساسية:
1. اكتب بالعربية فقط — تجنب الكلمات الإنجليزية إلا إذا كانت أسماء علامات تجارية أو مصطلحات تقنية لا بديل عربي لها.
2. لا تخترع أي معلومة واقعية لم يقدمها المستخدم — هذا ليس اقتراحًا، هذا قانون.
3. إذا لم تُذكر معلومة (مثل السعر أو الموقع الدقيق)، لا تذكرها في المحتوى.
4. ركّز على القيمة الحقيقية والعمق الفكري.
5. تجنب الحشو والجمل العامة التي لا تضيف معلومة.
6. كل جملة يجب أن تخدم هدفًا واضحًا.
7. حافظ على ذكر المميزات الهامة والأسماء الخاصة كما وردت بلغتها الأصلية.

## ممنوع:
- ترجمات حرفية أو أسلوب روبوتي
- عبارات ذكاء اصطناعي نمطية ومستهلكة
- إيموجي (لا تضع أي إيموجي على الإطلاق)
- ادعاءات مبالغ فيها بدون دليل
- إلحاح مصطنع
- تكرار نفس بنية الجمل
- اختلاق سير ذاتية أو تجارب وهمية لم يذكرها المستخدم
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

function buildPersonaLayer(persona?: any): PromptLayer | null {
  if (!persona) return null;
  const identity = typeof persona === "string" ? persona : persona.name || persona.identity || persona.id;
  if (!identity) return null;

  const lines = [
    `## منظور الكاتب وهويته (Creator Persona)`,
    `- الهوية والاهتمام: ${identity}`,
  ];
  if (persona.interests && Array.isArray(persona.interests) && persona.interests.length > 0) {
    lines.push(`- الاهتمامات: ${persona.interests.join("، ")}`);
  }
  if (persona.characteristics && Array.isArray(persona.characteristics) && persona.characteristics.length > 0) {
    lines.push(`- السمات الفكرية: ${persona.characteristics.join("، ")}`);
  }
  if (persona.customInstructions) {
    lines.push(`- توجيه تفضيلي: """${persona.customInstructions}"""`);
  }
  lines.push(
    `قاعدة: استخدم الشخصية كعدسة لتأطير الموضوع وطريقة التفكير فقط. لا تختلق سيرة ذاتية أو خبرات شخصية لم يذكرها المستخدم.`
  );
  return {
    label: `Persona: ${identity}`,
    content: lines.join("\n"),
  };
}

function buildStyleLayer(style?: any): PromptLayer | null {
  if (!style) return null;
  const name = typeof style === "string" ? style : style.name || style.id;
  if (!name) return null;

  const lines = [
    `## أسلوب الصياغة (Content Style)`,
    `- النمط: ${name}`,
  ];
  if (style.characteristics && Array.isArray(style.characteristics) && style.characteristics.length > 0) {
    lines.push(`- الخصائص: ${style.characteristics.join("، ")}`);
  }
  if (style.customInstructions) {
    lines.push(`- توجيه إضافي: """${style.customInstructions}"""`);
  }
  return {
    label: `Style: ${name}`,
    content: lines.join("\n"),
  };
}

function buildCreatorIntentLayer(intent?: string): PromptLayer | null {
  if (!intent) return null;
  return {
    label: `Creator Intent: ${intent}`,
    content: `## هدف المحتوى\n- توجه المحتوى: ${intent}. ركز على توليد لحظة استبصار وفهم غير مألوف للموضوع.`,
  };
}

function buildCreatorOriginalityLayer(originality?: string): PromptLayer | null {
  if (!originality || originality === "safe") return null;
  return {
    label: `Originality: ${originality}`,
    content: `## مستوى الابتكار والعمق\n- استخدم زوايا وتشبيهات غير تقليدية تثير دهشة القارئ وتتحدى التفكير السطحي.`,
  };
}

function buildCreatorAntiGenericnessLayer(): PromptLayer {
  return {
    label: "Anti-Genericness Barrier",
    content: `## مكافحة الابتذال\n- ممنوع استخدام العبارات الاستهلالية النمطية (في عالمنا اليوم، لا يخفى على أحد، دعونا نتفق).\n- ادخل في صلب الفكرة فوراً من الكلمة الأولى.\n- لا تستخدم أي إيموجي على الإطلاق.`,
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
  // V2 Canonical Keys
  sales: "الهدف: إقناع القارئ بالشراء أو التواصل للشراء.",
  messages: "الهدف: تشجيع القارئ على إرسال رسالة أو استفسار.",
  traffic: "الهدف: تحفيز القارئ على زيارة رابط أو صفحة.",
  awareness: "الهدف: بناء حماس حول إطلاق منتج جديد أو رفع الوعي بالعلامة التجارية.",
  community: "الهدف: بناء ثقة في العلامة التجارية أو المنتج والمجتمع.",
  leads: "الهدف: جمع بيانات العملاء المحتملين.",
  engagement: "الهدف: زيادة التفاعل والمشاركة من قبل الجمهور.",
  app_installs: "الهدف: تشجيع المستخدم على تحميل التطبيق.",
  retention: "الهدف: الحفاظ على العملاء الحاليين.",
  education: "الهدف: تعليم وتثقيف الجمهور المستهدف.",
  // V1 Legacy Aliases
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

function buildOutputContractLayer(contentType?: string): PromptLayer {
  let bodyInstruction = `
body:
Focus on insight, impact, and substance. DO NOT use emojis.`.trim();

  if (contentType === "short_video_script" || contentType === "video_script") {
    bodyInstruction = `
body:
CRITICAL: The body MUST ONLY contain the structured scenes. 
DO NOT write any introductory text, concluding paragraphs, or normal text outside the scenes. 
You MUST use the exact format: [Scene X — Ns] followed by [Visual] and [Audio].
DO NOT use emojis.`.trim();
  }

  return {
    label: "Output Contract",
    content: `
## متطلبات المحتوى

أنتج الحقول المطلوبة وفق المخطط.
لا تضف أي تعليمات برمجية للـ JSON، والتزم بالشروط الدلالية التالية:

title:
عنوان جذاب وقصير يشد الانتباه فورًا.

hook:
افتتاحية قوية تأسر القارئ وتثير فضوله للتعمق دون ابتذال.

${bodyInstruction}

callToAction:
خاتمة ذكية تدعو للتأمل أو النقاش أو اتخاذ قرار واضح.

hashtags:
5-8 هاشتاغات عربية مرتبطة بالموضوع (بدون # وبدون أي إيموجي).
`.trim(),
  };
}

export function getPromptLayers(input: InputDTO): PromptLayer[] {
  const isCreatorMode = (input as any).mode === "creator" || (input as any).mode === "personal_creator";
  const persona = (input as any).persona || (input as any).metadata?.persona;
  const style = (input as any).style || (input as any).styleConfig || (input as any).metadata?.style;
  const intent = (input as any).intent || (input as any).creatorIntent || (input as any).metadata?.intent;
  const originality = (input as any).originality || (input as any).metadata?.originality;

  const layers: (PromptLayer | null)[] = [
    buildGlobalRulesLayer(),
    buildPlatformLayer(input.platform),
    isCreatorMode ? buildPersonaLayer(persona) : null,
    isCreatorMode ? buildStyleLayer(style) : null,
    isCreatorMode ? buildCreatorIntentLayer(intent) : null,
    isCreatorMode ? buildCreatorOriginalityLayer(originality) : null,
    isCreatorMode ? buildCreatorAntiGenericnessLayer() : null,
    buildArabicStyleLayer(input.arabicStyle),
    buildContentTypeLayer(input.contentType),
    isCreatorMode ? null : buildMarketingObjectiveLayer(input.marketingObjective),
    buildInputContextLayer(input.rawInput),
    buildFactBoundaryLayer(),
    buildOutputContractLayer(input.contentType),
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
