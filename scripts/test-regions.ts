import { GoogleGenAI } from "@google/genai";
import { config } from "dotenv";
config({ path: ".env.local" });

async function run() {
  const regions = ["us-central1", "europe-west1", "europe-west4", "us-east4", undefined];

  for (const region of regions) {
    console.log(`Testing region: ${region || 'default'}`);
    try {
      const client = new GoogleGenAI({
        vertexai: true,
        apiKey: process.env.VERTEX_AI_API_KEY,
        ...(region ? { location: region } : {}),
      });
      const res = await client.models.generateContent({
        model: "gemini-2.5-flash-lite",
        contents: "Hello",
      });
      console.log(`Success in ${region || 'default'}!`);
    } catch (e: any) {
      console.log(`Failed in ${region || 'default'}:`, e.status || e.message);
    }
  }
}
run();
