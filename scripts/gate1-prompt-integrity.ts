import path from "path";
import { config } from "dotenv";
config({ path: path.join(process.cwd(), ".env.local") });

import { buildSystemPrompt } from "../lib/content/prompt/compiler";
import { getPersona } from "../lib/content/personas/registry";

// ─── Gate 1: Print the EXACT system prompt sent to Gemini ─────────────────
// for Developer and Psychology on the same topic (T-P05: Professional Relationships)
// to verify <perspective_constraint> and <causal_model> are fully present.

const TOPIC = "اكتب عن بناء العلاقات المهنية في بيئة العمل وكيف تبني الثقة مع زملائك ومديرك.";
const personas = ["developer", "psychology"] as const;

for (const personaId of personas) {
  const persona = getPersona(personaId);
  if (!persona) throw new Error(`Persona ${personaId} not found`);

  const input: any = {
    rawInput: TOPIC,
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

  const prompt = buildSystemPrompt(input);
  const separator = "─".repeat(80);

  console.log(`\n${separator}`);
  console.log(`PERSONA: ${personaId.toUpperCase()} — SYSTEM PROMPT (${prompt.length} chars)`);
  console.log(separator);
  console.log(prompt);
  console.log(`\n${separator}\n`);
}

