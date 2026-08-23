import { GoogleGenAI, Type } from "@google/genai";
import { nextEvalModel } from "./modelPool";
import { PersonaId } from "./types";

export interface ReasoningSeparationResult {
  reasoning_difference: string;
  worldview_difference: string;
  causal_model_difference: string;
  is_vocabulary_only_swap: boolean;
  separation_score: number;
}

export const REASONING_SEPARATION_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    reasoning_difference: {
      type: Type.STRING,
      description: "How does the underlying reasoning structure differ between the two texts?",
    },
    worldview_difference: {
      type: Type.STRING,
      description: "How does the starting assumption/framing of the topic differ?",
    },
    causal_model_difference: {
      type: Type.STRING,
      description: "How do the causal mechanisms (cause-effect relationships) differ?",
    },
    is_vocabulary_only_swap: {
      type: Type.BOOLEAN,
      description: "True if the arguments are structurally identical and ONLY differ by domain vocabulary (e.g. replacing 'system' with 'mind').",
    },
    separation_score: {
      type: Type.INTEGER,
      description: "0-100: How deeply separated are the cognitive models? 0 = identical structure/only vocab changed. 100 = completely different ways of thinking about the topic.",
    },
  },
  required: [
    "reasoning_difference",
    "worldview_difference",
    "causal_model_difference",
    "is_vocabulary_only_swap",
    "separation_score",
  ],
};

export async function evaluateReasoningSeparation(
  textA: string,
  personaA: PersonaId,
  textB: string,
  personaB: PersonaId,
): Promise<ReasoningSeparationResult> {
  const ai = new GoogleGenAI({
    vertexai: true,
    apiKey: process.env.VERTEX_AI_API_KEY,
  });

  const systemPrompt = `
<role>
You are an expert Forensic Linguist analyzing two pieces of Arabic content generated on the same topic.
Your goal is to determine if they represent genuinely different ways of thinking (Cognitive Separation) or just different word choices (Vocabulary Swap).
</role>

<critical_rule>
DO NOT BE FOOLED BY VOCABULARY.
If Text A says "The bottleneck in the system is X" and Text B says "The emotional block in the mind is X" — these are STRUCTURALLY IDENTICAL. They share the same causal model, just different words. This is a vocabulary swap (is_vocabulary_only_swap = true).

True separation means:
- Different starting assumptions (Worldview).
- Different cause-and-effect mechanisms (Causal Model).
- Different structural flow (Reasoning).
</critical_rule>
`.trim();

  const userPrompt = `
<text_a_persona_${personaA}>
${textA}
</text_a_persona_${personaA}>

<text_b_persona_${personaB}>
${textB}
</text_b_persona_${personaB}>

Analyze the cognitive separation between these two texts.
`.trim();

  const response = await ai.models.generateContent({
    model: nextEvalModel(),
    contents: userPrompt,
    config: {
      systemInstruction: systemPrompt,
      responseMimeType: "application/json",
      responseSchema: REASONING_SEPARATION_SCHEMA,
      temperature: 0.1,
    },
  });

  return JSON.parse(response.text!);
}

