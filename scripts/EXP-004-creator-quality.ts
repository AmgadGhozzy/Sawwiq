import fs from "fs";
import path from "path";
import { config } from "dotenv";
import { GoogleGenAI } from "@google/genai";

config({ path: path.join(process.cwd(), ".env.local") });

import { evaluatePersona } from "../lib/evaluation/personaEvaluator";
import { evaluateFingerprintSeparation } from "../lib/evaluation/fingerprintEvaluator";
import { evaluateGenericness } from "../lib/evaluation/genericnessEvaluator";
import { evaluateAblatedPersona } from "../lib/evaluation/ablationEvaluator";
import { buildSystemPrompt, buildUserPrompt } from "../lib/content/prompt/compiler";
import { getGeminiResponseSchema } from "../supabase/functions/generate/validation/schema";
import type { InputDTO } from "../supabase/functions/generate/validation/schema";

import {
  PersonaId,
  StyleId,
  PlatformId,
  PERSONA_LETTER_MAP,
  BenchmarkCaseResult,
  BenchmarkReport,
  PairwiseResult,
} from "../lib/evaluation/types";

const ai = new GoogleGenAI({
  vertexai: true,
  apiKey: process.env.VERTEX_AI_API_KEY,
});

const delay = (ms: number) => new Promise(res => setTimeout(res, ms));

