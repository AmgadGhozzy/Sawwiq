import { GoogleGenAI } from "@google/genai";

export function createVertexAIClient(apiKeyOverride?: string) {
  const apiKey = apiKeyOverride || process.env.VERTEX_AI_API_KEY;
  
  if (!apiKey) {
    throw new Error("VERTEX_AI_API_KEY is not configured");
  }

  return new GoogleGenAI({
    vertexai: true,
    apiKey,
  });
}
