import { GoogleGenAI, Type } from "@google/genai";



export const FINGERPRINT_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    persona_separation_score: { type: Type.INTEGER },
    perspective_difference: { type: Type.STRING },
    reasoning_difference: { type: Type.STRING },
    voice_difference: { type: Type.STRING },
    is_just_vocabulary_swap: { type: Type.BOOLEAN },
  },
  required: ["persona_separation_score", "perspective_difference", "reasoning_difference", "voice_difference", "is_just_vocabulary_swap"],
};

export async function evaluateFingerprintSeparation(textA: string, textB: string) {
  const ai = new GoogleGenAI({
    vertexai: true,
    apiKey: process.env.VERTEX_AI_API_KEY,
  });
  const systemPrompt = `
<task>
Analyze Text 1 and Text 2. They discuss the same topic. 
Score the "Persona Separation" (0 to 100) based on how fundamentally different their reasoning, voice, and perspective are.
If they only differ by swapping vocabulary (e.g., swapping "brain" with "CPU"), score it below 30.
If they approach the core problem from entirely different mental models, score it above 80.
</task>
  `.trim();

  const userPrompt = `
<text_1>
${textA}
</text_1>

<text_2>
${textB}
</text_2>
  `.trim();

  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash-lite",
    contents: userPrompt,
    config: {
      systemInstruction: systemPrompt,
      responseMimeType: "application/json",
      responseSchema: FINGERPRINT_SCHEMA,
      temperature: 0.1,
    },
  });

  return JSON.parse(response.text!);
}
