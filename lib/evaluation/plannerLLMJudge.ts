import { aiConfig } from "../config.ts";
import { createVertexAIClient } from "../ai/googleClient.ts";
import { GeneratedContent } from "../../types/content.ts";
import type { PlannerRequestDTO } from "../planner/validation.ts";
import { runPlannerLocal } from "./localPipeline.ts";
import { getPersona } from "../content/personas/registry.ts";
import { MARKETING_TOPOLOGIES } from "../planner/marketing/topologies.ts";

// ---------------------------------------------------------------------------
// 1. Intellectual Mode Identifiability (Blind Semantic Check)
// ---------------------------------------------------------------------------
export interface ModeIdentifiabilityResult {
  identifiedMode: "thought_provoking" | "analytical" | "philosophical" | "unknown";
  confidence: number; // 0-100
  reasoning: string;
}

export async function evaluateModeIdentifiability(
  content: GeneratedContent,
  topic: string,
  modeVariant: "standard" | "compact" = "standard"
): Promise<ModeIdentifiabilityResult> {
  const client = createVertexAIClient();
  const modelName = process.env.GEMINI_MODEL || "gemini-2.5-flash-lite";

  const fullText = `${content.title}\n${content.hook}\n${content.body}\n${content.callToAction}`;

  const modeDefinitions = modeVariant === "compact"
    ? `
The 3 possible modes in this COMPACT variant are:
1. "thought_provoking": Extremely short. States a paradox or counterintuitive fact, followed by a sharp implication or question. (Focuses on a paradox).
2. "analytical": Extremely short. States a common claim, followed by a specific contradicting fact/pattern that embeds an implication. (Focuses on evidence contradicting a claim).
3. "philosophical": Extremely short. Names an epistemic conflict or tension, followed by a conceptual reframing. (Focuses on resolving a conceptual tension).
`
    : `
The 3 possible modes are:
1. "thought_provoking": Short and punchy. Surfaces ONE counterintuitive observation. States a belief, challenges it with a concrete fact/example, and ends with a sharp question leaving the reader to think. It does NOT build a long argument or explain the answer.
2. "analytical": Mid-weight and evidence-led. Builds a tight argument: identifies a common claim → introduces specific evidence/data pattern that contradicts it → explains the structural flaw → offers a better framing (not a solution) → gives a practical takeaway.
3. "philosophical": Full dialectic. Demolishes the epistemic foundation of an assumption. Shifts the conceptual domain entirely (e.g. from psychology to philosophy of agency). Ends with a descriptive/philosophical synthesis of what the reframe reveals. Extremely abstract and structural.
`;

  const prompt = `
You are an expert rhetorician analyzing a piece of marketing content written about the topic: "${topic}".
Your task is to classify the rhetorical mode of the content into exactly one of three categories based strictly on its semantic structure and argumentative strategy.
${modeDefinitions}

Read the text below and classify it.
[TEXT]
${fullText}

[OUTPUT FORMAT]
You MUST return valid JSON exactly matching this schema, with no markdown formatting or extra text:
{
  "identifiedMode": "thought_provoking" | "analytical" | "philosophical" | "unknown",
  "confidence": number, // 0 to 100
  "reasoning": "Brief explanation of why this mode was chosen, citing specific structural evidence from the text."
}
`;

  try {
    const res = await client.models.generateContent({
      model: modelName,
      contents: prompt,
      config: { temperature: 0.1, responseMimeType: "application/json" }
    });
    return JSON.parse(res.text || "{}") as ModeIdentifiabilityResult;
  } catch (error) {
    return { identifiedMode: "unknown", confidence: 0, reasoning: `Evaluation failed: ${error}` };
  }
}

// ---------------------------------------------------------------------------
// 2. Creative Metaphor Groundedness
// ---------------------------------------------------------------------------
export interface CreativeGroundednessResult {
  metaphorCount: number;
  isGrounded: boolean;
  /**
   * metaphorNecessity: true if each metaphor conveys meaning that cannot be
   * expressed through direct language — i.e. it is structurally necessary.
   * false if the metaphor is decorative and can be deleted without losing meaning.
   * If metaphorCount === 0, returns true.
   */
  metaphorNecessity: boolean;
  reasoning: string;
}

