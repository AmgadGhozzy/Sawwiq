import { GoogleGenAI, Type } from "@google/genai";



export const GENERICNESS_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    score: { type: Type.INTEGER, description: "0 to 100. 100 means extremely generic, 0 means completely unique and specific." },
    detectedPatterns: { type: Type.ARRAY, items: { type: Type.STRING } },
    openingSpecificity: { type: Type.INTEGER, description: "0 to 100. 100 means the opening applies only to this specific topic." },
  },
  required: ["score", "detectedPatterns", "openingSpecificity"],
};

export async function evaluateGenericness(text: string) {
  const ai = new GoogleGenAI({
    vertexai: true,
    apiKey: process.env.VERTEX_AI_API_KEY,
  });
  const systemPrompt = `
You are an expert Copywriter judge. Rate the "Genericness" of the given Arabic text.
Genericness means the text could apply to almost any topic if you swapped a few nouns.

Assess:
1. Opening Specificity: Is the hook generic? ("في عصرنا المتسارع", "لا شك أن", "كلنا نواجه")
2. Are there vague statements? ("هذا سيفيدك كثيراً", "يعتبر من أهم الأشياء")

Return a Genericness Score (0-100) where 100 = very generic AI writing, and 0 = highly specific, concrete, native human writing.
  `.trim();

  const userPrompt = `
<text>
${text}
</text>
  `.trim();

  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash-lite",
    contents: userPrompt,
    config: {
      systemInstruction: systemPrompt,
      responseMimeType: "application/json",
      responseSchema: GENERICNESS_SCHEMA,
      temperature: 0.1,
    },
  });

  return JSON.parse(response.text!);
}
