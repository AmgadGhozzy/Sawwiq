import { PLATFORM_RULES } from "./platforms.ts";
import { DIALECT_RULES } from "./dialects.ts";
import { CONTENT_TYPE_RULES } from "./contentTypes.ts";
import type { InputDTO } from "../validation/schema.ts";

interface PromptLayer {
  tag: string;
  content: string;
}

function buildSystemPersonaLayer(): PromptLayer {
  return {
    tag: "system_persona",
    content: `You are an elite, highly-paid Arabic Copywriter and Content Strategist. Your goal is to transform the user's ideas into exceptional, high-converting, and intellectually deep content.`,
  };
}

function buildGlobalRulesLayer(): PromptLayer {
  return {
    tag: "global_rules",
    content: `1. LANGUAGE: Write strictly in Arabic unless technical terms or brand names lack common Arabic equivalents.
2. NO EMOJIS: Do not use any emojis whatsoever in the output, titles, hooks, or body.
3. QUALITY OVER QUANTITY: Avoid filler words. Every sentence must serve a specific thought or emotion.
4. NO AI TROPES: Avoid robotic tone, repetitive sentence structures, or overly dramatic phrasing.`,
  };
}

function buildAntiGenericnessLayer(): PromptLayer {
  return {
    tag: "anti_genericness",
    content: `<rule>Avoid generic introductory framing. Start as close to the core idea as possible.</rule>
<hook_strategy>
  Choose exactly ONE of these strategies for the hook:
  1. Surprising claim (ادعاء صادم)
  2. Contradiction (مفارقة أو تناقض)
  3. Direct, specific question (سؤال مباشر ومحدد جداً)
  4. Tension / Conflict (خلق توتر أو مشكلة)
</hook_strategy>`,
  };
}

function buildPlatformLayer(platform: string): PromptLayer | null {
  const rule = PLATFORM_RULES[platform];
  if (!rule) return null;
  return {
    tag: "platform_context",
    content: `PLATFORM: ${platform}\nPLATFORM RULES: ${rule}`,
  };
}

function buildPersonaLayer(persona?: any): PromptLayer | null {
  if (!persona) return null;
  const identity = typeof persona === "string" ? persona : persona.name || persona.identity || persona.id;
  if (!identity) return null;

  let content = `<identity>${identity}</identity>\n`;

  const rp = persona.reasoningProfile;
  if (rp) {
    content += `<worldview>\n${rp.worldview.map((item: string) => `- ${item}`).join('\n')}\n</worldview>\n`;
    content += `<reasoning_patterns>\n${rp.reasoningPatterns.map((item: string) => `- ${item}`).join('\n')}\n</reasoning_patterns>\n`;
    content += `<attention_bias>\n${rp.attentionBiases.map((item: string) => `- ${item}`).join('\n')}\n</attention_bias>\n`;
    content += `<evidence_preferences>\n${rp.evidencePreferences.map((item: string) => `- ${item}`).join('\n')}\n</evidence_preferences>\n`;
    content += `<analogy_domains>\n${rp.analogyDomains.map((item: string) => `- ${item}`).join('\n')}\n</analogy_domains>\n`;
    content += `<question_patterns>\n${rp.questionPatterns.map((item: string) => `- ${item}`).join('\n')}\n</question_patterns>\n`;
    content += `<conclusion_patterns>\n${rp.conclusionPatterns.map((item: string) => `- ${item}`).join('\n')}\n</conclusion_patterns>\n`;
    content += `<boundaries>\n${rp.avoidances.map((item: string) => `- ${item}`).join('\n')}\n</boundaries>\n`;
  } else if (persona.characteristics) {
    // Fallback for legacy
    content += `<characteristics>\n${persona.characteristics.map((c: string) => `- ${c}`).join('\n')}\n</characteristics>\n`;
  }

  content += `\n<rule>Use this persona to frame the topic, structure the logic, and choose analogies. DO NOT invent personal anecdotes. DO NOT use explicit domain jargon just to sound like the persona.</rule>`;

  return {
    tag: "persona",
    content: content.trim(),
  };
}

function buildStyleLayer(style?: any): PromptLayer | null {
  if (!style) return null;
  const name = typeof style === "string" ? style : style.name || style.id;
  if (!name) return null;

  const lines = [
    `CONTENT STYLE:`,
    `- النمط: ${name}`,
  ];
  if (style.characteristics && Array.isArray(style.characteristics) && style.characteristics.length > 0) {
    lines.push(`- الخصائص: ${style.characteristics.join("، ")}`);
  }
  if (style.customInstructions) {
    lines.push(`- توجيه إضافي: """${style.customInstructions}"""`);
  }
  return {
    tag: "style",
    content: lines.join("\n"),
  };
}

