import { GoogleGenAI, Type } from "@google/genai";
import { nextEvalModel } from "./modelPool";
import { PersonaId } from "./types";
import { evaluatePersona } from "./personaEvaluator";

// ─── Ablation Instructions ────────────────────────────────────────────────────
// Strips ONLY vocabulary signals — reasoning, causal structure, and argument flow
// must remain intact. This isolates whether the evaluator is classifying based
// on structure or just on surface-level word choices.

const ABLATION_INSTRUCTIONS: Record<PersonaId, string> = {
  developer:
    "Remove or replace all technical, software, or engineering vocabulary (e.g., system, bug, scale, algorithm, optimize, constraints, pipeline, bottleneck, mechanism). Use plain everyday Arabic equivalents.",
  psychology:
    "Remove or replace all psychological, therapeutic, or behavioral vocabulary (e.g., trauma, dopamine, cognitive bias, emotional needs, inner child, motive, trigger, reinforcement). Use plain everyday Arabic equivalents.",
  intellectual:
    "Remove or replace all academic, philosophical, or dialectical vocabulary (e.g., paradox, paradigm, synthesis, dichotomy, correlation, assumption, antithesis). Use plain everyday Arabic equivalents.",
  creative:
    "Remove or replace all explicit storytelling, artistic, or poetic framing vocabulary (e.g., imagine, canvas, symphony, narrative arc, metaphor, story, vivid). Use plain everyday Arabic equivalents.",
};

// ─── 4-Signal Weighted Ablation Schema ───────────────────────────────────────

export const WEIGHTED_ABLATION_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    // Signal 1 (weight 0.30): Did the reasoning structure change?
    reasoning_structure_delta: {
      type: Type.INTEGER,
      description: "0-100: how much did the REASONING STRUCTURE change after ablation? 0=identical, 100=completely different.",
    },
    reasoning_structure_evidence: {
      type: Type.STRING,
      description: "What specific reasoning patterns are present/absent in the full vs ablated text?",
    },
    // Signal 2 (weight 0.30): Did the causal model change?
    causal_model_delta: {
      type: Type.INTEGER,
      description: "0-100: how much did the CAUSAL MODEL (cause-effect-intervention chain) change after ablation?",
    },
    causal_model_evidence: {
      type: Type.STRING,
      description: "What causal relationships are present/absent in the full vs ablated text?",
    },
    // Signal 3 (weight 0.25): Did the worldview framing change?
    worldview_framing_delta: {
      type: Type.INTEGER,
      description: "0-100: how much did the WORLDVIEW FRAMING (how the author perceives the problem) change after ablation?",
    },
    worldview_framing_evidence: {
      type: Type.STRING,
      description: "How does the author frame the problem in the full text vs ablated text?",
    },
    // Signal 4 (weight 0.15): Did vocabulary change? (LEAST important signal)
    vocabulary_delta: {
      type: Type.INTEGER,
      description: "0-100: how much did surface-level VOCABULARY change after ablation?",
    },
    vocabulary_evidence: {
      type: Type.STRING,
      description: "What specific words/phrases were changed and what replaced them?",
    },
    is_vocabulary_only_change: {
      type: Type.BOOLEAN,
      description: "True if the change is ONLY in vocabulary, with no structural/causal/worldview change.",
    },
  },
  required: [
    "reasoning_structure_delta",
    "reasoning_structure_evidence",
    "causal_model_delta",
    "causal_model_evidence",
    "worldview_framing_delta",
    "worldview_framing_evidence",
    "vocabulary_delta",
    "vocabulary_evidence",
    "is_vocabulary_only_change",
  ],
};

export interface WeightedAblationSignals {
  reasoning_structure_delta: number;
  reasoning_structure_evidence: string;
  causal_model_delta: number;
  causal_model_evidence: string;
  worldview_framing_delta: number;
  worldview_framing_evidence: string;
  vocabulary_delta: number;
  vocabulary_evidence: string;
  is_vocabulary_only_change: boolean;
}

// ─── Weighted Score Computation ───────────────────────────────────────────────

/**
 * AblationScore = 0.30 × reasoning + 0.30 × causal + 0.25 × worldview + 0.15 × vocabulary
 *
 * A high score means the full-persona text is structurally different from the
 * ablated text — the persona is doing real causal/structural work.
 * A low score (≤ 15) means the persona was only changing vocabulary.
 */
