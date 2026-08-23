import { getPlatformRule } from "./platforms.ts";
import { DIALECT_RULES } from "./dialects.ts";
import { getContentTypeRule } from "./contentTypes.ts";
import type { InputDTO } from "../validation/schema.ts";

interface PromptLayer {
  tag: string;
  content: string;
}

interface PersonaReasoningProfile {
  worldview?: string[];
  reasoningPatterns?: string[];
  attentionBiases?: string[];
  evidencePreferences?: string[];
  analogyDomains?: string[];
  questionPatterns?: string[];
  conclusionPatterns?: string[];
  avoidances?: string[];
}

interface PersonaInput {
  id?: string;
  name?: string;
  identity?: string;
  description?: string;
  reasoningProfile?: PersonaReasoningProfile;
  characteristics?: string[];
}

interface StyleInput {
  id?: string;
  name?: string;
  description?: string;
  characteristics?: string[];
  customInstructions?: string;
}

const FORBIDDEN_CLAIM_LABELS: Record<string, string> = {
  medical_claim: "نتائج أو فوائد طبية أو علاجية",
  guarantee: "ضمانات أو نتائج مؤكدة أو نسب مئوية مطلقة",
  financial_return: "وعود بعوائد أو أرباح استثمارية",
};

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
  const rule = getPlatformRule(platform);
  if (!rule) return null;
  return {
    tag: "platform_context",
    content: `PLATFORM: ${platform}\nPLATFORM RULES: ${rule}`,
  };
}

function buildContextLayer(input: InputDTO): PromptLayer | null {
  const brandName = input.metadata?.brandName?.trim();
  const targetAudience = input.metadata?.targetAudience?.trim();
  if (!brandName && !targetAudience) return null;

  const lines: string[] = [];
  if (brandName) lines.push(`<brand_name>${brandName}</brand_name>`);
  if (targetAudience) lines.push(`<target_audience>${targetAudience}</target_audience>`);
  lines.push(`استخدم هذه المعطيات كسياق ثابت للهوية والجمهور. لا تخترع معلومات عن العلامة التجارية غير الواردة هنا.`);

  return {
    tag: "context",
    content: lines.join("\n"),
  };
}

function buildPersonaLayer(persona?: PersonaInput): PromptLayer | null {
  if (!persona) return null;
  const identity = persona.name || persona.identity || persona.id;
  if (!identity) return null;

  let content = `<identity>${identity}</identity>\n`;

  const rp = persona.reasoningProfile;
  if (rp) {
    const section = (label: string, items?: string[]) =>
      items && items.length > 0
        ? `<${label}>\n${items.map((item) => `- ${item}`).join("\n")}\n</${label}>\n`
        : "";
    content += section("worldview", rp.worldview);
    content += section("reasoning_patterns", rp.reasoningPatterns);
    content += section("attention_bias", rp.attentionBiases);
    content += section("evidence_preferences", rp.evidencePreferences);
    content += section("analogy_domains", rp.analogyDomains);
    content += section("question_patterns", rp.questionPatterns);
    content += section("conclusion_patterns", rp.conclusionPatterns);
    content += section("boundaries", rp.avoidances);
  } else if (persona.characteristics && persona.characteristics.length > 0) {
    content += `<characteristics>\n${persona.characteristics.map((c) => `- ${c}`).join("\n")}\n</characteristics>\n`;
  }

  content += `\n<rule>Use this persona to frame the topic, structure the logic, and choose analogies. DO NOT invent personal anecdotes. DO NOT use explicit domain jargon just to sound like the persona.</rule>`;

  return {
    tag: "persona",
    content: content.trim(),
  };
}