export async function evaluateCreativeGroundedness(
  content: GeneratedContent,
  topic: string
): Promise<CreativeGroundednessResult> {
  const client = createVertexAIClient();
  const modelName = process.env.GEMINI_MODEL || "gemini-2.5-flash-lite";

  const fullText = `${content.title}\n${content.hook}\n${content.body}\n${content.callToAction}`;

  const prompt = `
You are a literary critic evaluating a creative marketing text about: "${topic}".
You must evaluate three things:
1. How many distinct metaphors or vivid imaginative leaps are used in the text? Count them.
2. Are these metaphors "grounded" (drawn from the physical reality or specific domain of the topic itself, acting as a structural tool) OR are they "decorative/excessive poetry" (generic clichés like golden threads, butterflies, oceans, journeys, or atmospheric vagueness that could apply to any topic)?
3. Are these metaphors "necessary"? A metaphor is necessary if it conveys a meaning or abstraction that CANNOT be expressed through direct language without significant loss. A decorative metaphor can be deleted and the sentence still fully communicates its meaning.

[TEXT]
${fullText}

[OUTPUT FORMAT]
You MUST return valid JSON exactly matching this schema, with no markdown formatting or extra text:
{
  "metaphorCount": number, // Integer count of distinct metaphors
  "isGrounded": boolean, // true if metaphors are specific, physical, and domain-relevant. false if generic, poetic, or decorative. If 0 metaphors, return true.
  "metaphorNecessity": boolean, // true if ALL metaphors are structurally necessary (removing them would lose meaning). false if any are purely decorative. If 0 metaphors, return true.
  "reasoning": "Brief explanation covering all three criteria."
}
`;

  try {
    const res = await client.models.generateContent({
      model: modelName,
      contents: prompt,
      config: { temperature: 0.1, responseMimeType: "application/json" }
    });
    return JSON.parse(res.text || "{}") as CreativeGroundednessResult;
  } catch (error) {
    return { metaphorCount: 0, isGrounded: false, metaphorNecessity: true, reasoning: `Evaluation failed: ${error}` };
  }
}

// ---------------------------------------------------------------------------
// 3. Quality vs Constraint Tradeoff (Publish Readiness)
// ---------------------------------------------------------------------------
export interface PublishReadinessResult {
  // ── 5 independent dimensions ──────────────────────────────────────────────
  /** Did the copy stay true to the actual product/offer facts? (no invented specs) */
  productFidelity: number;    // 1-5
  /** Does it compel action? Is there a clear benefit or emotional pull? */
  persuasion: number;         // 1-5
  /** Does it serve the stated objective (sales/leads/awareness/engagement)? */
  objectiveFit: number;       // 1-5
  /** Is it appropriate for the platform format, length, and norms? */
  platformFit: number;        // 1-5
  /** Is the Arabic natural, fluent, and non-robotic? */
  naturalArabic: number;      // 1-5
  // ── Derived ───────────────────────────────────────────────────────────────
  publishReadyScore: number;  // Weighted composite (see computation below)
  isOverConstrained: boolean;
  hasHallucinations: boolean;
  hallucinationDetails?: {
    type?: "scarcity" | "testimonial" | "guarantee" | "statistic" | "claim" | "other";
    claim?: string;
    unsupportedNode?: string;
    unsupportedAngle?: string;
    unsupportedRendererClaim?: string;
  };
  reasoning: string;
}

