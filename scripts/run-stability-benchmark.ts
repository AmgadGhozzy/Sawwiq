/**
 * Stability / Repeated-Seed Benchmark
 *
 * Purpose:
 *   Measure the LLM Noise / Stability of the current Production Default (Control).
 *   Runs the exact same configuration 3 times per case (Run A, Run B, Run C).
 *
 * Methodology:
 *   - Same inputs, same parameters, same code.
 *   - Calculates pairwise absolute deltas (|A-B|, |B-C|, |A-C|).
 *   - The Noise Floor is established as the P95 of all pairwise absolute deltas.
 *
 * Usage:
 *   npx tsx scripts/run-stability-benchmark.ts            # 30 cases
 *   npx tsx scripts/run-stability-benchmark.ts --cases 3  # smoke test
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { config } from "dotenv";
config({ path: ".env.local" });
config({ path: ".env" });

import dataset from "../lib/evaluation/dataset.json" assert { type: "json" };
import { evaluatePublishReadiness } from "../lib/evaluation/plannerLLMJudge.ts";
import type { PublishReadinessResult } from "../lib/evaluation/plannerLLMJudge.ts";
import { buildMarketingPlannerPrompt } from "../lib/planner/marketing/marketingPlannerPrompt.ts";
import { buildMarketingRendererPrompt } from "../lib/planner/marketing/marketingRendererPrompt.ts";
import { MARKETING_TOPOLOGIES } from "../lib/planner/marketing/topologies.ts";
import { parsePlannerOutput, parseRendererOutput } from "../lib/planner/output/parser.ts";
import { createVertexAIClient } from "../lib/ai/googleClient.ts";
import { aiConfig } from "../lib/config.ts";
import type { NormalizedPlannerRequest, IRGraph } from "../lib/planner/types.ts";
import type { GeneratedContent, CopyFramework, MarketingToneId } from "../types/content.ts";

// ─── Fixed Benchmark Parameters ────────────────────────────────────────────────
const COPY_FRAMEWORK: CopyFramework = "benefit_led";
const TONE: MarketingToneId = "professional";
const LANGUAGE = "ar" as const;
const OBJECTIVE = "sales" as const;
const MODEL = process.env.GEMINI_MODEL ?? aiConfig.model;
const TEMPERATURE = aiConfig.temperature;
const GENERATION_CONFIG = {
  temperature: TEMPERATURE,
  responseMimeType: "application/json",
} as const;

// ─── Stats Helpers ────────────────────────────────────────────────────────────

function mean(arr: number[]): number {
  return arr.length === 0 ? 0 : arr.reduce((s, v) => s + v, 0) / arr.length;
}

function median(arr: number[]): number {
  if (arr.length === 0) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid];
}

function percentile(arr: number[], p: number): number {
  if (arr.length === 0) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const idx = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, idx)];
}

function stdDev(arr: number[], m?: number): number {
  if (arr.length <= 1) return 0;
  const meanVal = m ?? mean(arr);
  const variance = arr.reduce((acc, val) => acc + Math.pow(val - meanVal, 2), 0) / (arr.length - 1);
  return Math.sqrt(variance);
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface VariantResult {
  success: boolean;
  hasHallucinations: boolean;
  publishReadyScore: number | null;
  error?: string;
}

interface CaseResult {
  caseId: string;
  name: string;
  runA: VariantResult;
  runB: VariantResult;
  runC: VariantResult;
  pairwiseDeltas: number[]; // |A-B|, |B-C|, |A-C| for this case
  caseVariance: number;     // variance among A, B, C for this case
}

// ─── Variant Runner ───────────────────────────────────────────────────────────

async function runCandidate(
  client: ReturnType<typeof createVertexAIClient>,
  normalized: NormalizedPlannerRequest,
): Promise<{ content: GeneratedContent | null; error?: string }> {
  const topology = MARKETING_TOPOLOGIES[COPY_FRAMEWORK];
  
  let irGraph: IRGraph;
  try {
    const res = await client.models.generateContent({
      model: MODEL,
      contents: buildMarketingPlannerPrompt(normalized),
      config: GENERATION_CONFIG,
    });
    const plannerRaw = res.text ?? "";
    const parsed = parsePlannerOutput(plannerRaw);
    irGraph = {
      personaId: "marketing",
      nodes: parsed.nodes,
      angles: parsed.angles ?? [],
      edges: topology.nodes.slice(0, -1).map((n: string, i: number) => ({
        from: n,
        to: topology.nodes[i + 1],
        rel: "leads_to",
      })),
    };
  } catch (err: any) {
    return { content: null, error: `Planner: ${err.message}` };
  }

  try {
    const res = await client.models.generateContent({
      model: MODEL,
      contents: buildMarketingRendererPrompt(irGraph, normalized),
      config: GENERATION_CONFIG,
    });
    const rendererRaw = res.text ?? "";
    const content = parseRendererOutput(rendererRaw);
    return { content };
  } catch (err: any) {
    return { content: null, error: `Renderer: ${err.message}` };
  }
}

async function runSingle(client: any, normalized: NormalizedPlannerRequest, topic: string, platform: string): Promise<VariantResult> {
  const res = await runCandidate(client, normalized);
  if (!res.content) {
    return { success: false, hasHallucinations: false, publishReadyScore: null, error: res.error };
  }
  try {
    const evalResult = await evaluatePublishReadiness(res.content, topic, platform, "marketing", COPY_FRAMEWORK);
    return {
      success: true,
      hasHallucinations: evalResult.hasHallucinations,
      publishReadyScore: evalResult.publishReadyScore,
    };
  } catch (err: any) {
    return { success: false, hasHallucinations: false, publishReadyScore: null, error: `Evaluator: ${err.message}` };
  }
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function runStabilityBenchmark() {
  const args = process.argv.slice(2);
  // Support both: `--cases N` (named) and a bare positional number as first arg.
  // `npm run benchmark:stability -- --cases 3` → args = ["--cases", "3"]
  // `npm run benchmark:stability -- 3`         → args = ["3"]
  const casesIdx = args.indexOf("--cases");
  let REQUESTED_CASES = 30;
  if (casesIdx >= 0 && args[casesIdx + 1]) {
    REQUESTED_CASES = parseInt(args[casesIdx + 1], 10);
  } else if (args[0] && /^\d+$/.test(args[0])) {
    REQUESTED_CASES = parseInt(args[0], 10);
  }
  if (isNaN(REQUESTED_CASES) || REQUESTED_CASES <= 0) REQUESTED_CASES = 30;

  const testCases = dataset.slice(0, Math.min(REQUESTED_CASES, dataset.length));
  const executed = testCases.length;

  console.log(`\n🔬 Stability / Repeated-Seed Benchmark (A/A/A)`);
  console.log(`   Model:     ${MODEL}  |  Temperature: ${TEMPERATURE}`);
  console.log(`   Config:    ${COPY_FRAMEWORK} / ${TONE}`);
  console.log(`   Cases:     ${executed}`);
  console.log(`   Runs/Case: 3 (Run A, Run B, Run C)\n`);
  console.log("─".repeat(76));

  const client = createVertexAIClient();
  const allResults: CaseResult[] = [];

  const scoresA: number[] = [];
  const scoresB: number[] = [];
  const scoresC: number[] = [];
  
  let hallucinationsA = 0, hallucinationsB = 0, hallucinationsC = 0;
  let failuresA = 0, failuresB = 0, failuresC = 0;

  const globalPairwiseDeltas: number[] = [];

  for (const [i, tc] of testCases.entries()) {
    const rawPlatform = (tc.input.platform || "x") as string;
    const platform = rawPlatform === "x_twitter" ? "x" : rawPlatform;
    const topic = tc.input.rawInput;
    const audience = (tc.input.metadata as any)?.targetAudience as string | undefined;
    const forbiddenTerms: string[] = tc.expectations?.mustNotContain ?? [];
    const requiredTerms: string[] = tc.expectations?.mustContain ?? [];

    process.stdout.write(`[${String(i + 1).padStart(2, "0")}/${executed}] ${tc.name.slice(0, 28).padEnd(30)} `);

    const normalized: NormalizedPlannerRequest = {
      topic,
      platform,
      objective: OBJECTIVE,
      language: LANGUAGE,
      audience,
      purpose: "marketing",
      persona: undefined,
      tone: TONE,
      copyFramework: COPY_FRAMEWORK,
      keyMessage: topic,
      constraints: { forbiddenTerms, requiredTerms },
    };

    // Run sequentially to minimize hitting rate limits
    const runA = await runSingle(client, normalized, topic, platform);
    const runB = await runSingle(client, normalized, topic, platform);
    const runC = await runSingle(client, normalized, topic, platform);

    if (runA.publishReadyScore !== null) { scoresA.push(runA.publishReadyScore); if (runA.hasHallucinations) hallucinationsA++; } else failuresA++;
    if (runB.publishReadyScore !== null) { scoresB.push(runB.publishReadyScore); if (runB.hasHallucinations) hallucinationsB++; } else failuresB++;
    if (runC.publishReadyScore !== null) { scoresC.push(runC.publishReadyScore); if (runC.hasHallucinations) hallucinationsC++; } else failuresC++;

    const caseScores = [runA.publishReadyScore, runB.publishReadyScore, runC.publishReadyScore].filter((s): s is number => s !== null);
    
    let pairwiseDeltas: number[] = [];
    if (runA.publishReadyScore !== null && runB.publishReadyScore !== null) pairwiseDeltas.push(Math.abs(runA.publishReadyScore - runB.publishReadyScore));
    if (runB.publishReadyScore !== null && runC.publishReadyScore !== null) pairwiseDeltas.push(Math.abs(runB.publishReadyScore - runC.publishReadyScore));
    if (runA.publishReadyScore !== null && runC.publishReadyScore !== null) pairwiseDeltas.push(Math.abs(runA.publishReadyScore - runC.publishReadyScore));

    globalPairwiseDeltas.push(...pairwiseDeltas);

    const caseVar = caseScores.length > 1 ? stdDev(caseScores) : 0;

    console.log(`A:${runA.publishReadyScore?.toFixed(2) ?? 'FAIL'}  B:${runB.publishReadyScore?.toFixed(2) ?? 'FAIL'}  C:${runC.publishReadyScore?.toFixed(2) ?? 'FAIL'}  |  Case SD: ${caseVar.toFixed(3)}`);

    allResults.push({
      caseId: tc.id,
      name: tc.name,
      runA,
      runB,
      runC,
      pairwiseDeltas,
      caseVariance: caseVar,
    });
  }

  // ─── Aggregate Summary ────────────────────────────────────────────────────────
  
  const meanA = mean(scoresA);
  const meanB = mean(scoresB);
  const meanC = mean(scoresC);
  
  const sdA = stdDev(scoresA, meanA);
  const sdB = stdDev(scoresB, meanB);
  const sdC = stdDev(scoresC, meanC);

  const meanPairwise = mean(globalPairwiseDeltas);
  const medianPairwise = median(globalPairwiseDeltas);
  const p95Pairwise = percentile(globalPairwiseDeltas, 95);

  console.log("\n" + "═".repeat(76));
  console.log("📊 STABILITY RESULTS\n");

  console.log("── Independent Runs ─────────────────────────────────────────────────");
  console.log(`  Run A:  Mean = ${meanA.toFixed(3)}  |  SD = ${sdA.toFixed(3)}  |  Failures: ${failuresA}`);
  console.log(`  Run B:  Mean = ${meanB.toFixed(3)}  |  SD = ${sdB.toFixed(3)}  |  Failures: ${failuresB}`);
  console.log(`  Run C:  Mean = ${meanC.toFixed(3)}  |  SD = ${sdC.toFixed(3)}  |  Failures: ${failuresC}`);
  
  console.log("\n── Global A/A Variability (Pairwise Absolute Deltas) ────────────────");
  console.log(`  Pairs analyzed: ${globalPairwiseDeltas.length}`);
  console.log(`  Mean |Δ|:       ${meanPairwise.toFixed(3)}`);
  console.log(`  Median |Δ|:     ${medianPairwise.toFixed(3)}`);
  console.log(`  P95 |Δ|:        ${p95Pairwise.toFixed(3)}`);
  
  console.log("\n── A/A Noise Interpretation (3-tier) ───────────────────────────────");
  console.log(`  Typical noise (Median |Δ|): ${medianPairwise.toFixed(3)}`);
  console.log(`  Average noise (Mean |Δ|):   ${meanPairwise.toFixed(3)}`);
  console.log(`  Tail noise    (P95  |Δ|):   ${p95Pairwise.toFixed(3)}`);
  console.log("");
  console.log(`  How to interpret future Mean Paired Δ:`);
  console.log(`    |Δ| < ${medianPairwise.toFixed(2)}        → Almost certainly noise. Discard.`);
  console.log(`    ${medianPairwise.toFixed(2)} – ${(p95Pairwise * 0.67).toFixed(2)}    → Ambiguous zone. Requires replication.`);
  console.log(`    ${(p95Pairwise * 0.67).toFixed(2)} – ${p95Pairwise.toFixed(2)}    → Strong signal candidate. Requires Safety Gate + replication.`);
  console.log(`    |Δ| > ${p95Pairwise.toFixed(2)}        → Large effect. Still requires Safety Gate + replication.`);
  console.log("");
  console.log(`  Note: P95 (${p95Pairwise.toFixed(3)}) is the tail of A/A individual-pair variance,`);
  console.log(`  NOT the threshold for minimum detectable mean effect. Do not use it as a binary gate.`);

  // ─── Save Report ──────────────────────────────────────────────────────────────
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  const isoTimestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const reportDir = path.join(__dirname, "benchmark-reports");
  if (!fs.existsSync(reportDir)) fs.mkdirSync(reportDir, { recursive: true });
  const reportPath = path.join(reportDir, `stability_report_${isoTimestamp}.json`);

  const summary = {
    meta: {
      model: MODEL,
      temperature: TEMPERATURE,
      copyFramework: COPY_FRAMEWORK,
      tone: TONE,
      executedAt: new Date().toISOString(),
    },
    runs: {
      A: { mean: meanA, sd: sdA, failures: failuresA, hallucinations: hallucinationsA },
      B: { mean: meanB, sd: sdB, failures: failuresB, hallucinations: hallucinationsB },
      C: { mean: meanC, sd: sdC, failures: failuresC, hallucinations: hallucinationsC },
    },
    pairwiseAbsoluteDeltas: {
      count: globalPairwiseDeltas.length,
      mean: meanPairwise,
      median: medianPairwise,
      p95: p95Pairwise,
    },
    noiseFloor: p95Pairwise,
  };

  fs.writeFileSync(reportPath, JSON.stringify({ summary, results: allResults }, null, 2));
  console.log(`\n📄 Report: ${reportPath}`);
  console.log("═".repeat(76) + "\n");
}

runStabilityBenchmark();