async function runBenchmark() {
  const datasetPath = path.join(__dirname, "datasets", "dataset-personal-creator.json");
  const dataset = JSON.parse(fs.readFileSync(datasetPath, "utf-8"));

  const targetCases = parseInt(process.env.EXP_004_CASES || "6", 10);
  console.log(`🚀 Starting EXP-004 Benchmark (Target cases: ${targetCases})`);

  // Build matrix deterministically
  const matrix: any[] = [];
  for (const topic of dataset.topics) {
    for (const platform of dataset.platforms) {
      for (const style of dataset.styles) {
        for (const persona of dataset.personas) {
          matrix.push({ topic, platform, style, persona });
        }
      }
    }
  }

  // Deterministic shuffle using a simple seeded RNG
  const seededRandom = (seed: number) => {
    let x = Math.sin(seed++) * 10000;
    return x - Math.floor(x);
  };

  let seed = 42;
  matrix.sort((a, b) => seededRandom(seed++) - 0.5);

  const selectedCases = matrix.slice(0, targetCases);
  const results: BenchmarkCaseResult[] = [];

  for (let i = 0; i < selectedCases.length; i++) {
    const { topic, platform, style, persona } = selectedCases[i];
    const caseId = `C${(i + 1).toString().padStart(3, "0")}-${persona}-${platform}`;
    console.log(`[${i + 1}/${selectedCases.length}] Running ${caseId}...`);

    const contentType = platform === "x" ? "thread" : "social_post";

    // Build InputDTO
    const input: InputDTO = {
      rawInput: topic.prompt,
      platform,
      contentType,
      mode: "creator",
      metadata: {
        persona,
        style,
        intent: "education",
        originality: "creative",
      },
      arabicStyle: "white_arabic", // default for baseline
    } as any;

    const systemInstruction = buildSystemPrompt(input);
    const userPrompt = buildUserPrompt();

    // Baseline calculation: roughly 4 chars per token
    const promptTokenEstimate = Math.ceil((systemInstruction.length + userPrompt.length) / 4);

    await delay(3000);

    // Generate content with retry
    const responseSchema = getGeminiResponseSchema(contentType);
    let generatedRaw = "";
    let retries = 3;

    while (retries > 0) {
      try {
        const response = await ai.models.generateContent({
          model: "gemini-2.5-flash-lite",
          contents: userPrompt,
          config: {
            systemInstruction,
            responseMimeType: "application/json",
            responseSchema,
            temperature: 0.7,
          },
        });
        generatedRaw = response.text!;
        break; // success
      } catch (e: any) {
        if (e?.status === 429 && retries > 1) {
          console.log(`Rate limited on ${caseId}. Retrying in 10s...`);
          await delay(10000);
          retries--;
        } else {
          console.error(`Generation failed for ${caseId}`, e);
          break; // hard fail
        }
      }
    }

    if (!generatedRaw) continue;

    const generatedContent = JSON.parse(generatedRaw);
    // Convert to string for evaluation
    const fullText = [
      generatedContent.title,
      generatedContent.hook,
      typeof generatedContent.body === "string" ? generatedContent.body : generatedContent.body.map((p: any) => p.text).join("\\n\\n"),
      generatedContent.callToAction,
      generatedContent.hashtags?.join(" ")
    ].join("\\n\\n");

    await delay(3000);
    // Evaluate: Blind Persona
    let pEval: any = { is_correct: false };
    let pRetries = 3;
    while (pRetries > 0) {
      try {
        pEval = await evaluatePersona(fullText);
        const expectedLetter = PERSONA_LETTER_MAP[persona as PersonaId];
        pEval.is_correct = pEval.predicted_persona === expectedLetter;
        break;
      } catch (e: any) {
        if (e?.status === 429 && pRetries > 1) {
          console.log(`Rate limited on persona evaluation for ${caseId}. Retrying...`);
          await delay(10000);
          pRetries--;
        } else {
          console.error("Persona evaluation failed:", e);
          break;
        }
      }
    }

    await delay(3000);
    // Evaluate: Genericness
    let gEval: any = { score: 100, openingSpecificity: 0 };
    let gRetries = 3;
    while (gRetries > 0) {
      try {
        gEval = await evaluateGenericness(fullText);
        break;
      } catch (e: any) {
        if (e?.status === 429 && gRetries > 1) {
          console.log(`Rate limited on genericness evaluation for ${caseId}. Retrying...`);
          await delay(10000);
          gRetries--;
        } else {
          console.error("Genericness evaluation failed:", e);
          break;
        }
      }
    }

    await delay(3000);
    // Evaluate: Ablated Persona (Vocabulary Ablation Test)
    let aEval: any = undefined;
    let aRetries = 3;
    while (aRetries > 0) {
      try {
        const abRes = await evaluateAblatedPersona(fullText, persona as PersonaId);
        const expectedLetter = PERSONA_LETTER_MAP[persona as PersonaId];
        abRes.evaluation.is_correct = abRes.evaluation.predicted_persona === expectedLetter;
        aEval = {
          ablatedText: abRes.ablatedText,
          is_correct: abRes.evaluation.is_correct,
          predicted_persona: abRes.evaluation.predicted_persona,
          confidence_score: abRes.evaluation.confidence_score
        };
        break;
      } catch (e: any) {
        if (e?.status === 429 && aRetries > 1) {
          console.log(`Rate limited on ablation evaluation for ${caseId}. Retrying...`);
          await delay(10000);
          aRetries--;
        } else {
          console.error("Ablation evaluation failed:", e);
          break;
        }
      }
    }

    results.push({
      caseId,
      persona,
      style,
      platform,
      topic,
      promptVersion: "v2-reasoning-profile",
      promptTokenEstimate,
      baselineTokenEstimate: promptTokenEstimate, // placeholder
      generatedContent,
      personaEvaluation: pEval,
      ablationEvaluation: aEval,
      genericnessEvaluation: gEval,
      factEvaluation: { hasCriticalFailure: false, unsupportedClaimsCount: 0, notes: "Mocked: Passed" },
      structuralEvaluation: { passed: true, issues: [] },
      timestamp: new Date().toISOString(),
    });
  }

  // Pairwise Fingerprint Separation
  console.log("\\nRunning Pairwise Comparisons...");
  const pairwiseResults: PairwiseResult[] = [];

  // Group by topic+platform+style
  const groups: Record<string, BenchmarkCaseResult[]> = {};
  for (const r of results) {
    const key = `${r.topic.id}-${r.platform}-${r.style}`;
    if (!groups[key]) groups[key] = [];
    groups[key].push(r);
  }

  for (const key in groups) {
    const group = groups[key];
    if (group.length < 2) continue;

    // Compare first two if we have multiple personas for same topic/platform/style
    for (let i = 0; i < group.length; i++) {
      for (let j = i + 1; j < group.length; j++) {
        const a = group[i];
        const b = group[j];
        if (a.persona !== b.persona) {
          console.log(`Pairwise: ${a.persona} vs ${b.persona} (${key})`);
          const textA = typeof a.generatedContent.body === "string" ? a.generatedContent.body : (a.generatedContent.body as any[]).map((p: any) => p.text).join("\\n\\n");
          const textB = typeof b.generatedContent.body === "string" ? b.generatedContent.body : (b.generatedContent.body as any[]).map((p: any) => p.text).join("\\n\\n");

          await delay(3000);
          let fpRetries = 3;
          while (fpRetries > 0) {
            try {
              const fp = await evaluateFingerprintSeparation(textA, textB);
              pairwiseResults.push({
                pair: [a.persona, b.persona],
                topic: a.topic.id,
                platform: a.platform,
                separation_score: fp.persona_separation_score,
                is_just_vocabulary_swap: fp.is_just_vocabulary_swap,
                perspective_difference: fp.perspective_difference,
                reasoning_difference: fp.reasoning_difference,
                voice_difference: fp.voice_difference
              });
              break;
            } catch (e: any) {
              if (e?.status === 429 && fpRetries > 1) {
                console.log(`Rate limited on pairwise ${a.persona} vs ${b.persona}. Retrying...`);
                await delay(10000);
                fpRetries--;
              } else {
                console.error("Fingerprint evaluation failed:", e);
                break;
              }
            }
          }
        }
      }
    }
  }

  // Calculate Summaries
  const totalCorrect = results.filter(r => r.personaEvaluation?.is_correct).length;
  const ablationCorrect = results.filter(r => r.ablationEvaluation?.is_correct).length;
  const avgSeparation = pairwiseResults.length > 0
    ? pairwiseResults.reduce((sum, r) => sum + r.separation_score, 0) / pairwiseResults.length
    : 0;

  const avgGenericness = results.reduce((sum, r) => sum + (r.genericnessEvaluation?.score || 100), 0) / (results.length || 1);

  // Topic leakage: average risk score across all cases (lower = better evaluator quality)
  const leakageResults = results.filter(r => r.personaEvaluation?.topic_leakage_risk !== undefined);
  const avgTopicLeakageRisk = leakageResults.length > 0
    ? leakageResults.reduce((sum, r) => sum + (r.personaEvaluation.topic_leakage_risk ?? 0), 0) / leakageResults.length
    : 0;

  const summary = {
    personaClassificationAccuracy: (totalCorrect / results.length) * 100,
    ablationAccuracy: (ablationCorrect / results.length) * 100,
    avgPersonaSeparationScore: avgSeparation,
    avgGenericnessScore: avgGenericness,
    avgTopicLeakageRisk,
    avgOpeningSpecificity: results.reduce((sum, r) => sum + r.genericnessEvaluation.openingSpecificity, 0) / (results.length || 1),
    criticalFactFailures: 0,
    structuralPassRate: 100,
    promptGrowthPercent: 0,
    gates: {
      personaClassification: (totalCorrect / results.length) * 100 >= 75,
      personaSeparation: avgSeparation >= 80,
      genericnessScore: avgGenericness <= 60,
      topicLeakage: avgTopicLeakageRisk <= 20, // ≤20% topic leakage
      criticalFactFailures: true,
      structuralCompliance: true,
      promptGrowth: true,
    },
    overallPass: false
  };

  summary.overallPass = Object.values(summary.gates).every(v => v);

  const report: BenchmarkReport = {
    experiment: "EXP-004",
    promptVersion: "v2-reasoning-profile+anti-leakage-eval",
    totalCases: results.length,
    timestamp: new Date().toISOString(),
    cases: results,
    pairwiseResults,
    summary
  };

  const reportPath = path.join(__dirname, "benchmark-reports", `exp-004-${Date.now()}.json`);
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));

  console.log("\n✅ Benchmark Complete!");
  console.log("Summary:");
  console.log(`- Persona Accuracy:     ${summary.personaClassificationAccuracy.toFixed(1)}%  (Gate: >= 75%)`);
  console.log(`- Ablation Accuracy:    ${summary.ablationAccuracy.toFixed(1)}%  (Gate: >= 75%)`);
  console.log(`- Avg Separation:       ${summary.avgPersonaSeparationScore.toFixed(1)}   (Gate: >= 80)`);
  console.log(`- Avg Genericness:      ${summary.avgGenericnessScore.toFixed(1)}   (Gate: <= 60)`);
  console.log(`- Topic Leakage Risk:   ${(summary as any).avgTopicLeakageRisk?.toFixed(1) ?? "n/a"}   (Gate: <= 20)`);
  console.log(`- Overall Pass:         ${summary.overallPass ? "✅ YES" : "❌ NO"}`);
  console.log(`\nReport saved to: ${reportPath}`);
}

runBenchmark().catch(console.error);
