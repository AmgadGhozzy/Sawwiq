import fs from "fs";
import path from "path";
import { config } from "dotenv";

config({ path: path.join(process.cwd(), ".env.local") });

import { evaluatePersona } from "../lib/evaluation/personaEvaluator";
import { evaluateReasoningSeparation } from "../lib/evaluation/reasoningSeparationEvaluator";
import { evaluateAblationWeighted } from "../lib/evaluation/ablationEvaluator";
import { evaluateGenericness } from "../lib/evaluation/genericnessEvaluator";
import { buildSystemPrompt, buildUserPrompt } from "../lib/content/prompt/compiler";
import { GEMINI_RESPONSE_SCHEMA } from "../supabase/functions/generate/validation/schema";
import { getPersona } from "../lib/content/personas/registry";
import type { InputDTO } from "../supabase/functions/generate/validation/schema";
import { PERSONA_LETTER_MAP } from "../lib/evaluation/types";
import type { PersonaId } from "../lib/evaluation/types";

import { callAI } from "./lib/aiClient";

const delay = (ms: number) => new Promise(res => setTimeout(res, ms));

// ─── Checkpoint ──────────────────────────────────────────────────────────────
const CHECKPOINT_DIR = path.join(__dirname, "benchmark-reports");
const CHECKPOINT_PATH = path.join(CHECKPOINT_DIR, "exp-005-checkpoint.json");

interface Checkpoint {
  runId: string;
  completedCaseIds: string[];
  results: any[];
}

function loadCheckpoint(): Checkpoint | null {
  if (!fs.existsSync(CHECKPOINT_PATH)) return null;
  try {
    const data = JSON.parse(fs.readFileSync(CHECKPOINT_PATH, "utf-8"));
    console.log(`   ♻️  Checkpoint found (runId: ${data.runId}). ${data.completedCaseIds.length} cases already done.`);
    return data;
  } catch {
    console.log("   ⚠️  Checkpoint file corrupt — starting fresh.");
    return null;
  }
}

function saveCheckpoint(checkpoint: Checkpoint) {
  fs.writeFileSync(CHECKPOINT_PATH, JSON.stringify(checkpoint, null, 2));
}

function clearCheckpoint() {
  if (fs.existsSync(CHECKPOINT_PATH)) {
    fs.unlinkSync(CHECKPOINT_PATH);
  }
}

// ─── Model Pool ──────────────────────────────────────────────────────────────
const MODEL_POOL = ["gemini-2.5-flash-lite"];
let modelIndex = 0;
function nextModel(): string {
  const model = MODEL_POOL[modelIndex % MODEL_POOL.length];
  modelIndex++;
  return model;
}