function buildStyleLayer(style?: StyleInput): PromptLayer | null {
  if (!style) return null;
  const name = style.name || style.id;
  if (!name) return null;

  const lines = [
    `CONTENT STYLE:`,
    `- النمط: ${name}`,
  ];
  if (style.characteristics && style.characteristics.length > 0) {
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
  const rule = getContentTypeRule(type)?.systemInstructions;
  if (!rule) return null;
  return {
    tag: "content_type_rules",
    content: rule,
  };
}

const MARKETING_OBJECTIVE_RULES: Record<string, string> = {
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
  launch_product: "الهدف: بناء حماس حول إطلاق منتج جديد.",
  build_trust: "الهدف: بناء ثقة في العلامة التجارية أو المنتج.",
};

const MARKETING_OBJECTIVE_ALIASES: Record<string, string> = {
  sell: "sales",
  attract_messages: "messages",
  drive_traffic: "traffic",
  generate_leads: "leads",
};

function buildMarketingObjectiveLayer(objective?: string): PromptLayer | null {
  if (!objective) return null;
  const rule = MARKETING_OBJECTIVE_RULES[objective] ?? MARKETING_OBJECTIVE_RULES[MARKETING_OBJECTIVE_ALIASES[objective]];
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

function buildFactBoundaryLayer(contentType?: string): PromptLayer {
  const rule = contentType ? getContentTypeRule(contentType) : undefined;
  const restrictions = (rule?.forbiddenClaims ?? [])
    .map((claim) => FORBIDDEN_CLAIM_LABELS[claim])
    .filter((label): label is string => Boolean(label))
    .map((label) => `- ${label}`)
    .join("\n");

  let content = `<allowed>
- Facts explicitly provided in the user prompt.
- Safe, logical paraphrases of those facts.
</allowed>
<forbidden>
- Invented technical specifications.
- Invented guarantees or return policies.
- Invented performance metrics (e.g., "fastest", "#1").
</forbidden>`;

  if (restrictions) {
    content += `
<type_restrictions>
لا تنسب للمنتج أو الخدمة أبداً ولا تلمّح إليها:
${restrictions}
إلا إذا كانت مذكورة صراحة في مدخلات المستخدم.
</type_restrictions>`;
  }

  content += `
<behavior>
If a required fact is missing, omit it or phrase it conditionally. Never invent it.
</behavior>
<creative_language>
- Emotional framing, FOMO, and storytelling are ENCOURAGED, provided they do not introduce a new factual assertion.
</creative_language>`;

  return {
    tag: "fact_boundary",
    content,
  };
}

function buildLengthConstraintLine(constraints?: { minLength?: number; maxLength?: number }): string {
  if (!constraints) return "";
  const parts: string[] = [];
  if (constraints.minLength) parts.push(`حد أدنى ${constraints.minLength} حرف`);
  if (constraints.maxLength) parts.push(`حد أقصى ${constraints.maxLength} حرف`);
  if (parts.length === 0) return "";
  return `length: التزم بطول المحتوى (${parts.join("، ")}) مع الحفاظ على الجودة.`;
}

function buildOutputContractLayer(constraints?: { minLength?: number; maxLength?: number }): PromptLayer {
  const lengthLine = buildLengthConstraintLine(constraints);
  return {
    tag: "output_contract",
    content: `Produce the required JSON fields according to the schema.

FIELD REQUIREMENTS:
title: عنوان جذاب وقصير يشد الانتباه فورًا.
hook: افتتاحية قوية تأسر القارئ وتثير فضوله للتعمق دون ابتذال.
body: ركز على insight وأثر ومادة فعلية، والتزم بدقة بتنسيق النوع المحدد في قواعد نوع المحتوى.${lengthLine ? `\n${lengthLine}` : ""}
callToAction: خاتمة ذكية تدعو للتأمل أو النقاش أو اتخاذ قرار واضح.
hashtags: هاشتاغات عربية مرتبطة بالموضوع (حسب متطلبات المنصة، بدون #).`,
  };
}

export function getPromptLayers(input: InputDTO): PromptLayer[] {
  const isCreatorMode = input.mode === "creator" || input.mode === "personal_creator";
  const persona = (input.persona ?? input.metadata?.persona) as PersonaInput | undefined;
  const style = (input.style ?? input.metadata?.style) as StyleInput | undefined;

  const layers: (PromptLayer | null)[] = [
    buildSystemPersonaLayer(),
    buildGlobalRulesLayer(),
    buildPlatformLayer(input.platform),
    buildAntiGenericnessLayer(),
    buildContextLayer(input),
    isCreatorMode ? buildPersonaLayer(persona) : null,
    isCreatorMode ? buildStyleLayer(style) : null,
    isCreatorMode ? buildCreatorIntentLayer(input.intent) : null,
    isCreatorMode ? buildCreatorOriginalityLayer(input.originality) : null,
    buildArabicStyleLayer(input.arabicStyle),
    buildContentTypeLayer(input.contentType),
    isCreatorMode ? null : buildMarketingObjectiveLayer(input.marketingObjective),
    buildFactBoundaryLayer(input.contentType),
    buildOutputContractLayer(input.constraints),
    buildInputContextLayer(input.rawInput),
  ];
  return layers.filter((layer): layer is PromptLayer => layer !== null);
}

export function buildSystemPrompt(input: InputDTO): string {
  return getPromptLayers(input)
    .map((layer) => `<${layer.tag}>\n${layer.content}\n</${layer.tag}>`)
    .join("\n\n");
}

export const USER_PROMPT =
  "اكتب المحتوى التسويقي بناءً على معلومات المستخدم المقدمة في سياق المحادثة.";
