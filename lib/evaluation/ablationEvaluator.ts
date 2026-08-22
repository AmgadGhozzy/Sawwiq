import { GoogleGenAI, Type } from "@google/genai";
import { PersonaId } from "./types";
import { evaluatePersona } from "./personaEvaluator";

export async function ablateText(text: string, persona: PersonaId): Promise<string> {
  const ai = new GoogleGenAI({
    vertexai: true,
    apiKey: process.env.VERTEX_AI_API_KEY,
  });

  let instructions = "";
  switch (persona) {
    case "developer":
      instructions = "Remove or replace all technical, software, or engineering jargon (e.g., system, bug, scale, algorithm, optimize, constraints).";
      break;
    case "psychology":
      instructions = "Remove or replace all psychological, therapeutic, or behavioral jargon (e.g., trauma, dopamine, cognitive bias, emotional needs, inner child).";
      break;
    case "intellectual":
      instructions = "Remove or replace all academic, philosophical, or overly intellectual jargon (e.g., paradox, paradigm, synthesis, dichotomy, correlation).";
      break;
    case "creative":
      instructions = "Remove or replace all explicit storytelling, artistic, or overly poetic framing words (e.g., imagine, canvas, symphony, narrative arc).";
      break;
    default:
      instructions = "Remove or replace any highly specific domain jargon.";
  }

  const systemPrompt = `
You are an expert editor. Your task is to perform a 'Vocabulary Ablation' on the provided Arabic text.
${instructions}

RULES:
1. Replace the specific domain words with normal, everyday Arabic words.
2. DO NOT change the underlying logic, reasoning, or structure of the text.
3. DO NOT summarize. Keep the same length and flow, just swap the revealing vocabulary for neutral equivalents.
4. Output ONLY the ablated Arabic text. Do not add any commentary.
  `.trim();

  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash-lite",
    contents: text,
    config: {
      systemInstruction: systemPrompt,
      temperature: 0.1,
    },
  });

  return response.text!.trim();
}

export async function evaluateAblatedPersona(text: string, persona: PersonaId) {
  // 1. Ablate the text
  const ablatedText = await ablateText(text, persona);
  
  // 2. Run the normal blind classifier on the ablated text
  const pEval = await evaluatePersona(ablatedText);
  
  return {
    ablatedText,
    evaluation: pEval
  };
}