export async function evaluatePublishReadiness(
  content: GeneratedContent,
  topic: string,
  platform: string,
  purpose: "thought" | "marketing",
  strategyId: string, // personaId or frameworkId
  modeVariant: "standard" | "compact" = "standard"
): Promise<PublishReadinessResult> {
  const client = createVertexAIClient();
  const modelName = process.env.GEMINI_MODEL || "gemini-2.5-flash-lite";

  const fullText = `${content.title}\n${content.hook}\n${content.body}\n${content.callToAction}`;

  let strategyContext = "";
  if (purpose === "thought") {
    const personaConfig = getPersona(strategyId);
    if (personaConfig) {
      strategyContext = `
CRITICAL PERSONA CONTRACT:
You must evaluate how well the content adheres to this specific persona, without punishing it for not being a direct advertisement if the persona doesn't call for it.
Persona Name: ${personaConfig.name}
Description: ${personaConfig.description}
Worldview: ${personaConfig.reasoningProfile.worldview.join(" ")}
Reasoning Patterns: ${personaConfig.reasoningProfile.reasoningPatterns.join(" ")}
Avoidances: ${personaConfig.reasoningProfile.avoidances.join(" ")}

For the 'strategyScore', evaluate ONLY whether the content aligns with this persona contract without sacrificing relevance. Do NOT assume 'more philosophical = better' unless it explicitly matches the contract above.
`;
    }
  } else {
    const framework = MARKETING_TOPOLOGIES[strategyId] || MARKETING_TOPOLOGIES.benefit_led;
    strategyContext = `
CRITICAL MARKETING STRATEGY CONTRACT:
You must evaluate how well the content adheres to the ${strategyId} marketing framework.
Nodes expected: ${framework.nodes.join(" -> ")}

For the 'strategyScore', evaluate ONLY whether the content effectively employs this marketing structure and tone. Do NOT look for thought-leadership or personal branding, this is purely performance marketing.
`;
  }

  const objectiveContext = purpose === "marketing"
    ? `The content objective is: ${strategyId.includes("benefit") ? "sales via benefit-led framing" : strategyId.includes("pas") ? "sales via problem-agitation-solution" : "sales"}.`
    : "";

  const prompt = `
You are a senior marketing and social media copy evaluator.
Review this content written for ${platform} about "${topic}".

Evaluate the content on EXACTLY 5 independent dimensions. Each dimension is isolated — do not let a high score on one dimension inflate another.

${strategyContext}
${objectiveContext}

[DIMENSIONS — score each 1 to 5]

1. productFidelity (1-5):
   Does the content stay strictly within the facts provided in the source topic?
   5 = every claim is directly traceable to the input. No invented specs, stats, testimonials, or guarantees.
   1 = multiple fabricated facts that were not in the input.
   NOTE: A vague claim ("high quality") is acceptable if no specific fact contradicts it. An invented stat ("saves 40%") is NOT acceptable unless present in the input.

2. persuasion (1-5):
   Does the content compel the reader to take action or feel a genuine desire for the product/service?
   5 = strong hook, clear benefit, emotional resonance, compelling call to action.
   1 = dry listing of facts, no emotional pull, no clear reason to act.
   NOTE: This is NOT about beautiful language. A simple sentence can score 5 if it compels action. A poetic paragraph scores 1 if it doesn't make the reader want anything.

3. objectiveFit (1-5):
   Does the content serve the stated objective (${purpose === "marketing" ? strategyId : "thought leadership"})?
   5 = every element of the copy drives toward the objective. Nothing is wasted.
   1 = the content could serve any objective or none. No clear direction.

4. platformFit (1-5):
   Is the content appropriate for ${platform} in terms of format, length, tone, and platform norms?
   5 = perfectly calibrated for the platform. Feels native.
   1 = wrong length, wrong format, wrong tone for the platform.

5. naturalArabic (1-5):
   Is the Arabic natural, fluent, and non-robotic? Does it read like a human wrote it?
   5 = flows naturally, varied sentence structure, no translation artifacts.
   1 = stilted, mechanical, clearly AI-generated patterns, wrong register.
   NOTE: This is purely about linguistic quality, NOT about persuasion. A natural but unpersuasive text scores 5 here.

[FLAGS]
- "isOverConstrained" (boolean): True if the copy follows rules but loses its natural flow — becomes a mechanical checklist instead of human communication.
- "hasHallucinations" (boolean): True if the content invents any statistic, feature, testimonial, scarcity deadline, guarantee, or award NOT explicitly in the source topic string "${topic}".

[TEXT]
${fullText}

[OUTPUT FORMAT]
Return valid JSON only, no markdown:
{
  "productFidelity": number,
  "persuasion": number,
  "objectiveFit": number,
  "platformFit": number,
  "naturalArabic": number,
  "isOverConstrained": boolean,
  "hasHallucinations": boolean,
  "hallucinationDetails": {
    "type": "scarcity | testimonial | guarantee | statistic | claim | other | null",
    "claim": "the exact text of the fabricated claim (or null)",
    "unsupportedNode": "ID of the IR node that failed (or null)",
    "unsupportedAngle": "ID or text of the angle that failed (or null)",
    "unsupportedRendererClaim": "If the renderer invented something not in the IR, specify here (or null)"
  },
  "reasoning": "2-3 sentences. Cite specific evidence for any score below 4."
}
`;

  try {
    const res = await client.models.generateContent({
      model: modelName,
      contents: prompt,
      config: { temperature: 0.1, responseMimeType: "application/json" }
    });
    const parsed = JSON.parse(res.text || "{}");

    const productFidelity   = Math.min(5, Math.max(1, parsed.productFidelity  || 1));
    const persuasion        = Math.min(5, Math.max(1, parsed.persuasion       || 1));
    const objectiveFit      = Math.min(5, Math.max(1, parsed.objectiveFit     || 1));
    const platformFit       = Math.min(5, Math.max(1, parsed.platformFit      || 1));
    const naturalArabic     = Math.min(5, Math.max(1, parsed.naturalArabic    || 1));
    const hasHallucinations = !!parsed.hasHallucinations;
    const hallucinationDetails = parsed.hallucinationDetails;

    // Weighted composite:
    // productFidelity ×0.25 — factual integrity is table stakes
    // persuasion      ×0.30 — primary marketing goal
    // objectiveFit    ×0.20 — did it hit the brief?
    // platformFit     ×0.15 — channel suitability
    // naturalArabic   ×0.10 — necessary but not sufficient alone
    let publishReadyScore =
      productFidelity * 0.25 +
      persuasion      * 0.30 +
      objectiveFit    * 0.20 +
      platformFit     * 0.15 +
      naturalArabic   * 0.10;

    // Hard penalty: hallucination completely invalidates marketing output
    if (purpose === "marketing" && hasHallucinations) {
      publishReadyScore = 1;
    }

    return {
      productFidelity,
      persuasion,
      objectiveFit,
      platformFit,
      naturalArabic,
      publishReadyScore: Math.round(publishReadyScore * 100) / 100,
      isOverConstrained: !!parsed.isOverConstrained,
      hasHallucinations,
      hallucinationDetails,
      reasoning: parsed.reasoning || "",
    };
  } catch (error) {
    return {
      productFidelity: 1, persuasion: 1, objectiveFit: 1, platformFit: 1, naturalArabic: 1,
      publishReadyScore: 1, isOverConstrained: false, hasHallucinations: false, hallucinationDetails: undefined, reasoning: String(error),
    };
  }
}

