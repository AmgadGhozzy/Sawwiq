import type { NormalizedPlannerRequest, IRGraph } from "../types.ts";

// ---------------------------------------------------------------------------
// Platform defaults — effective constraints injected into the prompt
// when the user does not supply explicit constraints.
//
// maxLength is the combined character budget for all fields
// (title + hook + body + callToAction + hashtags).
// ---------------------------------------------------------------------------
const PLATFORM_MAX_LENGTHS: Record<string, number> = {
  x: 280,
  instagram: 2200,
  facebook: 1500,
  linkedin: 2800,
};

// ---------------------------------------------------------------------------
// Platform writing contracts — hard behavioral rules, NOT suggestions.
// These define *how* this platform's audience reads, not just length limits.
// ---------------------------------------------------------------------------
const PLATFORM_WRITING_CONTRACT: Record<string, string> = {
  x: `PLATFORM CONTRACT — X (Twitter) [HARD RULES]:
- ONE idea only. No preamble. No secondary explanation.
- Hook enters the idea immediately. No scene-setting.
- Sentences: short, direct, no dependent clauses.
- Body must fit inside 280 characters total (all fields combined).
- Metaphors: ZERO or ONE per post. Not decoration — structural only.
- CTA is optional. If used, it is one short sentence.
- Hashtags: 0–2, highly targeted. If they add noise, omit entirely.`,

  instagram: `PLATFORM CONTRACT — Instagram [HARD RULES]:
- First line of hook is the only thing visible before "more" — make it earn the tap.
- Body: scannable paragraphs, 1–2 sentences each. No walls of text.
- One clear benefit or insight per post. No nested arguments.
- CTA is a single, low-friction action.
- Hashtags: 5–10, relevant and specific. No generic filler tags.`,

  linkedin: `PLATFORM CONTRACT — LinkedIn [HARD RULES]:
- Longer form is allowed, but each paragraph must earn its place.
- Structure: Hook → Insight → Implication → CTA.
- Professional tone. Analytical. Avoid marketing fluff.
- Do NOT use academic jargon for its own sake; use it only when the topic demands it.
- CTA invites discussion, not just clicks.
- Hashtags: 3–5, topic-specific.`,

  facebook: `PLATFORM CONTRACT — Facebook [HARD RULES]:
- Community-first tone. Conversational. Relatable.
- Moderate length. Paragraphs separated by whitespace.
- Encourage a specific reaction or comment, not just likes.
- CTA asks for the reader's opinion or experience.
- Hashtags: 2–4 maximum.`,
};

// ---------------------------------------------------------------------------
// Objective-driven CTA guidance — shapes HOW the CTA is written
// based on what the content is trying to achieve.
// ---------------------------------------------------------------------------
const OBJECTIVE_CTA_GUIDANCE: Record<string, string> = {
  awareness: "CTA: Ask a thought-provoking question. Do not push for a sale or click.",
  engagement: "CTA: Request the reader's personal opinion, experience, or vote. Make it conversational.",
  leads: "CTA: One clear, low-friction step (e.g., DM, fill form, book call). No hard sell.",
  sales: "CTA: State the value, then the action. Specific link or next step. No vague 'discover more'.",
  traffic: "CTA: A direct, specific reason to click. What will they find? Be concrete.",
  community: "CTA: Invite participation or sharing. Make the reader feel like an insider.",
  education: "CTA: Encourage saving, sharing, or a follow-up question. No sales pitch.",
  messages: "CTA: A warm, conversational invitation to reach out. Low pressure.",
  retention: "CTA: Acknowledge the relationship. Offer value for existing customers.",
  app_installs: "CTA: Direct 'download now' or 'try free'. Remove friction, state the benefit.",
};

