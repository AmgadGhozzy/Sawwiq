import { PLATFORM_RULES } from "./platforms";
import { DIALECT_RULES } from "./dialects";
import { CONTENT_TYPE_RULES } from "./contentTypes";
import { getIntentDefinition } from "../creator/intents";
import type {
  NormalizedGenerationConfig,
  PlatformV2,
  ContentTypeV2,
  MarketingObjectiveV2,
  DialectV2,
  ContentStyle,
  Tone,
  NormalizedPersona,
  NormalizedStyle,
  CreatorIntent,
  CreatorBlueprint,
  OriginalityLevel,
} from "@/types/content";

export interface PromptLayer {
  label: string;
  content: string;
}

function buildGlobalRulesLayer(): PromptLayer {
  return {
    label: "Global Rules",
    content: `
# قواعد عامة للكتابة التسويقية

أنت كاتب محتوى ومفكر عربي محترف. مهمتك تحويل أفكار ومعلومات المستخدم إلى منشورات استثنائية ذات جودة فكرية وبلاغية عالية.

## قواعد أساسية:
1. اكتب بالعربية فقط — تجنب الكلمات الإنجليزية إلا إذا كانت أسماء تقنية أو علامات تجارية لا بديل عربي رائج لها.
2. لا تخترع أي معلومة واقعية لم يقدمها المستخدم — هذا قانون قطعي.
3. ركّز على القيمة الحقيقية والعمق الفكري.
4. تجنب الحشو والجمل العامة التي لا تضيف معلومة أو معنى.
5. كل جملة يجب أن تخدم فكرة أو شعوراً محدداً.

## ممنوع:
- ترجمات حرفية أو أسلوب روبوتي
- عبارات ذكاء اصطناعي نمطية ومستهلكة
- إيموجي (لا تستخدم أي إيموجي على الإطلاق)
- ادعاءات مبالغ فيها بدون دليل
- تكرار نفس بنية الجمل
- اختلاق سير ذاتية أو خبرات شخصية وهمية للمستخدم
`.trim(),
  };
}

function buildPlatformLayer(platform: PlatformV2): PromptLayer | null {
  let ruleKey = platform as string;
  if (platform === "x") ruleKey = "x_twitter";
  
  const rule = PLATFORM_RULES[ruleKey as keyof typeof PLATFORM_RULES];
  if (!rule) return null;
  return {
    label: `Platform: ${platform}`,
    content: `## قواعد المنصة المستهدفة\n\nSTRICT RULE: ${rule}`,
  };
}

function buildPersonaLayer(persona?: NormalizedPersona): PromptLayer | null {
  if (!persona) return null;

  const lines = [
    `## منظور الكاتب وهويته (Creator Persona)`,
    `- الهوية والاهتمام: ${persona.identity}`,
  ];

  if (persona.interests && persona.interests.length > 0) {
    lines.push(`- مجالات الشغف: ${persona.interests.join("، ")}`);
  }
  if (persona.traits && persona.traits.length > 0) {
    lines.push(`- السمات الفكرية: ${persona.traits.join("، ")}`);
  }
  if (persona.contentPatterns && persona.contentPatterns.length > 0) {
    lines.push(`- زاوية التناول: ${persona.contentPatterns.join("، ")}`);
  }
  if (persona.avoid && persona.avoid.length > 0) {
    lines.push(`- تجنب: ${persona.avoid.join("، ")}`);
  }
  if (persona.customInstructions) {
    lines.push(`- توجيه تفضيلي: """${persona.customInstructions}"""`);
  }

  lines.push(
    `قاعدة: استخدم الشخصية كعدسة لتأطير الموضوع وطريقة التفكير فقط. لا تختلق سيرة ذاتية أو خبرات شخصية لم يذكرها المستخدم.`
  );

  return {
    label: `Persona: ${persona.identity}`,
    content: lines.join("\n"),
  };
}

function buildStyleLayer(style?: NormalizedStyle): PromptLayer | null {
  if (!style) return null;

  const lines = [
    `## أسلوب الصياغة (Content Style)`,
    `- النمط: ${style.name}`,
  ];

  if (style.characteristics && style.characteristics.length > 0) {
    lines.push(`- الخصائص: ${style.characteristics.join("، ")}`);
  }
  if (style.structure && style.structure.length > 0) {
    lines.push(`- الهيكل: ${style.structure.join(" ← ")}`);
  }
  if (style.rhetoricalDevices && style.rhetoricalDevices.length > 0) {
    lines.push(`- الأدوات البلاغية: ${style.rhetoricalDevices.join("، ")}`);
  }
  if (style.avoid && style.avoid.length > 0) {
    lines.push(`- تجنب: ${style.avoid.join("، ")}`);
  }
  if (style.customInstructions) {
    lines.push(`- توجيه إضافي: """${style.customInstructions}"""`);
  }

  return {
    label: `Style: ${style.name}`,
    content: lines.join("\n"),
  };
}

