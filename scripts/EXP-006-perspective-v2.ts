import fs from "fs";
import path from "path";
import { config } from "dotenv";
config({ path: path.join(process.cwd(), ".env.local") });

import { evaluatePersona } from "../lib/evaluation/personaEvaluator";
import { evaluateReasoningSeparation } from "../lib/evaluation/reasoningSeparationEvaluator";
import { evaluateAblationWeighted } from "../lib/evaluation/ablationEvaluator";
import { evaluateGenericness } from "../lib/evaluation/genericnessEvaluator";
import { evaluateContractNodeCoverage } from "../lib/evaluation/contractNodeEvaluator";
import { buildSystemPrompt, buildUserPrompt } from "../lib/content/prompt/compiler";
import { GEMINI_RESPONSE_SCHEMA } from "../supabase/functions/generate/validation/schema";
import { getPersona } from "../lib/content/personas/registry";
import { GoogleGenAI } from "@google/genai";
import type { InputDTO } from "../types/content";

const ai = new GoogleGenAI({
  vertexai: true,
  apiKey: process.env.VERTEX_AI_API_KEY,
});

async function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function extractFullText(jsonString: string): string {
  try {
    const parsed = JSON.parse(jsonString);
    return `${parsed.title}\n\n${parsed.hook}\n\n${parsed.body}\n\n${parsed.callToAction}`;
  } catch {
    return jsonString; // fallback
  }
}

async function generateContent(input: InputDTO): Promise<string> {
  const systemInstruction = buildSystemPrompt(input as any);
  const userPrompt = buildUserPrompt();

  const personaCfg = (input as any).metadata?.persona;
  if (personaCfg) {
    const expectedMarker =
      personaCfg.perspectiveVersion === "v1"
        ? "<perspective_constraint>"
        : "<reasoning_contract>";
    if (!systemInstruction.includes(expectedMarker)) {
      throw new Error(
        `INSTRUMENTATION FAILURE: expected ${expectedMarker} in the prompt but it is missing — aborting the entire experiment.`
      );
    }
  }

  let retries = 10;
  while (retries > 0) {
    try {
      const response = await ai.models.generateContent({
        model: "gemini-3.1-flash-lite", // or whatever model we want for generation
        contents: userPrompt,
        config: {
          systemInstruction,
          responseMimeType: "application/json",
          responseSchema: GEMINI_RESPONSE_SCHEMA,
          temperature: 0.7,
        },
      });
      return response.text!;
    } catch (e: any) {
      if (e?.status === 429 && retries > 1) {
        console.log(`     [Rate Limit in Generation] 429 hit. Waiting 20 seconds before retry (${retries} left)...`);
        await delay(20000);
        retries--;
      } else {
        throw e;
      }
    }
  }
  throw new Error("Max retries exceeded in generation");
}