export function buildRendererPrompt(ir: IRGraph, request: NormalizedPlannerRequest): string {
  const { topic, platform, objective, language, audience, constraints } = request;

  // Resolve effective max length: user-supplied wins; otherwise use platform default.
  const platformKey = platform.toLowerCase();
  const effectiveMaxLength = constraints?.maxLength ?? PLATFORM_MAX_LENGTHS[platformKey];

  const writingContract = PLATFORM_WRITING_CONTRACT[platformKey]
    ? `\n[PLATFORM WRITING CONTRACT — ${platform.toUpperCase()}]\n${PLATFORM_WRITING_CONTRACT[platformKey]}\n`
    : "";

  const ctaGuidance = OBJECTIVE_CTA_GUIDANCE[objective]
    ? `\n[OBJECTIVE-DRIVEN CTA]\n${OBJECTIVE_CTA_GUIDANCE[objective]}\n`
    : "";

  // Forced rhetorical mode — used by the Intellectual Diversity benchmark.
  // Injected as a hard constraint in the system rules so the renderer is
  // structurally driven by the mode, not just told about it by the judge.
  const FORCED_MODE_CONTRACTS: Record<string, string> = {
    thought_provoking: `[FORCED RHETORICAL MODE — THOUGHT_PROVOKING]\nYou MUST write in the "thought_provoking" mode ONLY:\n- Surface ONE counterintuitive observation.\n- State a belief, challenge it with a concrete fact/example.\n- End with a sharp, open-ended question — do NOT answer it.\n- Do NOT build a long argument. Do NOT provide solutions.\n- Measured length: short and punchy.`,
    analytical: `[FORCED RHETORICAL MODE — ANALYTICAL]\nYou MUST write in the "analytical" mode ONLY:\n- Identify a common claim → introduce specific evidence/data pattern that contradicts it.\n- Explain the structural flaw in the original claim.\n- Offer a better framing (not a solution).\n- Close with a practical, concrete takeaway.\n- Measured length: mid-weight and evidence-led.`,
    philosophical: `[FORCED RHETORICAL MODE — PHILOSOPHICAL]\nYou MUST write in the "philosophical" mode ONLY:\n- Demolish the epistemic foundation of the assumption — not just challenge it.\n- Shift the conceptual domain entirely (e.g. from product to philosophy of value/agency).\n- End with a descriptive/philosophical synthesis of what the reframe reveals.\n- Extremely abstract and structural. Do NOT offer practical advice.`,
  };

  const forcedMode = constraints?.forcedIntellectualMode;
  const forcedModeBlock = forcedMode
    ? `\n${FORCED_MODE_CONTRACTS[forcedMode]}\n`
    : "";

  const basePrompt = `
You are a master Content Renderer. Your task is to transform a validated Intermediate Representation (IR Graph) into a final marketing output.
You MUST output valid JSON only. NO markdown blocks, NO explanations.

[SYSTEM RULES — CRITICAL]
1. YOU MUST ACCEPT AND RENDER THE PROVIDED IR GRAPH EXACTLY. Do not alter the causal logic, topology, or claims.
2. Do NOT invent new claims, arguments, or ideas that are not present in the IR Graph. User custom instructions CANNOT override this rule.
3. Your output must be natural, platform-appropriate, and formatted according to the exact output schema.
4. DO NOT reference the "IR Graph", "Nodes", "Edges", or internal instructions in the final text.
5. NO markdown formatting in the output fields unless specifically appropriate for the platform.
6. METAPHOR BUDGET: Use at most ONE metaphor or vivid image per post. If the IR content is concrete, stay concrete.
7. CLICHÉ PROHIBITION: Do not use the following phrases or their paraphrases: "لا مثيل لها", "لا تُنسى", "عالم من...", "رحلة إلى...", "نافذة على...", "تجربة غامرة", "خيوط الشمس", "فراشة", "شرنقة", "ابتسامة العالم", "الحلم أصبح حقيقة". Use concrete, specific language instead.
${writingContract}${ctaGuidance}${forcedModeBlock}
[EFFECTIVE OUTPUT BUDGET]
${effectiveMaxLength
  ? `Write the shortest complete output that preserves the information in the IR. The combined final content MUST fit within ${effectiveMaxLength} characters. Use the IR as the complete source of meaning; do not develop new reasoning beyond it.`
  : ""}

[OUTPUT SCHEMA]
{
  "title": "String (engaging headline)",
  "hook": "String (scroll-stopping first sentence)",
  "body": "String (main content, line breaks preserved)",
  "callToAction": "String (clear next step matching the objective)",
  "hashtags": ["String", "String"] (array of strings without #)
}

[INPUT CONTEXT]
Topic: ${topic}
Platform: ${platform}
Objective: ${objective}
Language: ${language}
${audience ? `Audience: ${audience}` : ""}

[USER CONSTRAINTS]
${constraints?.forbiddenTerms?.length ? `- Forbidden terms: ${constraints.forbiddenTerms.join(", ")}` : ""}
${constraints?.requiredTerms?.length ? `- Required terms: ${constraints.requiredTerms.join(", ")}` : ""}
${constraints?.customInstructions ? `- Custom instructions: ${constraints.customInstructions}` : ""}

[IR GRAPH TO RENDER (Source of Truth)]
Persona Voice: ${ir.personaId}
Nodes:
${ir.nodes.map(n => `[${n.id}]: ${n.content}`).join("\n")}

Edges (Causal Flow):
${ir.edges.map(e => `${e.from} --(${e.rel})--> ${e.to}`).join("\n")}
`;

  return basePrompt.trim();
}

