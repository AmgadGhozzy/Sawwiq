import fs from "fs";
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
    id: "Developer (T-P05)",
    persona: "developer",
    topic: "العلاقات المهنية وبناء الثقة في بيئة العمل"
  },
  {
    id: "Psychology (T-P01)",
    persona: "psychology",
    topic: "التسعير للمنتجات الجديدة والموازنة بين الربح ورضا العميل"
  },
  {
    id: "Intellectual (T-P03)",
    persona: "intellectual",
    topic: "تقبل الفشل كجزء من عملية التعلم"
  },
  {
    id: "Creative (T-P04)",
    persona: "creative",
    topic: "اتخاذ القرار تحت الضغط"
  }
];

async function runGate4() {
  console.log("🔬 Gate 4: V2 Manual Generation Test\n");
  const results = [];

  for (const c of CASES) {
    console.log(`Generating ${c.id}...`);
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

    const parsed = JSON.parse(response.text!);
    results.push({
      id: c.id,
      title: parsed.title,
      hook: parsed.hook,
      body: parsed.body,
      cta: parsed.callToAction
    });
  }

  const outPath = path.join(process.cwd(), "scripts", "gate4-v2-output.json");
  fs.writeFileSync(outPath, JSON.stringify(results, null, 2), "utf-8");
  console.log(`\n✅ Done. Saved to ${outPath}`);
}

runGate4().catch(console.error);
