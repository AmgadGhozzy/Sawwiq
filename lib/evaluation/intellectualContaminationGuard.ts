import { GoogleGenAI, Type } from "@google/genai";
import { nextEvalModel } from "./modelPool";
import path from "path";
import { config } from "dotenv";
config({ path: path.join(process.cwd(), ".env.local") });

// ─── EXP-014: Anti-Developer Contamination Guard ─────────────────────────────
//
// Context: EXP-013 showed that IR Purity = 93.3 was partially misleading.
// The graph was structurally correct, but the *content* of nodes was Developer-
// contaminated: reframe was offering solutions, synthesis was recommending actions.
//
// This guard operationalizes the two contamination signals identified in EXP-014
// design:
//
//   Signal 1 — Rewritability Test:
//     "Could this IR be naturally rewritten as: problem → intervention → outcome?"
//     YES → Developer contamination.
//
//   Signal 2 — Synthesis Intent Test:
//     "Does the synthesis answer 'what should we do?'" → FAIL
//     "Does the synthesis change 'what the problem/question means?'" → PASS
//
// The guard is a standalone evaluator — it does NOT modify the IR.
// It runs on the *rendered Arabic surface text* after R2 rendering.
// ─────────────────────────────────────────────────────────────────────────────

const ai = new GoogleGenAI({
  vertexai: true,
  apiKey: process.env.VERTEX_AI_API_KEY,
});

// ─── Schema ──────────────────────────────────────────────────────────────────

export const CONTAMINATION_GUARD_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    // Signal 1
    rewritable_as_problem_intervention_outcome: {
      type: Type.BOOLEAN,
      description:
        "TRUE if the full text can be naturally paraphrased as: 'There is a problem X. The intervention Y addresses it. The measurable outcome is Z.' This is Developer contamination.",
    },
    rewritability_evidence: {
      type: Type.STRING,
      description:
        "Quote the specific part of the text that enabled (or blocked) the problem→intervention→outcome rewrite.",
    },
    // Signal 2
    synthesis_answers_what_to_do: {
      type: Type.BOOLEAN,
      description:
        "TRUE if the conclusion/synthesis section of the text primarily answers 'what should we do?' or 'what is the recommended action?'. This is a FAIL signal for Intellectual.",
    },
    synthesis_changes_meaning: {
      type: Type.BOOLEAN,
      description:
        "TRUE if the conclusion/synthesis section primarily changes 'what the original question/concept MEANS', redefines the phenomenon, or exposes the original framing as a category error. This is a PASS signal for Intellectual.",
    },
    synthesis_evidence: {
      type: Type.STRING,
      description: "Quote the synthesis/conclusion section of the text verbatim.",
    },
    // Verdict
    is_developer_contaminated: {
      type: Type.BOOLEAN,
      description:
        "Overall verdict. TRUE if (rewritable_as_problem_intervention_outcome = TRUE) OR (synthesis_answers_what_to_do = TRUE AND synthesis_changes_meaning = FALSE).",
    },
    contamination_type: {
      type: Type.STRING,
      description:
        "One of: 'none' | 'rewritable' | 'prescriptive_synthesis' | 'both'. Describes which signals triggered contamination.",
    },
    confidence: {
      type: Type.NUMBER,
      description: "Evaluator's confidence in the contamination verdict (0.0 to 1.0).",
    },
  },
  required: [
    "rewritable_as_problem_intervention_outcome",
    "rewritability_evidence",
    "synthesis_answers_what_to_do",
    "synthesis_changes_meaning",
    "synthesis_evidence",
    "is_developer_contaminated",
    "contamination_type",
    "confidence",
  ],
};

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ContaminationGuardResult {
  rewritable_as_problem_intervention_outcome: boolean;
  rewritability_evidence: string;
  synthesis_answers_what_to_do: boolean;
  synthesis_changes_meaning: boolean;
  synthesis_evidence: string;
  is_developer_contaminated: boolean;
  contamination_type: "none" | "rewritable" | "prescriptive_synthesis" | "both";
  confidence: number;
}