function buildCreatorIntentLayer(intent?: string): PromptLayer | null {
  if (!intent) return null;
  return {
    tag: "intent",
    content: `CONTENT INTENT: ${intent}\n- توجه المحتوى: ${intent}. ركز على توليد لحظة استبصار وفهم غير مألوف للموضوع.`,
  };
}

function buildCreatorOriginalityLayer(originality?: string): PromptLayer | null {
  if (!originality || originality === "safe") return null;
  return {
    tag: "originality",
    content: `مستوى الابتكار والعمق: استخدم زوايا وتشبيهات غير تقليدية تثير دهشة القارئ وتتحدى التفكير السطحي.`,
  };
}

function buildArabicStyleLayer(style: string): PromptLayer | null {
  const rule = DIALECT_RULES[style];
  if (!rule) return null;
  return {
    tag: "dialect_and_tone",
    content: rule,
  };
}

function buildContentTypeLayer(type: string): PromptLayer | null {
  const rule = CONTENT_TYPE_RULES[type]?.systemInstructions;
  if (!rule) return null;
  return {
    tag: "content_type_rules",
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
    tag: "marketing_objective",
    content: rule,
  };
}

function buildInputContextLayer(rawInput: string): PromptLayer {
  return {
    tag: "user_input",
    content: `TOPIC:\n${rawInput.trim()}\n\nTREAT AS UNVERIFIED: Do not extrapolate beyond provided context.`,
  };
}

function buildFactBoundaryLayer(): PromptLayer {
  return {
    tag: "fact_boundary",
    content: `<allowed>
- Facts explicitly provided in the user prompt.
- Safe, logical paraphrases of those facts.
</allowed>
<forbidden>
- Invented technical specifications.
- Invented guarantees or return policies.
- Invented performance metrics (e.g., "fastest", "#1").
</forbidden>
<creative_language>
- Emotional framing, FOMO, and storytelling are ENCOURAGED, provided they do not introduce a new factual assertion.
</creative_language>`,
  };
}

function buildOutputContractLayer(contentType?: string): PromptLayer {
  let bodyInstruction = `body:\nFocus on insight, impact, and substance.`;

  if (contentType === "short_video_script" || contentType === "video_script") {
    bodyInstruction = `body:\nCRITICAL: The body MUST ONLY contain the structured scenes. DO NOT write any introductory text, concluding paragraphs, or normal text outside the scenes. Follow the exact [Scene X] structure.`;
  }

  return {
    tag: "output_contract",
    content: `Produce the required JSON fields according to the schema.
DO NOT wrap the output in markdown code blocks like \`\`\`json. Output raw JSON only.

FIELD REQUIREMENTS:
title: عنوان جذاب وقصير يشد الانتباه فورًا.
hook: افتتاحية قوية تأسر القارئ وتثير فضوله للتعمق دون ابتذال.
${bodyInstruction}
callToAction: خاتمة ذكية تدعو للتأمل أو النقاش أو اتخاذ قرار واضح.
hashtags: هاشتاغات عربية مرتبطة بالموضوع (حسب متطلبات المنصة، بدون #).`,
  };
}

export function getPromptLayers(input: InputDTO): PromptLayer[] {
  const isCreatorMode = (input as any).mode === "creator" || (input as any).mode === "personal_creator";
  const persona = (input as any).persona || (input as any).metadata?.persona;
  const style = (input as any).style || (input as any).styleConfig || (input as any).metadata?.style;
  const intent = (input as any).intent || (input as any).creatorIntent || (input as any).metadata?.intent;
  const originality = (input as any).originality || (input as any).metadata?.originality;

  const layers: (PromptLayer | null)[] = [
    buildSystemPersonaLayer(),
    buildGlobalRulesLayer(),
    buildPlatformLayer(input.platform),
    buildAntiGenericnessLayer(),
    isCreatorMode ? buildPersonaLayer(persona) : null,
    isCreatorMode ? buildStyleLayer(style) : null,
    isCreatorMode ? buildCreatorIntentLayer(intent) : null,
    isCreatorMode ? buildCreatorOriginalityLayer(originality) : null,
    buildArabicStyleLayer(input.arabicStyle),
    buildContentTypeLayer(input.contentType),
    isCreatorMode ? null : buildMarketingObjectiveLayer(input.marketingObjective),
    buildFactBoundaryLayer(),
    buildOutputContractLayer(input.contentType),
    buildInputContextLayer(input.rawInput),
  ];
  return layers.filter((layer): layer is PromptLayer => layer !== null);
}

export function buildSystemPrompt(input: InputDTO): string {
  return getPromptLayers(input)
    .map((layer) => `<${layer.tag}>\n${layer.content}\n</${layer.tag}>`)
    .join("\n\n");
}

export function buildUserPrompt(): string {
  return "Write the marketing content based on the provided context.";
}