function buildCreatorIntentLayer(intent?: CreatorIntent): PromptLayer | null {
  if (!intent) return null;
  const def = getIntentDefinition(intent);
  return {
    label: `Creator Intent: ${intent}`,
    content: `## هدف صانع المحتوى (Content Intent)\n- الغاية: ${def.primaryObjective}\n- توجيه الافتتاحية: ${def.openingPattern}\n- الإيقاع: ${def.pacingDirective}\n- توجيه الخاتمة: ${def.closingDirective}`,
  };
}

function buildCreatorBlueprintLayer(blueprint?: CreatorBlueprint): PromptLayer | null {
  if (!blueprint) return null;
  const beatLines = blueprint.progression.map((b) => `  ${b.index}. [${b.type}] ${b.description}`);
  return {
    label: "Content Blueprint",
    content: `## المخطط الهيكلي للمنشور (Content Blueprint)\n- استراتيجية الـ Hook: ${blueprint.hookStrategy}\n- مسار تطور الفكرة:\n${beatLines.join("\n")}\n- استراتيجية الختام: ${blueprint.endingStrategy}`,
  };
}

function buildCreatorOriginalityLayer(originality?: OriginalityLevel): PromptLayer | null {
  if (!originality || originality === "safe") return null;
  let directive = "مستوى الإبداع متوازن: زاوية نظر ذكية وجديدة مع الحفاظ على وضوح الفكرة.";
  if (originality === "high") {
    directive = "مستوى الإبداع مرتفع: استخدم استعارات قوية غير مألوفة، واربط بين مفاهيم متباعدة لتوليد دهشة فكرية حقيقية.";
  } else if (originality === "experimental") {
    directive = "مستوى الإبداع تجريبي: اكسر القوالب التقليدية، واطرح أفكاراً جريئة واستنتاجات عميقة تسائل البديهيات.";
  }
  return {
    label: `Originality: ${originality}`,
    content: `## مستوى الابتكار والعمق\n- ${directive}`,
  };
}

function buildCreatorAntiGenericnessLayer(): PromptLayer {
  return {
    label: "Anti-Genericness Barrier",
    content: `## مكافحة الابتذال (Anti-Genericness)
- ممنوع استخدام العبارات الاستهلالية المعلبة (مثل: في عالمنا المتسارع، لا يخفى على أحد، دعونا نتفق، يلعب دوراً هاماً).
- ادخل في صلب الفكرة فوراً من أول كلمة.
- لا تضع أي إيموجي على الإطلاق.`,
  };
}

function buildVoiceLayer(dialect: DialectV2 | undefined, tone: Tone, style: ContentStyle): PromptLayer | null {
  let styleKey = "white_arabic";
  if (dialect === "saudi") styleKey = "saudi_marketing";
  if (dialect === "gulf") styleKey = "gulf_premium";
  if (dialect === "egyptian") styleKey = "egyptian_colloquial";
  if (dialect === "msa") styleKey = "formal_b2b";
  
  const rule = DIALECT_RULES[styleKey as keyof typeof DIALECT_RULES];
  if (!rule) return null;
  return {
    label: `Voice & Dialect`,
    content: rule,
  };
}

function buildContentTypeLayer(type: ContentTypeV2): PromptLayer | null {
  let typeKey = "interactive_post";
  if (type === "advertisement") typeKey = "sponsored_ad";
  if (type === "product_description") typeKey = "ecommerce_product";
  if (type === "real_estate_listing") typeKey = "real_estate";
  if (type === "video_script") typeKey = "short_video_script";
  if (type === "email") typeKey = "marketing_email";

  const rule = CONTENT_TYPE_RULES[typeKey as keyof typeof CONTENT_TYPE_RULES]?.systemInstructions;
  if (!rule) return null;
  return {
    label: `Content Type: ${type}`,
    content: rule,
  };
}