export function computeWeightedAblationScore(signals: WeightedAblationSignals): number {
  return Math.round(
    0.30 * signals.reasoning_structure_delta +
    0.30 * signals.causal_model_delta +
    0.25 * signals.worldview_framing_delta +
    0.15 * signals.vocabulary_delta
  );
}

// ─── Text Ablation ───────────────────────────────────────────────────────────

export async function ablateText(text: string, persona: PersonaId): Promise<string> {
  const { callAI, MODEL } = require("../../scripts/lib/aiClient");
  const instructions = ABLATION_INSTRUCTIONS[persona] ??
    "Remove or replace any highly specific domain jargon with plain everyday Arabic.";

  const systemPrompt = `
You are an expert editor performing a 'Vocabulary Ablation' on Arabic text.
${instructions}

STRICT RULES:
1. Replace the specific domain words with normal, everyday Arabic words.
2. DO NOT change the underlying logic, reasoning, causal structure, or argument flow.
3. DO NOT summarize or shorten. Keep identical length and structure — only swap revealing vocabulary for neutral equivalents.
4. Output ONLY the ablated Arabic text. Do not add any commentary.
  `.trim();

  const response = await callAI({
    model: MODEL.LITE,
    contents: text,
    config: {
      systemInstruction: systemPrompt,
      temperature: 0.1,
    },
  });

  return response.trim();
}

// ─── 4-Signal Comparison ─────────────────────────────────────────────────────

export async function compareFullVsAblated(
  fullText: string,
  ablatedText: string,
): Promise<WeightedAblationSignals> {
  const { callAIJson, MODEL } = require("../../scripts/lib/aiClient");

  const systemPrompt = `
<role>
You are an expert Forensic Linguist comparing two versions of the same Arabic text:
- VERSION A: The original (full persona)
- VERSION B: A vocabulary-ablated version (same structure, neutral words)

Your task is to measure HOW MUCH each structural dimension changed after ablation.
A high delta means the full text had rich structural signals that disappeared when vocabulary was removed.
A low delta means the text relied only on vocabulary to signal its persona.
</role>

<critical_rule>
You are measuring STRUCTURAL and CAUSAL differences — NOT vocabulary differences.
A text that says "system bottleneck" vs "problem area" may have identical reasoning structure.
A text that shifts from "identify the mechanism" to "describe the feeling" has changed its CAUSAL MODEL.
Focus on what the argument DOES, not what words it uses.
</critical_rule>
`.trim();

  const userPrompt = `
<version_a_full>
${fullText}
</version_a_full>

<version_b_ablated>
${ablatedText}
</version_b_ablated>

Compare the two versions across the four structural dimensions.
`.trim();

  const response = await callAIJson({
    model: MODEL.EVALUATION,
    contents: userPrompt,
    config: {
      systemInstruction: systemPrompt,
      responseMimeType: "application/json",
      responseSchema: WEIGHTED_ABLATION_SCHEMA,
      temperature: 0.1,
    },
  });

  return response as WeightedAblationSignals;
}

// ─── Backward-Compatible Entry Point ─────────────────────────────────────────

/** Used by EXP-004 runner — unchanged interface. */
export async function evaluateAblatedPersona(text: string, persona: PersonaId) {
  const ablatedText = await ablateText(text, persona);
  const pEval = await evaluatePersona(ablatedText);
  return { ablatedText, evaluation: pEval };
}

// ─── Full Weighted Entry Point (EXP-005) ─────────────────────────────────────

/**
 * Full weighted ablation evaluation.
 * Returns the 4-signal breakdown + computed weighted score.
 * Use this in EXP-005 for the ablationDelta gate (≥ 25).
 */
export async function evaluateAblationWeighted(text: string, persona: PersonaId): Promise<{
  ablatedText: string;
  signals: WeightedAblationSignals;
  weightedScore: number;
  isVocabularyOnly: boolean;
  blindClassificationAfterAblation: any;
}> {
  const ablatedText = await ablateText(text, persona);
  const signals = await compareFullVsAblated(text, ablatedText);
  const weightedScore = computeWeightedAblationScore(signals);
  const blindClassificationAfterAblation = await evaluatePersona(ablatedText);

  return {
    ablatedText,
    signals,
    weightedScore,
    isVocabularyOnly: signals.is_vocabulary_only_change,
    blindClassificationAfterAblation,
  };
}
