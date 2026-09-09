import { GoogleGenAI } from "@google/genai";

export function createVertexAIClient(apiKeyOverride?: string) {
  // If we are in an environment where GCP_SERVICE_ACCOUNT_KEY exists (e.g. Supabase Edge),
  // we explicitly parse it and pass it to googleAuthOptions.
  // Otherwise, the SDK relies on GOOGLE_APPLICATION_CREDENTIALS natively for Node.js.
  
  const config: any = {
    vertexai: true,
    project: 'gen-lang-client-0841388254',
    location: 'us-central1'
  };

  if (process.env.GCP_SERVICE_ACCOUNT_KEY) {
    try {
      config.googleAuthOptions = {
        credentials: JSON.parse(process.env.GCP_SERVICE_ACCOUNT_KEY)
      };
    } catch (err) {
      console.warn("Failed to parse GCP_SERVICE_ACCOUNT_KEY", err);
    }
  } else if (apiKeyOverride || process.env.VERTEX_AI_API_KEY) {
    // Fallback for Gemini Express Mode if keys are manually provided and no SA is available
    config.vertexai = false;
    config.apiKey = apiKeyOverride || process.env.VERTEX_AI_API_KEY;
  }

  return new GoogleGenAI(config);
}
