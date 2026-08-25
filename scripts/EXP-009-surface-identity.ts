import * as fs from "fs";
import * as path from "path";
import { config } from "dotenv";
config({ path: path.join(process.cwd(), ".env.local") });

import { GoogleGenAI, Type } from "@google/genai";
import { evaluatePersona } from "../lib/evaluation/personaEvaluator";
import { evaluateAblationWeighted } from "../lib/evaluation/ablationEvaluator";

const ai = new GoogleGenAI({
  vertexai: true,
  apiKey: process.env.VERTEX_AI_API_KEY,
});

async function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ─── IR Schemas ─────────────────────────────────────────────────────────────
const SCHEMAS: Record<string, any> = {
  developer: {
    type: Type.OBJECT,
    properties: {
      system_definition: { type: Type.STRING },
      inputs_and_outputs: { type: Type.STRING },
      constraint_or_bottleneck: { type: Type.STRING },
      causal_mechanism: { type: Type.STRING },
      structural_intervention: { type: Type.STRING },
      observable_outcome: { type: Type.STRING }
    },
    required: ["system_definition", "inputs_and_outputs", "constraint_or_bottleneck", "causal_mechanism", "structural_intervention", "observable_outcome"]
  },
  psychology: {
    type: Type.OBJECT,
    properties: {
      external_trigger: { type: Type.STRING },
      internal_motive: { type: Type.STRING },
      observable_behavior: { type: Type.STRING },
      internal_reinforcement: { type: Type.STRING },
      awareness_shift: { type: Type.STRING }
    },
    required: ["external_trigger", "internal_motive", "observable_behavior", "internal_reinforcement", "awareness_shift"]
  },
  intellectual: {
    type: Type.OBJECT,
    properties: {
      common_assumption: { type: Type.STRING },
      hidden_flaw: { type: Type.STRING },
      causal_challenge: { type: Type.STRING },
      alternative_framing: { type: Type.STRING },
      reframed_synthesis: { type: Type.STRING }
    },
    required: ["common_assumption", "hidden_flaw", "causal_challenge", "alternative_framing", "reframed_synthesis"]
  },
  creative: {
    type: Type.OBJECT,
    properties: {
      sensory_scene: { type: Type.STRING },
      unexpected_association: { type: Type.STRING },
      tension: { type: Type.STRING },
      transformed_meaning: { type: Type.STRING },
      lingering_echo: { type: Type.STRING }
    },
    required: ["sensory_scene", "unexpected_association", "tension", "transformed_meaning", "lingering_echo"]
  }
};

const FINAL_CONTENT_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    title: { type: Type.STRING },
    hook: { type: Type.STRING },
    body: { type: Type.STRING },
    closing: { type: Type.STRING },
    hashtags: { type: Type.ARRAY, items: { type: Type.STRING } }
  },
  required: ["title", "hook", "body", "closing", "hashtags"]
};

// ─── IR VALIDATION ──────────────────────────────────────────────────────────
const IR_VALIDITY_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    is_valid: { type: Type.BOOLEAN },
    reason: { type: Type.STRING }
  },
  required: ["is_valid", "reason"]
};

async function validateIR(irJson: any, personaId: string): Promise<boolean> {
  const prompt = `
You are a Strict IR Validator. Target Persona: ${personaId.toUpperCase()}
Does this graph genuinely embody the ${personaId} cognitive model?
If creative: Does it start with an emotion? (Invalid). Does it use a psychological mechanism? (Invalid).
If intellectual: Does it propose a practical fix instead of changing the premise? (Invalid).
If developer: Is the core cause a human motive/emotion instead of a structural system bottleneck? (Invalid).
If psychology: Is it purely mechanical without emotional drivers? (Invalid). Does it offer a checklist/rule instead of a self-awareness shift? (Invalid).

Graph:
${JSON.stringify(irJson, null, 2)}
`;
  const response = await ai.models.generateContent({
    model: "gemini-3.1-flash-lite",
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: IR_VALIDITY_SCHEMA as any,
      temperature: 0.1
    }
  });
  return JSON.parse(response.text!).is_valid;
}

// ─── FIDELITY EVALUATION ────────────────────────────────────────────────────
const IR_FIDELITY_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    nodes_preserved: { type: Type.NUMBER },
    causal_edges_preserved: { type: Type.NUMBER },
    structural_fidelity: { type: Type.NUMBER },
    invented_mechanisms: { type: Type.NUMBER },
    details: { type: Type.STRING }
  },
  required: ["nodes_preserved", "causal_edges_preserved", "structural_fidelity", "invented_mechanisms", "details"]
};