// ---------------------------------------------------------------------------
// 4. Intellectual Diversity — Forced Mode Benchmark
//
// IMPORTANT: This runs 3 full pipeline calls per topic (one per mode).
// It is NOT part of the standard 30-case benchmark run.
// Activate with: npx tsx scripts/run-planner-benchmark.ts --diversity
// ---------------------------------------------------------------------------

export type IntellectualMode = "thought_provoking" | "analytical" | "philosophical";
const INTELLECTUAL_MODES: IntellectualMode[] = ["thought_provoking", "analytical", "philosophical"];

export interface DiversityModeResult {
  mode: IntellectualMode;
  content?: GeneratedContent;
  success: boolean;
  error?: string;
}

export interface IntellectualDiversityResult {
  topic: string;
  platform: string;
  modes: DiversityModeResult[];
  status: "success" | "insufficient_outputs";
  /**
   * Average pairwise Jaccard similarity of normalized token sets (0–1).
   * Lower = more lexically diverse.
   */
  lexicalSimilarity: number | null;
  /**
   * Average pairwise structural divergence score (0–1).
   * Based on delta in sentence count, question count, and paragraph count.
   * Higher = more structurally different.
   */
  structuralDivergence: number | null;
  /** LLM judge scores (1–5) across the 3 outputs together. */
  llmDistinctness: number | null;
  llmModeFidelity: number | null;
  llmTemplateRepetition: number | null;
  llmReasoning: string;
}

