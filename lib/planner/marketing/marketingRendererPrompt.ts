import type { NormalizedPlannerRequest, IRGraph } from "../types.ts";
import { TONE_CONTRACTS, renderToneContract } from "./toneContracts.ts";

const PLATFORM_MAX_LENGTHS: Record<string, number> = {
  x: 280,
  instagram: 2200,
  facebook: 1500,
  linkedin: 2800,
};

const PLATFORM_WRITING_CONTRACT: Record<string, string> = {
  x: `PLATFORM CONTRACT — X (Twitter) [HARD RULES]:
- ONE idea only. No preamble. No secondary explanation.
- Hook enters the idea immediately. No scene-setting.
- Sentences: short, direct, no dependent clauses.
- Body must fit inside 280 characters total (all fields combined).
- CTA is optional. If used, it is one short sentence.
- Hashtags: 0–2, highly targeted.`,
  instagram: `PLATFORM CONTRACT — Instagram [HARD RULES]:
- First line of hook is the only thing visible before "more" — make it earn the tap.
- Body: scannable paragraphs, 1–2 sentences each. No walls of text.
- One clear benefit or insight per post.
- CTA is a single, low-friction action.
- Hashtags: 5–10, relevant and specific.`,
  linkedin: `PLATFORM CONTRACT — LinkedIn [HARD RULES]:
- Longer form is allowed, but each paragraph must earn its place.
- Professional tone. Analytical. Avoid marketing fluff.
- CTA invites discussion or clear action.
- Hashtags: 3–5, topic-specific.`,
  facebook: `PLATFORM CONTRACT — Facebook [HARD RULES]:
- Community-first tone. Conversational. Relatable.
- Moderate length. Paragraphs separated by whitespace.
- CTA asks for the reader's opinion or experience.
- Hashtags: 2–4 maximum.`,
};

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

export function buildMarketingRendererPrompt(ir: IRGraph, request: NormalizedPlannerRequest): string {
  const { platform, objective, language, constraints, tone } = request;

  const platformKey = platform.toLowerCase();
  const effectiveMaxLength = constraints?.maxLength ?? PLATFORM_MAX_LENGTHS[platformKey];

  const writingContract = PLATFORM_WRITING_CONTRACT[platformKey]
    ? `\n[PLATFORM WRITING CONTRACT — ${platform.toUpperCase()}]\n${PLATFORM_WRITING_CONTRACT[platformKey]}\n`
    : "";

  const ctaGuidance = OBJECTIVE_CTA_GUIDANCE[objective]
    ? `\n[OBJECTIVE-DRIVEN CTA]\n${OBJECTIVE_CTA_GUIDANCE[objective]}\n`
    : "";
    
  const toneContract = TONE_CONTRACTS[tone!];

  return `
You are a master Marketing Copywriter. Your job is to translate a structured persuasion graph (Intermediate Representation) into a final, publish-ready post.
You MUST output valid JSON exactly matching the schema below.

[OUTPUT FORMAT]
{
  "title": "A short, internal title summarizing the post",
  "hook": "The opening sentence(s) that grab attention",
  "body": "The main content, naturally flowing between paragraphs",
  "callToAction": "The final instruction or question for the reader",
  "hashtags": ["tag1", "tag2"] // omit the '#' symbol
}

[INPUT IR GRAPH]
${JSON.stringify(ir, null, 2)}
(Note: This JSON contains both the "nodes" and "angles".)

[RENDERER CONTRACT]
The planning structure is invisible to the reader.

Do not enumerate, label, or mechanically reproduce planning nodes.
Do not write one sentence per node.
Do not preserve node order when a better rhetorical flow exists.

Use the IR as a strategic backbone, not as a writing template.

You may:
- merge ideas
- reorder ideas
- turn a benefit into a hook
- compress multiple nodes into one sentence
- omit a low-priority angle
- create natural transitions
- build emotional momentum

[FINAL FACTUALITY GATE]
However, factual boundaries are immutable. You are the FINAL GATE for factuality.
Even if the Planner or an Angle suggested a hallucinated claim, YOU MUST REJECT IT AND OMIT IT.

NEVER invent or include unsupported:
- statistics or percentages
- testimonials or quotes
- customer results
- awards or accolades
- guarantees
- scarcity or urgency deadlines
- discounts or pricing
- specifications or features
- claims not supported by the original input

If an Angle says "Highlight that it saves 70% time", but the input says nothing about 70%, you MUST drop the "70%" and just say "Saves you time".
If the input lacks concrete details, use evocative language, NOT fabricated facts.

Persuasion must come from:
- relevance
- specificity
- benefit clarity
- audience insight
- emotional resonance
- credible framing
- concrete product details
${writingContract}
${ctaGuidance}
${renderToneContract(toneContract)}

[USER CONSTRAINTS]
${constraints?.forbiddenTerms?.length ? `- Forbidden terms: ${constraints.forbiddenTerms.join(", ")}` : ""}
${constraints?.requiredTerms?.length ? `- Required terms: ${constraints.requiredTerms.join(", ")}` : ""}
${constraints?.customInstructions ? `- Custom instructions: ${constraints.customInstructions}` : ""}
${effectiveMaxLength ? `\n- MAXIMUM LENGTH: The total character count of (title + hook + body + callToAction + hashtags) MUST NOT exceed ${effectiveMaxLength} characters. You must be extremely concise.` : ""}
- Output Language: ${language}
`.trim();
}
