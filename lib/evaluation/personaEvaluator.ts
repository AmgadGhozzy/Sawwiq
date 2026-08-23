import { GoogleGenAI, Type } from "@google/genai";
import { nextEvalModel } from "./modelPool";

// ─── Persona fingerprints sent to the evaluator ───────────────────────────
// These describe HOW each persona thinks, NOT what domain they talk about.
// Deliberately abstracted away from domain vocabulary to force structural
// classification rather than topic-leakage classification.
const PERSONA_FINGERPRINTS_V1 = `
A) Systems / Structural Thinker
   - Frames problems as systems with inputs, outputs, and bottlenecks.
   - Looks for root causes and failure modes rather than symptoms.
   - Proposes structural fixes or rules; thinks in trade-offs and constraints.
   - Conclusions feel like an algorithm or a diagnostic finding.

B) Behavioral / Human Pattern Analyst
   - Starts from human motivation, emotional need, or behavioral context.
   - Separates observable action from its internal driver.
   - Focuses on the gap between what people say and what they do.
   - Conclusions feel like a shift in self-awareness or emotional reframing.

C) Philosophical / Dialectical Thinker
   - Starts from a widely-held assumption and immediately questions it.
   - Builds thesis → antithesis → synthesis; hunts paradoxes.
   - Distinguishes correlation from causation; explores hidden costs and second-order effects.
   - Conclusions feel like a paradigm shift or a redefinition of the original question.

D) Narrative / Associative Thinker
   - Starts from an unexpected angle, a sensory detail, or a counterintuitive analogy.
   - Deliberately leaps between associations to create "aha" moments.
   - Prioritizes surprise and emotional resonance before logical explanation.
   - Conclusions tie back to the opening image or leave an evocative open note.
`;

const PERSONA_FINGERPRINTS_V2 = `
A) Systems / Structural Thinker
   - Frames problems as systems with inputs, outputs, and bottlenecks.
   - Looks for root causes and failure modes rather than symptoms.
   - Proposes structural fixes or rules; thinks in trade-offs and constraints.
   - Conclusions feel like an algorithm or a diagnostic finding.

B) Behavioral / Human Pattern Analyst
   REQUIRES ALL FOUR:
   ✓ Motive identified (what drives the behavior, not just what the behavior is)
   ✓ Observable gap (difference between intent and action, measurable or describable)
   ✓ Internal reinforcement mechanism (why the behavior persists)
   ✓ Self-perception shift in conclusion (awareness change, not a tip or rule)

   NOT B if:
   ✗ Text merely uses emotional vocabulary without behavioral mechanism.
   ✗ Argument could be fully stated without human emotion (= A or C).
   ✗ Conclusion is a rule/tip rather than an awareness shift.

C) Philosophical / Dialectical Thinker
   - Starts from a widely-held assumption and immediately questions it.
   - Builds thesis → antithesis → synthesis; hunts paradoxes.
   - Distinguishes correlation from causation; explores hidden costs and second-order effects.
   - Conclusions feel like a paradigm shift or a redefinition of the original question.

D) Narrative / Associative Thinker
   - Starts from an unexpected angle, a sensory detail, or a counterintuitive analogy.
   - Deliberately leaps between associations to create "aha" moments.
   - Prioritizes surprise and emotional resonance before logical explanation.
   - Conclusions tie back to the opening image or leave an evocative open note.
`;

export const BLIND_CLASSIFICATION_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    predicted_persona: { type: Type.STRING, enum: ["A", "B", "C", "D"] },
    confidence_score: { type: Type.INTEGER },
    reasoning_pattern_detected: { type: Type.STRING },
    is_relying_on_cheap_keywords: { type: Type.BOOLEAN },
    // Dimensional scores (0-100 match for each fingerprint dimension)
    worldview_match: { type: Type.INTEGER },
    reasoning_match: { type: Type.INTEGER },
    evidence_match: { type: Type.INTEGER },
    conclusion_match: { type: Type.INTEGER },
    // Topic leakage risk: how much did the topic itself (not the reasoning) influence your prediction?
    topic_leakage_risk: { type: Type.INTEGER },
  },
  required: [
    "predicted_persona",
    "confidence_score",
    "reasoning_pattern_detected",
    "is_relying_on_cheap_keywords",
    "worldview_match",
    "reasoning_match",
    "evidence_match",
    "conclusion_match",
    "topic_leakage_risk",
  ],
};

export async function evaluatePersona(text: string, version: "v1" | "v2" = "v2") {
  const ai = new GoogleGenAI({
    vertexai: true,
    apiKey: process.env.VERTEX_AI_API_KEY,
  });

  const systemPrompt = `
<system_role>
You are an expert Forensic Linguist. Your task is to classify an Arabic text's
author persona based ONLY on how they think — not what they think about.
</system_role>

<critical_rule>
THE TOPIC IS NOT EVIDENCE OF PERSONA.

A text about psychology CAN be written by persona A (Systems Thinker).
A text about software CAN be written by persona B (Behavioral Analyst).
The subject matter is irrelevant. What matters is the cognitive fingerprint.

NEVER classify based on:
- Domain vocabulary (e.g., "system", "emotion", "logic", "story")
- Subject matter (e.g., tech, psychology, philosophy, art)
- Explicit persona labels
- Arabic keywords associated with a domain

ONLY classify based on:
1. Worldview framing: How does the author perceive the problem's nature?
2. Reasoning pattern: What logical structure do they use to analyze it?
3. Evidence preference: What counts as proof for this author?
4. Conclusion structure: How do they resolve or synthesize the argument?
</critical_rule>

<persona_fingerprints>
${version === "v1" ? PERSONA_FINGERPRINTS_V1 : PERSONA_FINGERPRINTS_V2}
</persona_fingerprints>

<scoring>
For each dimension (worldview_match, reasoning_match, evidence_match, conclusion_match):
  Score 0-100 representing how strongly this text's dimension matches the PREDICTED persona's fingerprint.
  All four should be ≥ 60 for a confident classification.

For topic_leakage_risk:
  Score 0-100 representing how much the TOPIC itself (not the reasoning) influenced your prediction.
  0 = pure structural classification. 100 = you basically guessed from the topic.
  Be honest. If imposter_syndrome → B felt obvious from the topic, report high risk.
</scoring>
`.trim();

  const userPrompt = `
<text_to_evaluate>
${text}
</text_to_evaluate>
`.trim();

  const response = await ai.models.generateContent({
    model: nextEvalModel(),
    contents: userPrompt,
    config: {
      systemInstruction: systemPrompt,
      responseMimeType: "application/json",
      responseSchema: BLIND_CLASSIFICATION_SCHEMA,
      temperature: 0.1,
    },
  });

  return JSON.parse(response.text!);
}