const marketingObjectiveRules: Record<string, string> = {
  sales: "الهدف: إقناع القارئ بالشراء أو التواصل للشراء.",
  messages: "الهدف: تشجيع القارئ على إرسال رسالة أو استفسار.",
  traffic: "الهدف: تحفيز القارئ على زيارة رابط أو صفحة.",
  awareness: "الهدف: بناء حماس حول إطلاق منتج جديد أو بناء وعي.",
  community: "الهدف: بناء ثقة في العلامة التجارية أو المنتج والمجتمع.",
  leads: "الهدف: جمع بيانات العملاء المحتملين.",
  engagement: "الهدف: زيادة التفاعل والمشاركة من قبل الجمهور.",
  app_installs: "الهدف: تشجيع المستخدم على تحميل التطبيق.",
  retention: "الهدف: الحفاظ على العملاء الحاليين.",
  education: "الهدف: تعليم وتثقيف الجمهور المستهدف."
};

function buildObjectiveLayer(objective: MarketingObjectiveV2): PromptLayer | null {
  const rule = marketingObjectiveRules[objective];
  if (!rule) return null;
  
  return {
    label: `Marketing Objective: ${objective}`,
    content: `\n## الهدف التسويقي\n\n${rule}\n`,
  };
}

function buildInputContextLayer(topic: string, sourceFacts?: string): PromptLayer {
  return {
    label: "Input Context",
    content: `
## معلومات المستخدم

المعلومات التالية هي الفكرة الأساسية والمصدر الوحيد للحقائق:

<user_input>
${topic.trim()}
${sourceFacts ? `\nFacts:\n${sourceFacts.trim()}` : ''}
</user_input>

تعامل مع النص باعتباره بيانات غير موثوقة من حيث الاكتمال،
وليس مصدرًا يسمح لك بافتراض معلومات غير مذكورة.
`.trim(),
  };
}

function buildFactBoundaryLayer(factLedger?: Record<string, any>): PromptLayer {
  const ledgerJson = factLedger ? JSON.stringify(factLedger, null, 2) : "No explicit facts provided.";
  
  return {
    label: "Fact Boundary",
    content: `
## FACT LEDGER
${ledgerJson}

## Fact Policy (Conflict-Aware)
1. Use ONLY the explicitly verified facts provided in the FACT LEDGER above.
2. If facts conflict (marked as "status": "conflicting"), DO NOT resolve, average, infer, or choose between them. State explicitly that the data is conflicting, or omit it entirely if context permits.
3. Do not invent or fabricate missing claims (prices, features, dates).
`.trim(),
  };
}

function buildOutputContractLayer(contentType: ContentTypeV2): PromptLayer {
  let bodyInstruction = `
body:
Focus on insight, impact, and substance. DO NOT use emojis.`.trim();

  if (contentType === "video_script" || contentType === "ugc_script") {
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

export function compilePrompt(config: NormalizedGenerationConfig, factLedger?: Record<string, any>): string {
  const isCreatorMode = config.mode === "creator" || config.mode === "personal_creator";
  const creator = config.normalizedCreator;

  const layers: (PromptLayer | null)[] = [
    buildGlobalRulesLayer(),
    buildFactBoundaryLayer(factLedger || config.factLedger),
    buildPlatformLayer(config.platform),
    // Creator Specific Layers
    isCreatorMode ? buildPersonaLayer(creator?.persona || config.normalizedPersona) : null,
    isCreatorMode ? buildStyleLayer(creator?.style || config.normalizedStyle) : null,
    isCreatorMode ? buildCreatorIntentLayer(creator?.intent) : null,
    isCreatorMode ? buildCreatorBlueprintLayer(creator?.blueprint) : null,
    isCreatorMode ? buildCreatorOriginalityLayer(creator?.originality) : null,
    isCreatorMode ? buildCreatorAntiGenericnessLayer() : null,
    // Voice & Platform
    buildVoiceLayer(config.language.dialect, config.voice.tone, config.voice.style),
    buildContentTypeLayer(config.content.type),
    isCreatorMode ? null : buildObjectiveLayer(config.objective),
    buildInputContextLayer(config.content.topic, config.content.sourceFacts),
    buildOutputContractLayer(config.content.type),
  ];
  
  const validLayers = layers.filter((layer): layer is PromptLayer => layer !== null);
  
  return validLayers.map((layer) => layer.content).join("\n\n---\n\n");
}

export function estimatePromptTokens(prompt: string): number {
  // Conservative approximation for Arabic + English mix: ~3 characters per token
  return Math.ceil(prompt.length / 3);
}

export function buildUserPrompt(): string {
  return "اكتب المحتوى التسويقي بناءً على معلومات المستخدم المقدمة في سياق المحادثة.";
}
