import fs from "fs";
import path from "path";
import { config } from "dotenv";
import { GoogleGenAI } from "@google/genai";

config({ path: path.join(process.cwd(), ".env.local") });

import { evaluatePersona } from "../lib/evaluation/personaEvaluator";
import { evaluateReasoningSeparation } from "../lib/evaluation/reasoningSeparationEvaluator";
import { evaluateAblationWeighted } from "../lib/evaluation/ablationEvaluator";
import { evaluateGenericness } from "../lib/evaluation/genericnessEvaluator";
import { buildSystemPrompt, buildUserPrompt } from "../lib/content/prompt/compiler";
import { GEMINI_RESPONSE_SCHEMA } from "../supabase/functions/generate/validation/schema";
import { getPersona } from "../lib/content/personas/registry";
import type { InputDTO } from "../supabase/functions/generate/validation/schema";
import { PersonaId, PERSONA_LETTER_MAP } from "../lib/evaluation/types";

const ai = new GoogleGenAI({
  vertexai: true,
  apiKey: process.env.VERTEX_AI_API_KEY,
});

const delay = (ms: number) => new Promise(res => setTimeout(res, ms));

async function generateContent(input: InputDTO): Promise<string> {
  const systemInstruction = buildSystemPrompt(input);
  const userPrompt = buildUserPrompt();
  const responseSchema = GEMINI_RESPONSE_SCHEMA;

  let retries = 3;
  while (retries > 0) {
    try {
      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash-lite", // or pro? The user uses flash-lite for eval, but generation is often flash or pro.
        contents: userPrompt,
        config: {
          systemInstruction,
          responseMimeType: "application/json",
          responseSchema,
          temperature: 0.7,
        },
      });
      return response.text!;
    } catch (e: any) {
      if (e?.status === 429 && retries > 1) {
        await delay(10000);
        retries--;
      } else {
        throw e;
      }
    }
  }
  return "";
}

function extractFullText(rawJson: string): string {
  try {
    const parsed = JSON.parse(rawJson);
    return [
      parsed.title,
      parsed.hook,
      typeof parsed.body === "string" ? parsed.body : parsed.body?.map((p: any) => p.text).join("\n\n"),
      parsed.callToAction,
      parsed.hashtags?.join(" ")
    ].filter(Boolean).join("\n\n");
  } catch {
    return rawJson;
  }
}