/** Tokenize Arabic/Latin text: lowercase words, strip punctuation. */
function tokenize(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .replace(/[\u060C\u061B\u061F\u0021-\u002F\u003A-\u0040\u005B-\u0060\u007B-\u007E]/g, " ")
      .split(/\s+/)
      .filter(Boolean)
  );
}

/** Jaccard similarity between two token sets. */
function jaccard(a: Set<string>, b: Set<string>): number {
  const intersection = [...a].filter(t => b.has(t)).length;
  const union = new Set([...a, ...b]).size;
  return union === 0 ? 1 : intersection / union;
}

/** Count sentences (Arabic + Latin sentence terminators). */
function countSentences(text: string): number {
  return (text.match(/[.!?؟\.]/g) || []).length;
}

/** Count question marks (Arabic + Latin). */
function countQuestions(text: string): number {
  return (text.match(/[?؟]/g) || []).length;
}

/** Count paragraphs (double newline separated). */
function countParagraphs(text: string): number {
  return text.split(/\n\n+/).filter(Boolean).length;
}

/**
 * Structural divergence between two outputs (0–1).
 * Compares sentence count, question count, and paragraph count deltas.
 * Normalized to 0–1 where 1 = maximally different.
 */
function structuralDivergencePair(a: GeneratedContent, b: GeneratedContent): number {
  const aText = `${a.title} ${a.hook} ${a.body} ${a.callToAction}`;
  const bText = `${b.title} ${b.hook} ${b.body} ${b.callToAction}`;

  const sentDelta = Math.abs(countSentences(aText) - countSentences(bText));
  const qDelta = Math.abs(countQuestions(aText) - countQuestions(bText));
  const paraDelta = Math.abs(countParagraphs(a.body) - countParagraphs(b.body));

  // Normalize each dimension and average. Max expected deltas: sent=10, q=3, para=5.
  const normSent = Math.min(sentDelta / 10, 1);
  const normQ = Math.min(qDelta / 3, 1);
  const normPara = Math.min(paraDelta / 5, 1);
  return (normSent + normQ + normPara) / 3;
}