async function evaluateIRSurfaceFidelity(irData: any, finalString: string) {
  const prompt = `
You are a Structural Fidelity Evaluator.
Compare generated Text against original Causal Graph (IR).

Causal Graph (IR):
${JSON.stringify(irData, null, 2)}

Generated Text:
${finalString}

Evaluate:
1. Were core nodes preserved?
2. Were causal edges preserved?
3. Did the text invent completely new causal mechanisms or rationales missing from IR?
Score from 0.0 to 1.0.
`;
  const response = await ai.models.generateContent({
    model: "gemini-3.1-flash-lite",
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: IR_FIDELITY_SCHEMA as any,
      temperature: 0.1
    }
  });
  return JSON.parse(response.text!);
}

// ─── PIPELINE HELPERS ───────────────────────────────────────────────────────
const retryEval = async <T>(fn: () => Promise<T>): Promise<T> => {
  let retries = 10;
  while (retries > 0) {
    try { return await fn(); }
    catch (e: any) {
      if (e?.status === 429 && retries > 1) {
        console.log(`     [Rate Limit] 429 hit. Waiting 20s...`);
        await delay(20000);
        retries--;
      } else throw e;
    }
  }
  throw new Error("Max retries exceeded");
};

// ─── GENERATORS ─────────────────────────────────────────────────────────────

// 1. Planner
async function generateValidIR(topic: string, personaId: string) {
  let antiIsomorphismRules = "";
  if (personaId === "creative") {
    antiIsomorphismRules = "CRITICAL: DO NOT use psychological terms, motives, or emotions. MUST start with a concrete physical sensory scene.";
  } else if (personaId === "intellectual") {
    antiIsomorphismRules = "CRITICAL: DO NOT propose a practical fix or operational checklist. MUST reframe the question/premise fundamentally.";
  } else if (personaId === "developer") {
    antiIsomorphismRules = "CRITICAL: DO NOT use human motives, emotions, or psychological defense mechanisms. Treat the topic STRICTLY as a structural system bottleneck (e.g. lack of transparent metrics, information asymmetry).";
  } else if (personaId === "psychology") {
    antiIsomorphismRules = "CRITICAL: DO NOT describe purely mechanical systems. MUST focus on human behavioral mechanisms and end with a self-awareness shift.";
  }

  const plannerSystemPrompt = `
You are an elite Causal Graph Planner for a Content Strategy pipeline.
Your task is to break down the topic into a structured Intermediate Representation (IR) JSON based strictly on the target cognitive model.
Target Cognitive Model: ${personaId.toUpperCase()}
Target Topic: ${topic}
RULES:
- Must contain actual domain-specific cognitive decisions for this specific topic.
- If the topic is emotional (e.g. Imposter Syndrome) and you are 'developer', treat it mechanically as a system constraint.
- If you are 'creative', start with a physical observation, not an internal emotion.
${antiIsomorphismRules}
`;

  let attempts = 0;
  let irData: any = null;
  while (attempts < 10) {
    attempts++;
    const irResponse = await retryEval(() => ai.models.generateContent({
      model: "gemini-3.1-flash-lite",
      contents: plannerSystemPrompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: SCHEMAS[personaId] as any,
        temperature: 0.3 + (attempts * 0.1)
      }
    }));
    irData = JSON.parse(irResponse.text!);
    const isValid = await retryEval(() => validateIR(irData, personaId));
    if (isValid) return irData;
    console.log(`     [IR Planner] Attempt ${attempts} failed validation. Retrying...`);
    await delay(2000);
  }
  console.log(`     [WARNING] Failed to generate completely valid IR after 10 attempts for ${personaId} on ${topic}. Proceeding with the last generated IR.`);
  return irData;
}