async function generateContent(input: InputDTO): Promise<string> {
  const systemInstruction = buildSystemPrompt(input);
  const userPrompt = buildUserPrompt();
  const responseSchema = GEMINI_RESPONSE_SCHEMA;

  const personaCfg = (input as any).metadata?.persona;
  if (personaCfg) {
    const expectsConstraint = personaCfg.usePerspectiveConstraint === true;
    const hasConstraint =
      systemInstruction.includes("<reasoning_contract>") ||
      systemInstruction.includes("<perspective_constraint>");
    if (expectsConstraint && !hasConstraint) {
      throw new Error(
        "INSTRUMENTATION FAILURE: perspective constraint missing from a Variant B prompt — aborting the entire experiment."
      );
    }
    if (!expectsConstraint && hasConstraint) {
      throw new Error(
        "INSTRUMENTATION FAILURE: perspective constraint leaked into a baseline (Variant A) prompt — aborting the entire experiment."
      );
    }
  }

  const model = nextModel() as any;
  return await callAI({
    model,
    contents: userPrompt,
    config: {
      systemInstruction,
      responseMimeType: "application/json",
      responseSchema,
      temperature: 0.7,
    }
  });
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

const retryEval = async <T>(fn: () => Promise<T>, label = "eval"): Promise<T> => {
  let retries = 10;
  while (retries > 0) {
    try { return await fn(); }
    catch (e: any) {
      const isRetriable = e?.status === 429 || e?.code === "ECONNRESET" ||
        e?.cause?.code === "ECONNRESET" || e?.message?.includes("fetch failed");
      if (isRetriable && retries > 1) {
        console.log(`     [Rate Limit] ${label} hit. Waiting 15s before retry (${retries - 1} left)...`);
        await delay(15000);
        retries--;
      } else throw e;
    }
  }
  throw new Error("Max retries exceeded");
};

async function runExp005() {
  const datasetPath = path.join(__dirname, "datasets", "dataset-exp-005.json");
  const dataset = JSON.parse(fs.readFileSync(datasetPath, "utf-8"));

  const isSample = process.env.EXP_005_SAMPLE === "true";
  const isManualSample = process.env.EXP_005_MANUAL_SAMPLE === "true";
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

  if (isManualSample) {
    console.log("   Manual sample mode activated. Selecting 12 diverse cases...");
    const selectedPairs = [
      { tId: "T-P01", pId: "developer" },
      { tId: "T-P02", pId: "psychology" },
      { tId: "T-P03", pId: "intellectual" },
      { tId: "T-P04", pId: "creative" },
      { tId: "T-P05", pId: "developer" },
      { tId: "T-P06", pId: "developer" },
      { tId: "T-P02", pId: "developer" },
      { tId: "T-P06", pId: "psychology" },
      { tId: "T-P04", pId: "intellectual" },
      { tId: "T-P05", pId: "psychology" },
      { tId: "T-P03", pId: "creative" },
      { tId: "T-P01", pId: "creative" }
    ];
    matrix = [];
    for (const pair of selectedPairs) {
      const topic = dataset.topics.find((t: any) => t.id === pair.tId);
      if (topic) {
        matrix.push({ topic, platform: dataset.platforms[0], style: dataset.styles[0], persona: pair.pId });
      }
    }
  } else if (isSample) {
    matrix = matrix.slice(0, 5);
  }

  const limitEnv = process.env.EXP_005_LIMIT;
  if (limitEnv) {
    const n = Math.max(1, parseInt(limitEnv, 10) || 1);
    matrix = matrix.slice(0, n);
    console.log(`   Limit mode (EXP_005_LIMIT=${limitEnv}): running first ${matrix.length} case(s) only`);
  }

  // ─── Checkpoint / Resume ──────────────────────────────────────────────────
  // Each matrix item gets a stable caseId before we start
  const matrixWithIds = matrix.map((item, i) => ({
    ...item,
    caseId: `C${(i + 1).toString().padStart(3, "0")}-${item.persona}-${item.topic.id}`,
  }));

  const runId = isManualSample ? "manual-sample" : (isSample ? "sample" : "full-24");
  let checkpoint = loadCheckpoint();

  // If checkpoint belongs to a different run config, discard it
  if (checkpoint && checkpoint.runId !== runId) {
    console.log(`   ⚠️  Checkpoint runId mismatch (${checkpoint.runId} vs ${runId}). Starting fresh.`);
    checkpoint = null;
  }

  const completedIds = new Set(checkpoint?.completedCaseIds ?? []);
  const results: any[] = checkpoint?.results ?? [];

  // ─── Main Loop ────────────────────────────────────────────────────────────
  for (let i = 0; i < matrixWithIds.length; i++) {
    const { topic, platform, style, persona, caseId } = matrixWithIds[i];

    if (completedIds.has(caseId)) {
      console.log(`\n[${i + 1}/${matrixWithIds.length}] Skipping ${caseId} (already done ✓)`);
      continue;
    }

    console.log(`\n[${i + 1}/${matrixWithIds.length}] Running ${caseId}...`);

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

    // Variant A
    console.log(`   Generating Variant A (Baseline)...`);
    const inputA = { ...baseInput, metadata: { ...baseInput.metadata, persona: { ...basePersona, usePerspectiveConstraint: false } } };
    const promptLenA = buildSystemPrompt(inputA as any).length;
    const rawA = await generateContent(inputA as any);
    const textA = extractFullText(rawA);
    const parsedOkA = textA !== rawA;

    await delay(2000);

    // Variant B
    console.log(`   Generating Variant B (Perspective)...`);
    const inputB = { ...baseInput, metadata: { ...baseInput.metadata, persona: { ...basePersona, usePerspectiveConstraint: true } } };
    const promptLenB = buildSystemPrompt(inputB as any).length;
    const rawB = await generateContent(inputB as any);
    const textB = extractFullText(rawB);
    const parsedOkB = textB !== rawB;

    await delay(2000);

    // 2x2 Evaluation
    console.log(`   Evaluating Persona Accuracy (2x2 Matrix)...`);
    const eval_A_v1 = await retryEval(() => evaluatePersona(textA, "v1"), "A_v1"); await delay(2000);
    const eval_A_v2 = await retryEval(() => evaluatePersona(textA, "v2"), "A_v2"); await delay(2000);
    const eval_B_v1 = await retryEval(() => evaluatePersona(textB, "v1"), "B_v1"); await delay(2000);
    const eval_B_v2 = await retryEval(() => evaluatePersona(textB, "v2"), "B_v2"); await delay(2000);

    const expectedLetter = PERSONA_LETTER_MAP[persona as PersonaId];

    console.log(`   Evaluating Weighted Ablation (Variant B)...`);
    const ablationResult = await retryEval(() => evaluateAblationWeighted(textB, persona as PersonaId), "ablation");
    await delay(2000);

    const genericness = await retryEval(() => evaluateGenericness(textB), "genericness");
    await delay(2000);

    const caseResult = {
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
      genericness,
      promptLengths: { A: promptLenA, B: promptLenB },
      structuralOk: parsedOkA && parsedOkB
    };

    results.push(caseResult);
    completedIds.add(caseId);

    // ── Save checkpoint after every case ──────────────────────────────────
    saveCheckpoint({ runId, completedCaseIds: [...completedIds], results });
    console.log(`   ✓ Checkpoint saved (${completedIds.size}/${matrixWithIds.length} done)`);
  }

  if (isSample && !isManualSample) {
    const reportPath = path.join(__dirname, "benchmark-reports", `exp-005-sample-${Date.now()}.json`);
    fs.writeFileSync(reportPath, JSON.stringify(results, null, 2));
    console.log(`\n✅ Sample run complete. Results saved to ${reportPath}`);
    clearCheckpoint();
    return;
  }

  // ─── Pairwise Reasoning Separation ───────────────────────────────────────
  console.log(`\nRunning Pairwise Comparisons on Variant B...`);
  const pairwiseResults: any[] = [];

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

        const separation = await retryEval(() => evaluateReasoningSeparation(
          case1.textB, case1.persona as PersonaId,
          case2.textB, case2.persona as PersonaId
        ), `pairwise-${topicId}`);

        pairwiseResults.push({
          topic: topicId,
          pair: [case1.persona, case2.persona],
          ...separation
        });
        await delay(3000);
      }
    }
  }

  // ─── Compile Summary ─────────────────────────────────────────────────────
  let B_v2_correct = 0, A_v2_correct = 0, B_v1_correct = 0, A_v1_correct = 0;
  const personaAccuracy: Record<string, { total: number; correct: number }> = {};
  dataset.personas.forEach((p: string) => personaAccuracy[p] = { total: 0, correct: 0 });
  let totalAblationScore = 0, vocabOnlySwaps = 0;

  for (const r of results) {
    if (r.evaluations.B_v2.is_correct) { B_v2_correct++; personaAccuracy[r.persona].correct++; }
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

  const activePersonas = Object.values(personaAccuracy).filter(a => a.total > 0);
  const minPersonaAccuracy = activePersonas.length > 0
    ? Math.min(...activePersonas.map(a => a.correct / a.total)) * 100
    : 0;

  let totalGenericness = 0, structuralOkCount = 0, growthSum = 0;
  for (const r of results) {
    totalGenericness += r.genericness.score;
    if (r.structuralOk) structuralOkCount++;
    growthSum += (r.promptLengths.B - r.promptLengths.A) / Math.max(1, r.promptLengths.A);
  }
  const avgGenericness = totalGenericness / results.length;
  const structuralRate = (structuralOkCount / results.length) * 100;
  const avgPromptGrowthPct = (growthSum / results.length) * 100;

  let v1_vs_v2_disagreement = 0, a_failed_count = 0, rescued_count = 0;
  for (const r of results) {
    if (r.evaluations.B_v1.is_correct !== r.evaluations.B_v2.is_correct) v1_vs_v2_disagreement++;
    if (!r.evaluations.A_v2.is_correct) {
      a_failed_count++;
      if (r.evaluations.B_v2.is_correct && r.ablation.weightedScore >= 15) rescued_count++;
    }
  }

  const rescueRate = a_failed_count > 0 ? (rescued_count / a_failed_count) * 100 : 0;
  const v1V2DisagreementRate = (v1_vs_v2_disagreement / results.length) * 100;
  const accA = (A_v2_correct / results.length) * 100;
  const accB = (B_v2_correct / results.length) * 100;

  const summary = {
    accuracy_A_v2: accA,
    accuracy_B_v2: accB,
    delta_accuracy: accB - accA,
    rescueRate,
    v1V2DisagreementRate,
    accuracy_A_v1: (A_v1_correct / results.length) * 100,
    accuracy_B_v1: (B_v1_correct / results.length) * 100,
    avgReasoningSeparation: totalSeparationScore / pairwiseResults.length,
    vocabularyOnlySwapRate: (vocabOnlySwaps / pairwiseResults.length) * 100,
    avgAblationDelta: totalAblationScore / results.length,
    minPersonaAccuracy,
    avgGenericness,
    structuralRate,
    avgPromptGrowthPct,
    gates: {
      structuralIntegrity: structuralRate >= 98,
      genericnessCeiling: avgGenericness <= 60,
      personaClassification: accB >= 75,
    },
    metrics: {
      reasoningSeparation: totalSeparationScore / pairwiseResults.length,
      ablationDelta: totalAblationScore / results.length,
      promptGrowth: avgPromptGrowthPct,
      vocabularySwapRate: (vocabOnlySwaps / pairwiseResults.length) * 100,
      crossTopicConsistency: minPersonaAccuracy
    }
  };

  const reportPath = path.join(__dirname, "benchmark-reports", `exp-005-${Date.now()}.json`);
  fs.writeFileSync(reportPath, JSON.stringify({ summary, results, pairwiseResults }, null, 2));
  console.log(`\n✅ EXP-005 Benchmark complete. Results saved to ${reportPath}`);
  console.log(JSON.stringify(summary, null, 2));

  // ─── Clear checkpoint on success ─────────────────────────────────────────
  clearCheckpoint();
  console.log(`   🗑️  Checkpoint cleared.`);
}

runExp005().catch((e) => {
  console.error(e);
  console.error("\n💾 Progress saved to checkpoint. Re-run the script to resume.");
  process.exit(1);
});
