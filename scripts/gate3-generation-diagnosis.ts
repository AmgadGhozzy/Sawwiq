import path from "path";
import { config } from "dotenv";
config({ path: path.join(process.cwd(), ".env.local") });

import { buildSystemPrompt, buildUserPrompt } from "../lib/content/prompt/compiler";
import { getPersona } from "../lib/content/personas/registry";
import { GoogleGenAI } from "@google/genai";
import { GEMINI_RESPONSE_SCHEMA } from "../supabase/functions/generate/validation/schema";

const ai = new GoogleGenAI({
  vertexai: true,
  apiKey: process.env.VERTEX_AI_API_KEY,
});

const CASES = [
  {
    id: "Developer + T-P05",
    persona: "developer",
    topic: "اكتب عن بناء العلاقات المهنية في بيئة العمل وكيف تبني الثقة مع زملائك ومديرك."
  },
  {
    id: "Psychology + T-P01",
    persona: "psychology",
    topic: "كيفية تسعير المنتجات الجديدة والموازنة بين الربح ورضا العميل."
  }
];

async function runGate3() {
  console.log("🔬 Gate 3: Generation Diagnosis\n");
  const results = [];

  for (const c of CASES) {
    const persona = getPersona(c.persona as any);
    if (!persona) throw new Error(`Persona not found: ${c.persona}`);

    const input: any = {
      rawInput: c.topic,
      platform: "linkedin",
      contentType: "social_post",
      mode: "creator",
      arabicStyle: "white_arabic",
      metadata: {
        persona: { ...persona, usePerspectiveConstraint: true },
        style: "storytelling",
        intent: "education",
        originality: "creative",
      },
    };

    const systemInstruction = buildSystemPrompt(input);
    const userPrompt = buildUserPrompt();

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash", // Using the standard generation model
      contents: userPrompt,
      config: {
        systemInstruction,
        responseMimeType: "application/json",
        responseSchema: GEMINI_RESPONSE_SCHEMA,
        temperature: 0.7,
      },
    });

    results.push({
      id: c.id,
      title: parsed.title,
      hook: parsed.hook,
      body: parsed.body,
      cta: parsed.callToAction
    });
  }
  fs.writeFileSync("gate3-output.json", JSON.stringify(results, null, 2), "utf-8");
  console.log("Saved to gate3-output.json");
}

runGate3().catch(console.error);