// 2. Surface Generators (A, B, C)
async function generateSurface(irData: any, personaId: string, variant: "A" | "B" | "C") {
  let instructions = `
You are an Arabic Content Generator.
Write a high-quality social media post (LinkedIn style) based EXACTLY on the provided Causal Graph.
CRITICAL RULES:
1. You MUST follow the causal sequence provided in the JSON graph.
2. DO NOT invent your own causal structures, motives, or assumptions. 
3. Language: Arabic, style: 'white_arabic' (الفصحى البيضاء).
4. The 'closing' of the post MUST strictly match the final conclusion/synthesis node of the IR.
`;

  if (variant === "B" || variant === "C") {
    instructions += `\n5. REALIZATION CONTROLLER: You are realizing this graph for the ${personaId.toUpperCase()} persona. Use terminology, tone, and framing suitable for ${personaId}. However, the IR is the AUTHORITATIVE source of the argument. You are NOT allowed to change the argument's structure or add new causal steps to sound more like the persona. Translate the existing IR nodes through the lens of ${personaId}.`;
  }

  if (variant === "C") {
    if (personaId === "creative") instructions += `\n6. ANTI-ISOMORPHISM: Absolutely DO NOT use psychological terms (e.g., 'شعور', 'عقل باطن', 'دوافع') or self-help framing. Rely purely on sensory metaphor and narrative.`;
    if (personaId === "intellectual") instructions += `\n6. ANTI-ISOMORPHISM: Absolutely DO NOT end with an operational tip or actionable advice. Keep the tone philosophical and analytical.`;
    if (personaId === "developer") instructions += `\n6. ANTI-ISOMORPHISM: Absolutely DO NOT use emotional or psychological framing. Describe it as a structural mechanism.`;
    if (personaId === "psychology") instructions += `\n6. ANTI-ISOMORPHISM: Focus purely on human behavioral mechanisms and self-awareness, avoiding generic mechanical steps.`;
  }

  const contentResponse = await retryEval(() => ai.models.generateContent({
    model: "gemini-3.1-flash-lite",
    contents: `CAUSAL GRAPH (JSON):\n${JSON.stringify(irData, null, 2)}`,
    config: {
      systemInstruction: instructions,
      responseMimeType: "application/json",
      responseSchema: FINAL_CONTENT_SCHEMA as any,
      temperature: 0.7
    }
  }));

  const data = JSON.parse(contentResponse.text!);
  return `${data.title}\n\n${data.hook}\n\n${data.body}\n\n${data.closing}`;
}

// ─── RUN EXPERIMENT ─────────────────────────────────────────────────────────

async function runExp009() {
  const datasetPath = path.join(__dirname, "datasets", "dataset-exp-007.json");
  const dataset = JSON.parse(fs.readFileSync(datasetPath, "utf-8"));

  console.log(`🚀 Starting EXP-009: Surface Identity Preservation (A/B/C)`);

  const results: any = { cases: [], summary: {} };

  for (const topic of dataset.topics) {
    console.log(`\n📌 Topic: ${topic.name}`);

    for (const personaId of dataset.personas) {
      console.log(`   Generate -> ${personaId}...`);

      // 1. Generate one authoritative IR
      const irData = await generateValidIR(topic.prompt, personaId);
      await delay(2000);

      // 2. Generate 3 variants
      const variants: ("A" | "B" | "C")[] = ["A", "B", "C"];

      for (const variant of variants) {
        console.log(`     Evaluating Variant ${variant}...`);
        const text = await generateSurface(irData, personaId, variant);
        await delay(2000);

        const fidelity = await retryEval(() => evaluateIRSurfaceFidelity(irData, text));
        await delay(2000);

        const evalPersona = await retryEval(() => evaluatePersona(text, "v2"));
        await delay(2000);

        const ablation = await retryEval(() => evaluateAblationWeighted(text, personaId as any));
        await delay(2000);

        const personaMapping: Record<string, string> = { "A": "developer", "B": "psychology", "C": "intellectual", "D": "creative" };
        const predictedString = personaMapping[evalPersona.predicted_persona] || evalPersona.predicted_persona;

        results.cases.push({
          topic: topic.id,
          persona: personaId,
          variant,
          ir_json: irData,
          raw_text: text,
          fidelity_score: fidelity.structural_fidelity,
          predicted_persona: predictedString,
          is_match: predictedString.toLowerCase() === personaId.toLowerCase(),
          ablation_delta: ablation.weightedScore
        });
      }
    }
  }

  // Aggregate
  for (const variant of ["A", "B", "C"]) {
    const vCases = results.cases.filter((c: any) => c.variant === variant);
    const accuracy = (vCases.filter((c: any) => c.is_match).length / vCases.length) * 100;
    const avgFidelity = vCases.reduce((sum: number, c: any) => sum + c.fidelity_score, 0) / vCases.length;
    const avgAblation = vCases.reduce((sum: number, c: any) => sum + c.ablation_delta, 0) / vCases.length;

    results.summary[variant] = {
      "Accuracy (%)": accuracy.toFixed(2),
      "Fidelity Score": avgFidelity.toFixed(2),
      "Ablation Delta": avgAblation.toFixed(2)
    };
  }

  const reportPath = path.join(__dirname, "benchmark-reports", `exp-009-identity-${Date.now()}.json`);
  fs.writeFileSync(reportPath, JSON.stringify(results, null, 2));

  console.log(`\n✅ EXP-009 Complete. Report saved to: ${reportPath}`);
  console.log(JSON.stringify(results.summary, null, 2));
}

runExp009().catch(console.error);