export async function evaluateIntellectualDiversity(
  baseRequest: PlannerRequestDTO
): Promise<IntellectualDiversityResult> {
  const client = createVertexAIClient();
  const modelName = process.env.GEMINI_MODEL || "gemini-2.5-flash-lite";

  // ── 1. Run 3 pipeline calls with forced modes ──────────────────────────
  const modeResults: DiversityModeResult[] = [];
  for (const mode of INTELLECTUAL_MODES) {
    const modeRequest: PlannerRequestDTO = {
      ...baseRequest,
      constraints: {
        ...baseRequest.constraints,
        forcedIntellectualMode: mode,
      },
    };
    const result = await runPlannerLocal(modeRequest);
    modeResults.push({
      mode,
      content: result.content,
      success: result.success,
      error: result.error,
    });
  }

  const successfulOutputs = modeResults.filter(r => r.success && r.content);

  // ── 2. Lexical similarity (pairwise Jaccard average) ──────────────────
  let lexicalSimilarity: number | null = null;
  if (successfulOutputs.length >= 3) {
    const pairs: number[] = [];
    for (let i = 0; i < successfulOutputs.length; i++) {
      for (let j = i + 1; j < successfulOutputs.length; j++) {
        const a = successfulOutputs[i].content!;
        const b = successfulOutputs[j].content!;
        const aText = `${a.title} ${a.hook} ${a.body} ${a.callToAction}`;
        const bText = `${b.title} ${b.hook} ${b.body} ${b.callToAction}`;
        pairs.push(jaccard(tokenize(aText), tokenize(bText)));
      }
    }
    lexicalSimilarity = pairs.reduce((s, v) => s + v, 0) / pairs.length;
  }

  // ── 3. Structural divergence (pairwise average) ───────────────────────
  let structuralDivergence: number | null = null;
  if (successfulOutputs.length >= 3) {
    const pairs: number[] = [];
    for (let i = 0; i < successfulOutputs.length; i++) {
      for (let j = i + 1; j < successfulOutputs.length; j++) {
        pairs.push(structuralDivergencePair(
          successfulOutputs[i].content!,
          successfulOutputs[j].content!
        ));
      }
    }
    structuralDivergence = pairs.reduce((s, v) => s + v, 0) / pairs.length;
  }

  // ── 4. LLM judge — distinctness, mode fidelity, template repetition ───
  let llmDistinctness: number | null = null;
  let llmModeFidelity: number | null = null;
  let llmTemplateRepetition: number | null = null;
  let llmReasoning = "Insufficient successful outputs for LLM evaluation.";

  if (successfulOutputs.length >= 3) {
    const outputBlocks = successfulOutputs
      .map(r => `[MODE: ${r.mode}]\n${r.content!.title}\n${r.content!.hook}\n${r.content!.body}\n${r.content!.callToAction}`)
      .join("\n\n---\n\n");

    const judgePrompt = `
You are an expert rhetorical analyst. You have received ${successfulOutputs.length} pieces of content written about the SAME topic but in different FORCED rhetorical modes.

Your job is to assess whether the outputs are genuinely distinct in structure, vocabulary, and argumentative strategy — or whether they are essentially the same template with different words.

[CONTENT OUTPUTS]
${outputBlocks}

Rate the following on a scale of 1–5:
- "distinctness": How structurally and rhetorically different are the outputs from each other? (1 = nearly identical, 5 = completely different in structure, strategy, and vocabulary)
- "mode_fidelity": How faithfully does each output follow its assigned rhetorical mode? (1 = modes are barely distinguishable, 5 = each output is a clear exemplar of its mode)
- "template_repetition": How much do the outputs share a repeating template/formula? (1 = no template pattern visible, 5 = clearly the same template slightly reformulated)

[OUTPUT FORMAT]
Return valid JSON only, no markdown:
{
  "distinctness": number,
  "mode_fidelity": number,
  "template_repetition": number,
  "reasoning": "2–4 sentences citing specific structural evidence from the outputs."
}
`;

    try {
      const res = await client.models.generateContent({
        model: modelName,
        contents: judgePrompt,
        config: { temperature: 0.1, responseMimeType: "application/json" },
      });
      const judgeResult = JSON.parse(res.text || "{}");
      llmDistinctness = judgeResult.distinctness ?? 1;
      llmModeFidelity = judgeResult.mode_fidelity ?? 1;
      llmTemplateRepetition = judgeResult.template_repetition ?? 5;
      llmReasoning = judgeResult.reasoning ?? "";
    } catch (error) {
      llmReasoning = `LLM judge failed: ${error}`;
    }
  }

  return {
    topic: baseRequest.topic,
    platform: baseRequest.platform,
    modes: modeResults,
    status: successfulOutputs.length >= 3 ? "success" : "insufficient_outputs",
    lexicalSimilarity: lexicalSimilarity !== null ? Math.round(lexicalSimilarity * 1000) / 1000 : null,
    structuralDivergence: structuralDivergence !== null ? Math.round(structuralDivergence * 1000) / 1000 : null,
    llmDistinctness,
    llmModeFidelity,
    llmTemplateRepetition,
    llmReasoning,
  };
}