async function runExp006() {
  const datasetPath = path.join(__dirname, "datasets", "dataset-exp-006.json");
  const dataset = JSON.parse(fs.readFileSync(datasetPath, "utf-8"));

  const isSample = process.env.EXP_006_SAMPLE === "true";
  const targetCases = isSample ? 4 : 24;
  console.log(`🚀 Starting EXP-006 Benchmark (Target cases: ${targetCases})`);

  let matrix: any[] = [];
  for (const topic of dataset.topics) {
    for (const persona of dataset.personas) {
      for (const style of ["linkedin"]) {
        matrix.push({ topic, persona, platform: "linkedin", style });
      }
    }
  }

  if (isSample) {
    matrix = matrix.slice(0, 4);
  }

  const results: any[] = [];

  for (let i = 0; i < matrix.length; i++) {
    const { topic, platform, style, persona } = matrix[i];
    const caseId = `C${(i + 1).toString().padStart(3, "0")}-${persona}-${topic.id}`;
    console.log(`\n[${i + 1}/${matrix.length}] Running ${caseId}...`);

    const basePersona = getPersona(persona);
    if (!basePersona) throw new Error(`Persona ${persona} not found`);

    // Variant A: Perspective V1
    console.log(`   Generating Variant A (Perspective V1)...`);
    const inputA: any = {
      rawInput: topic.prompt,
      platform,
      contentType: "social_post",
      mode: "creator",
      arabicStyle: "white_arabic",
      metadata: {
        persona: { ...basePersona, usePerspectiveConstraint: true, perspectiveVersion: "v1" },
        style: "storytelling",
        intent: "education",
        originality: "creative",
      },
    };
    const rawA = await generateContent(inputA);
    const textA = extractFullText(rawA);

    await delay(2000);

    // Variant B: Perspective V2
    console.log(`   Generating Variant B (Perspective V2)...`);
    const inputB: any = {
      ...inputA,
      metadata: {
        ...inputA.metadata,
        persona: { ...basePersona, usePerspectiveConstraint: true, perspectiveVersion: "v2" },
      },
    };
    const rawB = await generateContent(inputB);
    const textB = extractFullText(rawB);

    await delay(2000);

    const retryEval = async <T>(fn: () => Promise<T>): Promise<T> => {
      let retries = 10;
      while (retries > 0) {
        try { return await fn(); }
        catch (e: any) {
          if (e?.status === 429 && retries > 1) {
            console.log(`     [Rate Limit] 429 hit. Waiting 20 seconds before retry (${retries} left)...`);
            await delay(20000);
            retries--;
          } else throw e;
        }
      }
      throw new Error("Max retries exceeded");
    };

    console.log(`   Evaluating Evaluator v2 on texts...`);
    // NOTE: Keep evaluator at V2 for both texts. User instruction: "استخدم V2 كما هو."
    const eval_A = await retryEval(() => evaluatePersona(textA, "v2")); await delay(2000);
    const eval_B = await retryEval(() => evaluatePersona(textB, "v2")); await delay(2000);

    console.log(`   Evaluating Reasoning Separation...`);
    const sep_A = await retryEval(() => evaluateReasoningSeparation(textA, textB, basePersona.id as any)); await delay(2000);

    console.log(`   Evaluating Ablation (V2 Text)...`);
    const ablation = await retryEval(() => evaluateAblationWeighted(textB, basePersona.id as any)); await delay(2000);

    console.log(`   Evaluating Genericness (V2 Text)...`);
    const genericness = await retryEval(() => evaluateGenericness(textB)); await delay(2000);

    console.log(`   Evaluating Node Coverage (V2 Text)...`);
    const coverage = await retryEval(() => evaluateContractNodeCoverage(textB, basePersona.id as any)); await delay(2000);

    results.push({
      caseId,
      topic: topic.id,
      persona,
      rawA,
      rawB,
      evalA_accuracy: eval_A.is_match ? 1 : 0,
      evalB_accuracy: eval_B.is_match ? 1 : 0,
      reasoning_separation: sep_A.structural_separation_score,
      causal_separation: ablation.causal_score,
      worldview_separation: ablation.worldview_score,
      vocab_swap: ablation.vocabulary_score,
      ablation_delta: ablation.total_score,
      node_coverage: (coverage.nodes_found / 5) * 100,
      coverage_details: coverage.details
    });

    console.log(`   -> V1 Accuracy: ${eval_A.is_match}, V2 Accuracy: ${eval_B.is_match}`);
    console.log(`   -> Separation: ${sep_A.structural_separation_score}, Node Coverage: ${(coverage.nodes_found / 5) * 100}%`);
    console.log(`   -> Ablation Delta: ${ablation.total_score} (Causal: ${ablation.causal_score})`);
  }

  // Generate Report
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const reportPath = path.join(__dirname, "benchmark-reports", `exp-006-${timestamp}.json`);

  const numCases = results.length;
  const v1Acc = results.reduce((sum, r) => sum + r.evalA_accuracy, 0) / numCases;
  const v2Acc = results.reduce((sum, r) => sum + r.evalB_accuracy, 0) / numCases;
  const avgReasoningSep = results.reduce((sum, r) => sum + r.reasoning_separation, 0) / numCases;
  const avgCausalSep = results.reduce((sum, r) => sum + r.causal_separation, 0) / numCases;
  const avgWorldviewSep = results.reduce((sum, r) => sum + r.worldview_separation, 0) / numCases;
  const avgVocabSwap = results.reduce((sum, r) => sum + r.vocab_swap, 0) / numCases;
  const avgAblationDelta = results.reduce((sum, r) => sum + r.ablation_delta, 0) / numCases;
  const avgNodeCoverage = results.reduce((sum, r) => sum + r.node_coverage, 0) / numCases;

  const report = {
    metadata: {
      name: "EXP-006",
      timestamp,
      cases: numCases
    },
    summary: {
      "Persona Accuracy (V1)": v1Acc * 100,
      "Persona Accuracy (V2)": v2Acc * 100,
      "Reasoning Separation": avgReasoningSep,
      "Causal Separation": avgCausalSep,
      "Worldview Separation": avgWorldviewSep,
      "Vocabulary-only Swap": avgVocabSwap,
      "Ablation Delta": avgAblationDelta,
      "Contract Node Coverage": avgNodeCoverage,
    },
    cases: results
  };

  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2), "utf-8");
  console.log(`\n✅ EXP-006 Complete. Report saved to: ${reportPath}`);
  console.log(JSON.stringify(report.summary, null, 2));
}

runExp006().catch(console.error);