// ─── Evaluator ───────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `
<role>
You are a Semantic Contamination Analyst. Your task is to determine whether a given text,
which should be written from the INTELLECTUAL persona, has been contaminated by
DEVELOPER persona reasoning patterns.

The INTELLECTUAL persona is defined by:
- Questioning foundational assumptions
- Exposing contradictions in epistemic frameworks
- Reframing "what question should we be asking?" instead of "what is the answer?"
- Synthesizing a redefinition of the concept — NOT a recommended course of action

The DEVELOPER persona is defined by:
- Identifying a problem or bottleneck
- Proposing an intervention to fix it
- Pointing to a measurable or observable outcome
</role>

<contamination_definition>
Developer contamination occurs when EITHER:
1. REWRITABILITY: The text can be naturally paraphrased as:
   "There is a problem X → intervention Y addresses it → the measurable outcome is Z"
   
2. PRESCRIPTIVE SYNTHESIS: The conclusion/synthesis section crosses from *redefining what the question/system means* into *prescribing a concrete intervention or implementation path*.
</contamination_definition>

<critical_distinction>
INTELLECTUAL synthesis: Changes the meaning of the original phenomenon, or shifts the conceptual goal (e.g., a paradigm shift).
  Example 1: "The question is not 'how do we decide better?' — it is that the very concept of 'a good decision' presupposes a stable future."
  Example 2: "Education should be understood as the cultivation of continuous inquiry and adaptation, rather than the transmission of facts." 
  (Note: Redefining the goal as "cultivation" is a philosophical reframe, NOT an intervention).

DEVELOPER synthesis: Recommends a concrete action, behavioral change, or implementation step.
  Example 1: "Therefore, the key is to adopt a more systematic approach to decision-making by separating the data phase from the judgment phase."
  Example 2: "Schools should replace fixed curricula with adaptive modules and train teachers to measure growth."

Both may use philosophical-sounding language. The test is: does it tell you what the concept/goal MEANS, or does it tell you how to IMPLEMENT a fix?
</critical_distinction>
`.trim();

export async function evaluateIntellectualContamination(
  renderedText: string,
  configOverrides?: Record<string, any>
): Promise<ContaminationGuardResult> {
  const userPrompt = `
<text_to_evaluate>
${renderedText}
</text_to_evaluate>

Evaluate this text for Developer contamination using both signals.
`.trim();

  const response = await ai.models.generateContent({
    model: nextEvalModel(),
    contents: userPrompt,
    config: {
      systemInstruction: SYSTEM_PROMPT,
      responseMimeType: "application/json",
      responseSchema: CONTAMINATION_GUARD_SCHEMA,
      temperature: configOverrides?.temperature ?? 0.1,
    },
  });

  const result = JSON.parse(response.text!) as ContaminationGuardResult;

  // Enforce the verdict logic deterministically regardless of LLM output
  // to prevent the evaluator from being lenient when signals are mixed.
  const rewritable = result.rewritable_as_problem_intervention_outcome;
  const prescriptiveSynthesis =
    result.synthesis_answers_what_to_do && !result.synthesis_changes_meaning;

  let contamination_type: ContaminationGuardResult["contamination_type"] = "none";
  if (rewritable && prescriptiveSynthesis) contamination_type = "both";
  else if (rewritable) contamination_type = "rewritable";
  else if (prescriptiveSynthesis) contamination_type = "prescriptive_synthesis";

  return {
    ...result,
    is_developer_contaminated: rewritable || prescriptiveSynthesis,
    contamination_type,
  };
}

// ─── EXP-014 Gate Helpers ─────────────────────────────────────────────────────

/** EXP-014 gate: Developer collision ≤ 10% across Intellectual cases. */
export function computeContaminationRate(results: ContaminationGuardResult[]): number {
  if (results.length === 0) return 0;
  const contaminated = results.filter((r) => r.is_developer_contaminated).length;
  return (contaminated / results.length) * 100;
}

/** Returns true if this batch passes the EXP-014 contamination gate (≤ 10%). */
export function passesContaminationGate(results: ContaminationGuardResult[]): boolean {
  return computeContaminationRate(results) <= 10;
}