async function runExp005() {
  const datasetPath = path.join(__dirname, "datasets", "dataset-exp-005.json");
  const dataset = JSON.parse(fs.readFileSync(datasetPath, "utf-8"));

  const isSample = process.env.EXP_005_SAMPLE === "true";
  console.log(`🚀 Starting EXP-005 Benchmark (Sample mode: ${isSample})`);

  let matrix: any[] = [];
  for (const topic of dataset.topics) {
    for (const platform of dataset.platforms) {
      for (const style of dataset.styles) {
        for (const persona of dataset.personas) {
          matrix.push({ topic, platform, style, persona });
        }
      }
    }
  }

  if (isSample) {
    matrix = matrix.slice(0, 5); // Just 5 cases for manual inspection
  }

  const results: any[] = [];

  for (let i = 0; i < matrix.length; i++) {
    const { topic, platform, style, persona } = matrix[i];
    const caseId = `C${(i + 1).toString().padStart(3, "0")}-${persona}-${topic.id}`;
    console.log(`\n[${i + 1}/${matrix.length}] Running ${caseId}...`);

    const baseInput: any = {
      rawInput: topic.prompt,
      platform,
      contentType: "social_post",
      mode: "creator",
      arabicStyle: "white_arabic",
      metadata: { style, intent: "education", originality: "creative" }
    };

    const basePersona = getPersona(persona);
    if (!basePersona) throw new Error(`Persona ${persona} not found`);

    // Variant A: Baseline (No perspective constraint)
    console.log(`   Generating Variant A (Baseline)...`);
    const inputA = { ...baseInput, metadata: { ...baseInput.metadata, persona: { ...basePersona, usePerspectiveConstraint: false } } };
    const rawA = await generateContent(inputA as any);
    const textA = extractFullText(rawA);

    await delay(2000);

    // Variant B: Perspective Constraint
    console.log(`   Generating Variant B (Perspective)...`);
    const inputB = { ...baseInput, metadata: { ...baseInput.metadata, persona: { ...basePersona, usePerspectiveConstraint: true } } };
    const rawB = await generateContent(inputB as any);
    const textB = extractFullText(rawB);

    await delay(2000);

    const retryEval = async <T>(fn: () => Promise<T>): Promise<T> => {
      let retries = 3;
      while (retries > 0) {
        try { return await fn(); }
        catch (e: any) {
          if (e?.status === 429 && retries > 1) {
            await delay(10000);
            retries--;
          } else throw e;
        }
      }
      throw new Error("Max retries exceeded");
    };

    // 2x2 Evaluation Matrix
    console.log(`   Evaluating Persona Accuracy (2x2 Matrix)...`);
    const eval_A_v1 = await retryEval(() => evaluatePersona(textA, "v1")); await delay(2000);
    const eval_A_v2 = await retryEval(() => evaluatePersona(textA, "v2")); await delay(2000);
    const eval_B_v1 = await retryEval(() => evaluatePersona(textB, "v1")); await delay(2000);
    const eval_B_v2 = await retryEval(() => evaluatePersona(textB, "v2")); await delay(2000);

    const expectedLetter = PERSONA_LETTER_MAP[persona as PersonaId];

    // Ablation (Weighted) on Variant B
    console.log(`   Evaluating Weighted Ablation (Variant B)...`);
    const ablationResult = await retryEval(() => evaluateAblationWeighted(textB, persona as PersonaId));
    await delay(2000);

    // Genericness on Variant B
    const genericness = await retryEval(() => evaluateGenericness(textB));
    await delay(2000);

    results.push({
      caseId,
      persona,
      topic: topic.id,
      textA,
      textB,
      evaluations: {
        A_v1: { ...eval_A_v1, is_correct: eval_A_v1.predicted_persona === expectedLetter },
        A_v2: { ...eval_A_v2, is_correct: eval_A_v2.predicted_persona === expectedLetter },
        B_v1: { ...eval_B_v1, is_correct: eval_B_v1.predicted_persona === expectedLetter },
        B_v2: { ...eval_B_v2, is_correct: eval_B_v2.predicted_persona === expectedLetter }
      },
      ablation: ablationResult,
      genericness
    });
  }

  if (isSample) {
    const reportPath = path.join(__dirname, "benchmark-reports", `exp-005-sample-${Date.now()}.json`);
    fs.writeFileSync(reportPath, JSON.stringify(results, null, 2));
    console.log(`\n✅ Sample run complete. Results saved to ${reportPath}`);
    return;
  }

  // Pairwise Reasoning Separation on Variant B texts (same topic, different personas)
  console.log(`\nRunning Pairwise Comparisons on Variant B...`);
  const pairwiseResults: any[] = [];

  // Group by topic
  const topicsMap: Record<string, any[]> = {};
  for (const r of results) {
    if (!topicsMap[r.topic]) topicsMap[r.topic] = [];
    topicsMap[r.topic].push(r);
  }

  for (const topicId in topicsMap) {
    const group = topicsMap[topicId];
    for (let i = 0; i < group.length; i++) {
      for (let j = i + 1; j < group.length; j++) {
        const case1 = group[i];
        const case2 = group[j];

        console.log(`   Pairwise: ${case1.persona} vs ${case2.persona} on ${topicId}`);
        const retryEval = async <T>(fn: () => Promise<T>): Promise<T> => {
          let retries = 3;
          while (retries > 0) {
            try { return await fn(); }
            catch (e: any) {
              if (e?.status === 429 && retries > 1) {
                await delay(10000);
                retries--;
              } else throw e;
            }
          }
          throw new Error("Max retries exceeded");
        };

        const separation = await retryEval(() => evaluateReasoningSeparation(
          case1.textB, case1.persona as PersonaId,
          case2.textB, case2.persona as PersonaId
        ));
        pairwiseResults.push({
          topic: topicId,
          pair: [case1.persona, case2.persona],
          ...separation
        });
        await delay(3000);
      }
    }
  }

  // Compile Summary
  let B_v2_correct = 0;
  let A_v2_correct = 0;
  let B_v1_correct = 0;
  let A_v1_correct = 0;

  const personaAccuracy: Record<string, { total: number, correct: number }> = {};
  dataset.personas.forEach((p: string) => personaAccuracy[p] = { total: 0, correct: 0 });

  let totalAblationScore = 0;
  let vocabOnlySwaps = 0;

  for (const r of results) {
    if (r.evaluations.B_v2.is_correct) {
      B_v2_correct++;
      personaAccuracy[r.persona].correct++;
    }
    if (r.evaluations.A_v2.is_correct) A_v2_correct++;
    if (r.evaluations.B_v1.is_correct) B_v1_correct++;
    if (r.evaluations.A_v1.is_correct) A_v1_correct++;

    personaAccuracy[r.persona].total++;
    totalAblationScore += r.ablation.weightedScore;
  }

  let totalSeparationScore = 0;
  for (const p of pairwiseResults) {
    totalSeparationScore += p.separation_score;
    if (p.is_vocabulary_only_swap) vocabOnlySwaps++;
  }

  const accuraciesArray = Object.values(personaAccuracy).map(a => a.correct / a.total);
  const minPersonaAccuracy = Math.min(...accuraciesArray) * 100;

  const summary = {
    accuracy_A_v1: (A_v1_correct / results.length) * 100,
    accuracy_A_v2: (A_v2_correct / results.length) * 100,
    accuracy_B_v1: (B_v1_correct / results.length) * 100,
    accuracy_B_v2: (B_v2_correct / results.length) * 100,

    avgReasoningSeparation: totalSeparationScore / pairwiseResults.length,
    vocabularyOnlySwapRate: (vocabOnlySwaps / pairwiseResults.length) * 100,
    avgAblationDelta: totalAblationScore / results.length,
    minPersonaAccuracy,

    gates: {
      personaClassification: (B_v2_correct / results.length) * 100 >= 75,
      reasoningSeparation: (totalSeparationScore / pairwiseResults.length) >= 80,
      vocabularySwapRate: (vocabOnlySwaps / pairwiseResults.length) * 100 <= 15,
      ablationDelta: (totalAblationScore / results.length) >= 25,
      crossTopicConsistency: minPersonaAccuracy >= 60,
    }
  };

  const reportPath = path.join(__dirname, "benchmark-reports", `exp-005-${Date.now()}.json`);
  fs.writeFileSync(reportPath, JSON.stringify({ summary, results, pairwiseResults }, null, 2));
  console.log(`\n✅ EXP-005 Benchmark complete. Results saved to ${reportPath}`);
  console.log(JSON.stringify(summary, null, 2));
}

runExp005().catch(console.error);
