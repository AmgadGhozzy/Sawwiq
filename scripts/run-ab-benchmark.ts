/**
 * Regression Benchmark — True Baseline vs Candidate
 *
 * Purpose:
 *   Measure the real impact of the new Marketing Engine architecture.
 *   The ONLY variable between A and B is the prompt structure itself.
 *
 * Methodology:
 *   - A (Baseline): Minimal prompts — no node contracts, no angles,
 *     no tone contracts, no factuality gate, no platform writing contracts.
 *     Direct Gemini calls; ZERO localPipeline involvement.
 *   - B (Candidate): Current lib prompt builders (buildMarketingPlannerPrompt +
 *     buildMarketingRendererPrompt). Direct Gemini calls; ZERO localPipeline.
 *   - Identical: model / temperature / generation config / dataset / evaluator /
 *     copyFramework / tone / language / platform / objective per case.
 *
 * Usage:
 *   npx tsx scripts/run-ab-benchmark.ts            # 30 cases
 *   npx tsx scripts/run-ab-benchmark.ts --cases 3  # smoke test first
 *
 * Report:
 *   benchmark-reports/ab_report_*.json
 *   (includes plannerOutputRaw + rendererOutputRaw per case for artifact inspection)
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
import type { GeneratedContent } from "../types/content.ts";
import type { CopyFramework, MarketingToneId } from "../types/content.ts";

// ─── Fixed Benchmark Parameters (identical for both variants) ─────────────────
// Changing these would introduce a confound. To test other combinations,
// run the Secondary Matrix benchmark instead.

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

// ─── Variant Labels ───────────────────────────────────────────────────────────

const VARIANT_A = {
  label: "true_baseline / pre-improvement prompts",
  description:
    "Minimal planner + renderer. No node contracts, no angles, no angle provenance, " +
    "no tone contracts, no factuality gate, no platform writing contracts, no message strategy.",
  copyFramework: COPY_FRAMEWORK,
  tone: TONE,
};

const VARIANT_B = {
  label: "candidate / current marketing engine",
  description:
    "buildMarketingPlannerPrompt + buildMarketingRendererPrompt from lib. " +
    "Node contracts, angles, angle provenance (sourceNodes), tone contracts (both phases), " +
    "factuality gate in renderer, platform writing contracts, message strategy per objective.",
  copyFramework: COPY_FRAMEWORK,
  tone: TONE,
};

// ─── Baseline Prompt Builders (self-contained snapshot) ───────────────────────
//
// These represent the Marketing Engine BEFORE architectural improvements.
// They DELIBERATELY omit every feature added in the refactor:
//   ✗ Node contracts (what each node must accomplish)
//   ✗ Angles (persuasion lens layer)
//   ✗ Angle provenance / sourceNodes
//   ✗ Tone contracts (in planner or renderer)
//   ✗ Factuality / anti-hallucination gate in renderer
//   ✗ Platform-specific writing contracts
//   ✗ Objective message strategy
//
// Only the minimum structure required to produce valid parseable JSON is present.
// Do NOT add features here — that would contaminate the baseline.

function buildBaselinePlannerPrompt(
  topic: string,
  platform: string,
  objective: string,
  language: string,
  audience: string | undefined,
  forbiddenTerms: string[],
  requiredTerms: string[],
): string {
  return `You are a Marketing Content Planner. Generate structured marketing content.
You MUST output valid JSON only. No markdown, no explanations.

[OUTPUT FORMAT]
{
  "nodes": [{ "id": "...", "content": "..." }]
}

Generate exactly the nodes listed below — no extra fields, no extra nodes.

[INPUT]
Topic: ${topic}
Platform: ${platform}
Objective: ${objective}
Language: ${language}
${audience ? `Audience: ${audience}` : ""}
${forbiddenTerms.length ? `Forbidden terms: ${forbiddenTerms.join(", ")}` : ""}
${requiredTerms.length ? `Required terms: ${requiredTerms.join(", ")}` : ""}

[REQUIRED NODES]
- product_core
- benefit
- desire
- proof
- action`.trim();
}

function buildBaselineRendererPrompt(
  ir: IRGraph,
  platform: string,
  language: string,
  maxLength: number | undefined,
  forbiddenTerms: string[],
  requiredTerms: string[],
): string {
  return `You are a Content Renderer. Transform this IR into a marketing post.
You MUST output valid JSON only. No markdown, no explanations.

[OUTPUT FORMAT]
{
  "title": "Short internal title",
  "hook": "Opening line(s) that grab attention",
  "body": "Main content",
  "callToAction": "Clear next step for the reader",
  "hashtags": ["tag1", "tag2"]
}

[IR NODES]
${JSON.stringify(ir.nodes.map((n) => ({ id: n.id, content: n.content })), null, 2)}

[CONSTRAINTS]
${forbiddenTerms.length ? `- Forbidden terms: ${forbiddenTerms.join(", ")}` : ""}
${requiredTerms.length ? `- Required terms: ${requiredTerms.join(", ")}` : ""}
- Output Language: ${language}
${maxLength ? `- MAXIMUM LENGTH: Combined character count of all fields MUST NOT exceed ${maxLength}.` : ""}`.trim();
}

// ─── Platform Defaults ────────────────────────────────────────────────────────

const PLATFORM_MAX_LENGTHS: Record<string, number> = {
  x: 280,
  instagram: 2200,
  facebook: 1500,
  linkedin: 2800,
};

// ─── Stats ────────────────────────────────────────────────────────────────────

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

// ─── Types ────────────────────────────────────────────────────────────────────

const DIMS = [
  "productFidelity",
  "persuasion",
  "objectiveFit",
  "platformFit",
  "naturalArabic",
  "publishReadyScore",
] as const;
type Dim = (typeof DIMS)[number];

interface VariantResult {
  success: boolean;
  hasHallucinations: boolean;
  isOverConstrained: boolean;
  scores: Pick<PublishReadinessResult, Dim> | null;
  reasoning: string;
  error?: string;
  plannerOutputRaw: string;
  rendererOutputRaw: string;
}

interface CaseResult {
  caseId: string;
  name: string;
  category: string;
  platform: string;
  variantA: VariantResult;
  variantB: VariantResult;
  delta: Record<Dim, number> | null;
  winner: "A" | "B" | "tie" | "both_failed";
}

// ─── Variant Runners (both call Gemini directly — no localPipeline) ───────────

async function runBaseline(
  client: ReturnType<typeof createVertexAIClient>,
  topic: string,
  platform: string,
  audience: string | undefined,
  forbiddenTerms: string[],
  requiredTerms: string[],
  maxLength: number | undefined,
): Promise<{ content: GeneratedContent | null; plannerRaw: string; rendererRaw: string; error?: string }> {
  const topology = MARKETING_TOPOLOGIES["benefit_led"];
  let plannerRaw = "";
  let rendererRaw = "";

  // Step 1 — Planner
  let irGraph: IRGraph;
  try {
    const res = await client.models.generateContent({
      model: MODEL,
      contents: buildBaselinePlannerPrompt(topic, platform, OBJECTIVE, LANGUAGE, audience, forbiddenTerms, requiredTerms),
      config: GENERATION_CONFIG,
    });
    plannerRaw = res.text ?? "";
    const parsed = parsePlannerOutput(plannerRaw);
    irGraph = {
      personaId: "marketing",
      nodes: parsed.nodes,
      angles: [],
      edges: topology.nodes.slice(0, -1).map((n: string, i: number) => ({
        from: n,
        to: topology.nodes[i + 1],
        rel: "leads_to",
      })),
    };
  } catch (err: any) {
    return { content: null, plannerRaw, rendererRaw, error: `Baseline Planner: ${err.message}` };
  }

  // Step 2 — Renderer
  try {
    const res = await client.models.generateContent({
      model: MODEL,
      contents: buildBaselineRendererPrompt(irGraph, platform, LANGUAGE, maxLength, forbiddenTerms, requiredTerms),
      config: GENERATION_CONFIG,
    });
    rendererRaw = res.text ?? "";
    const content = parseRendererOutput(rendererRaw);
    return { content, plannerRaw, rendererRaw };
  } catch (err: any) {
    return { content: null, plannerRaw, rendererRaw, error: `Baseline Renderer: ${err.message}` };
  }
}

async function runCandidate(
  client: ReturnType<typeof createVertexAIClient>,
  normalized: NormalizedPlannerRequest,
): Promise<{ content: GeneratedContent | null; plannerRaw: string; rendererRaw: string; error?: string }> {
  const topology = MARKETING_TOPOLOGIES["benefit_led"];
  let plannerRaw = "";
  let rendererRaw = "";

  // Step 1 — Planner (lib builder)
  let irGraph: IRGraph;
  try {
    const res = await client.models.generateContent({
      model: MODEL,
      contents: buildMarketingPlannerPrompt(normalized),
      config: GENERATION_CONFIG,
    });
    plannerRaw = res.text ?? "";
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
    return { content: null, plannerRaw, rendererRaw, error: `Candidate Planner: ${err.message}` };
  }

  // Step 2 — Renderer (lib builder)
  try {
    const res = await client.models.generateContent({
      model: MODEL,
      contents: buildMarketingRendererPrompt(irGraph, normalized),
      config: GENERATION_CONFIG,
    });
    rendererRaw = res.text ?? "";
    const content = parseRendererOutput(rendererRaw);
    return { content, plannerRaw, rendererRaw };
  } catch (err: any) {
    return { content: null, plannerRaw, rendererRaw, error: `Candidate Renderer: ${err.message}` };
  }
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function runABBenchmark() {
  const args = process.argv.slice(2);
  const casesIdx = args.indexOf("--cases");
  const REQUESTED_CASES = casesIdx >= 0 ? parseInt(args[casesIdx + 1]) : 30;

  const testCases = dataset.slice(0, Math.min(REQUESTED_CASES, dataset.length));
  const executed = testCases.length;

  console.log(`\n🔬 Regression Benchmark — True Baseline vs Candidate`);
  console.log(`   Model:     ${MODEL}  |  Temperature: ${TEMPERATURE}`);
  console.log(`   Framework: ${COPY_FRAMEWORK}  |  Tone: ${TONE}`);
  console.log(`   A: ${VARIANT_A.label}`);
  console.log(`   B: ${VARIANT_B.label}`);
  console.log(`   Cases: ${executed}\n`);
  console.log("─".repeat(76));

  const client = createVertexAIClient();
  const allResults: CaseResult[] = [];

  const aScores: Record<Dim, number[]> = {
    productFidelity: [], persuasion: [], objectiveFit: [],
    platformFit: [], naturalArabic: [], publishReadyScore: [],
  };
  const bScores: Record<Dim, number[]> = {
    productFidelity: [], persuasion: [], objectiveFit: [],
    platformFit: [], naturalArabic: [], publishReadyScore: [],
  };

  let aHallucinations = 0, bHallucinations = 0;
  let aStructuralFailures = 0, bStructuralFailures = 0;
  let aPublishReady = 0, bPublishReady = 0;
  const wins = { A: 0, B: 0, tie: 0, both_failed: 0 };

  for (const [i, tc] of testCases.entries()) {
    const rawPlatform = (tc.input.platform || "x") as string;
    const platform = rawPlatform === "x_twitter" ? "x" : rawPlatform;
    const maxLength = PLATFORM_MAX_LENGTHS[platform];
    const topic = tc.input.rawInput;
    const audience = (tc.input.metadata as any)?.targetAudience as string | undefined;
    const forbiddenTerms: string[] = tc.expectations?.mustNotContain ?? [];
    const requiredTerms: string[] = tc.expectations?.mustContain ?? [];

    process.stdout.write(`[${String(i + 1).padStart(2, "0")}/${executed}] ${tc.name.slice(0, 28).padEnd(30)}`);

    // Normalized request for Candidate lib builders (no useLegacyEngine)
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

    // ── Run A: Baseline
    const resA = await runBaseline(client, topic, platform, audience, forbiddenTerms, requiredTerms, maxLength);
    let evalA: PublishReadinessResult | null = null;
    if (resA.content) {
      try {
        evalA = await evaluatePublishReadiness(resA.content, topic, platform, "marketing", COPY_FRAMEWORK);
      } catch {
        aStructuralFailures++;
      }
    } else {
      aStructuralFailures++;
    }

    // ── Run B: Candidate
    const resB = await runCandidate(client, normalized);
    let evalB: PublishReadinessResult | null = null;
    if (resB.content) {
      try {
        evalB = await evaluatePublishReadiness(resB.content, topic, platform, "marketing", COPY_FRAMEWORK);
      } catch {
        bStructuralFailures++;
      }
    } else {
      bStructuralFailures++;
    }

    // ── Accumulate scores
    if (evalA) {
      for (const d of DIMS) aScores[d].push((evalA as any)[d]);
      if (evalA.hasHallucinations) aHallucinations++;
      if (evalA.publishReadyScore >= 4.0) aPublishReady++;
    }
    if (evalB) {
      for (const d of DIMS) bScores[d].push((evalB as any)[d]);
      if (evalB.hasHallucinations) bHallucinations++;
      if (evalB.publishReadyScore >= 4.0) bPublishReady++;
    }

    // ── Delta & winner
    let delta: CaseResult["delta"] = null;
    let winner: CaseResult["winner"] = "both_failed";
    if (evalA && evalB) {
      delta = {} as Record<Dim, number>;
      for (const d of DIMS) delta[d] = (evalB as any)[d] - (evalA as any)[d];
      const diff = delta.publishReadyScore;
      winner = diff > 0.05 ? "B" : diff < -0.05 ? "A" : "tie";
    } else if (evalA) {
      winner = "A";
    } else if (evalB) {
      winner = "B";
    }
    wins[winner]++;

    // ── Per-case console line
    const aStr = evalA ? evalA.publishReadyScore.toFixed(2) : "FAIL";
    const bStr = evalB ? evalB.publishReadyScore.toFixed(2) : "FAIL";
    const deltaNum = delta?.publishReadyScore;
    const deltaStr = deltaNum !== undefined
      ? (deltaNum >= 0 ? "+" : "") + deltaNum.toFixed(2)
      : "  N/A";
    const winMark = winner === "A" ? "◀A" : winner === "B" ? "B▶" : winner === "tie" ? " =" : " ✗";
    console.log(`A:${aStr}  B:${bStr}  Δ:${deltaStr.padStart(6)}  ${winMark}`);

    if (evalA && evalB && delta) {
      const detail = [
        ["persuasion",      delta.persuasion],
        ["naturalArabic",   delta.naturalArabic],
        ["productFidelity", delta.productFidelity],
        ["halluc",          (evalB.hasHallucinations ? 1 : 0) - (evalA.hasHallucinations ? 1 : 0)],
      ] as [string, number][];
      console.log(`             ${detail.map(([k, v]) => `${k}:${v >= 0 ? "+" : ""}${v.toFixed(1)}`).join("  ")}`);
    }

    allResults.push({
      caseId: tc.id,
      name: tc.name,
      category: tc.category,
      platform,
      variantA: {
        success: !resA.error && resA.content !== null,
        hasHallucinations: evalA?.hasHallucinations ?? false,
        isOverConstrained: evalA?.isOverConstrained ?? false,
        scores: evalA
          ? { productFidelity: evalA.productFidelity, persuasion: evalA.persuasion, objectiveFit: evalA.objectiveFit, platformFit: evalA.platformFit, naturalArabic: evalA.naturalArabic, publishReadyScore: evalA.publishReadyScore }
          : null,
        reasoning: evalA?.reasoning ?? "",
        error: resA.error,
        plannerOutputRaw: resA.plannerRaw,
        rendererOutputRaw: resA.rendererRaw,
      },
      variantB: {
        success: !resB.error && resB.content !== null,
        hasHallucinations: evalB?.hasHallucinations ?? false,
        isOverConstrained: evalB?.isOverConstrained ?? false,
        scores: evalB
          ? { productFidelity: evalB.productFidelity, persuasion: evalB.persuasion, objectiveFit: evalB.objectiveFit, platformFit: evalB.platformFit, naturalArabic: evalB.naturalArabic, publishReadyScore: evalB.publishReadyScore }
          : null,
        reasoning: evalB?.reasoning ?? "",
        error: resB.error,
        plannerOutputRaw: resB.plannerRaw,
        rendererOutputRaw: resB.rendererRaw,
      },
      delta,
      winner,
    });
  }

  // ─── Aggregate Summary ────────────────────────────────────────────────────────

  const pct = (n: number) => ((n / executed) * 100).toFixed(1) + "%";

  console.log("\n" + "═".repeat(76));
  console.log("📊 AGGREGATE RESULTS\n");

  const dimRow = (name: string, a: number, b: number) => {
    const d = b - a;
    const marker = d > 0.05 ? "B▶" : d < -0.05 ? "◀A" : " =";
    console.log(`  ${name.padEnd(26)} A:${a.toFixed(3)}  B:${b.toFixed(3)}  Δ:${((d >= 0 ? "+" : "") + d.toFixed(3)).padStart(7)}  ${marker}`);
  };

  console.log("── Per-Dimension Means ──────────────────────────────────────────────");
  for (const d of DIMS) dimRow(d, mean(aScores[d]), mean(bScores[d]));

  console.log("\n── Per-Dimension Medians ────────────────────────────────────────────");
  for (const d of DIMS) dimRow(d, median(aScores[d]), median(bScores[d]));

  console.log("\n── Tail Performance ─────────────────────────────────────────────────");
  console.log(`  ${"publishReady p10".padEnd(26)} A:${percentile(aScores.publishReadyScore, 10).toFixed(2)}   B:${percentile(bScores.publishReadyScore, 10).toFixed(2)}`);
  console.log(`  ${"publishReady p25".padEnd(26)} A:${percentile(aScores.publishReadyScore, 25).toFixed(2)}   B:${percentile(bScores.publishReadyScore, 25).toFixed(2)}`);

  console.log("\n── Summary Table ────────────────────────────────────────────────────");
  const COL = [28, 12, 12] as const;
  const hr = `  ${"─".repeat(COL[0])}  ${"─".repeat(COL[1])}  ${"─".repeat(COL[2])}`;
  console.log(`  ${"Metric".padEnd(COL[0])}  ${"Baseline A".padEnd(COL[1])}  Candidate B`);
  console.log(hr);
  const tableRows: [string, string, string][] = [
    ["Publish Ready Mean",      mean(aScores.publishReadyScore).toFixed(3),   mean(bScores.publishReadyScore).toFixed(3)],
    ["Publish Ready Median",    median(aScores.publishReadyScore).toFixed(3), median(bScores.publishReadyScore).toFixed(3)],
    ["Publish Ready ≥ 4.0",     pct(aPublishReady),                           pct(bPublishReady)],
    ["Hallucination Rate",      pct(aHallucinations),                         pct(bHallucinations)],
    ["Structural Failure Rate", pct(aStructuralFailures),                     pct(bStructuralFailures)],
    ["Product Fidelity (mean)", mean(aScores.productFidelity).toFixed(3),     mean(bScores.productFidelity).toFixed(3)],
    ["Persuasion (mean)",       mean(aScores.persuasion).toFixed(3),          mean(bScores.persuasion).toFixed(3)],
    ["Objective Fit (mean)",    mean(aScores.objectiveFit).toFixed(3),        mean(bScores.objectiveFit).toFixed(3)],
    ["Platform Fit (mean)",     mean(aScores.platformFit).toFixed(3),         mean(bScores.platformFit).toFixed(3)],
    ["Natural Arabic (mean)",   mean(aScores.naturalArabic).toFixed(3),       mean(bScores.naturalArabic).toFixed(3)],
  ];
  for (const [metric, a, b] of tableRows) {
    console.log(`  ${metric.padEnd(COL[0])}  ${a.padEnd(COL[1])}  ${b}`);
  }

  console.log("\n── Paired Deltas (B − A) ────────────────────────────────────────────");
  const pairedDeltas = allResults
    .map((r) => r.delta?.publishReadyScore)
    .filter((d): d is number => d !== undefined && !isNaN(d));
  
  const medianPairedDelta = median(pairedDeltas);
  const meanPairedDelta = mean(pairedDeltas);
  
  const sortedDeltas = [...pairedDeltas].sort((a, b) => a - b);
  const trimCount = Math.floor(sortedDeltas.length * 0.1);
  const trimmedDeltas = trimCount > 0 ? sortedDeltas.slice(trimCount, -trimCount) : sortedDeltas;
  const trimmedMeanPairedDelta = mean(trimmedDeltas);

  const nonHallucinatingDeltas = allResults
    .filter((r) => !r.variantA.hasHallucinations && !r.variantB.hasHallucinations)
    .map((r) => r.delta?.publishReadyScore)
    .filter((d): d is number => d !== undefined && !isNaN(d));
  const meanDeltaNeitherHallucinates = mean(nonHallucinatingDeltas);

  console.log(`  Mean Paired Δ:                       ${(meanPairedDelta >= 0 ? "+" : "") + meanPairedDelta.toFixed(3)}`);
  console.log(`  Median Paired Δ:                     ${(medianPairedDelta >= 0 ? "+" : "") + medianPairedDelta.toFixed(3)}`);
  console.log(`  Trimmed Mean Paired Δ (10%):         ${(trimmedMeanPairedDelta >= 0 ? "+" : "") + trimmedMeanPairedDelta.toFixed(3)}`);
  console.log(`  Mean Δ (neither hallucinates):       ${(meanDeltaNeitherHallucinates >= 0 ? "+" : "") + meanDeltaNeitherHallucinates.toFixed(3)}`);
  console.log(`  % Cases B > A:                       ${((wins.B / executed) * 100).toFixed(1)}% (${wins.B})`);
  console.log(`  % Cases A > B:                       ${((wins.A / executed) * 100).toFixed(1)}% (${wins.A})`);
  console.log(`  % Cases tied:                        ${((wins.tie / executed) * 100).toFixed(1)}% (${wins.tie})`);
  console.log(`  % Both failed:                       ${pct(wins.both_failed)} (${wins.both_failed})`);

  // ── Gated Success Criterion
  const hallucinationRateA = aHallucinations / executed;
  const hallucinationRateB = bHallucinations / executed;
  const structuralFailRateA = aStructuralFailures / executed;
  const structuralFailRateB = bStructuralFailures / executed;

  const safetyPass = (hallucinationRateB <= hallucinationRateA) && (structuralFailRateB <= structuralFailRateA);
  const qualityPass = meanPairedDelta > 0.20 || medianPairedDelta > 0.00;

  console.log("\n── Gated Success Criterion ──────────────────────────────────────────");
  const passStr = "✅ PASS";
  const failStr = "❌ FAIL";
  console.log(`  Safety Gate:   ${(safetyPass ? passStr : failStr).padEnd(8)} (Hallucinations: ${pct(aHallucinations)} → ${pct(bHallucinations)}, Structural: ${pct(aStructuralFailures)} → ${pct(bStructuralFailures)})`);
  console.log(`  Quality Gate:  ${(qualityPass ? passStr : failStr).padEnd(8)} (Mean Paired Δ: ${(meanPairedDelta >= 0 ? "+" : "") + meanPairedDelta.toFixed(3)}, Median Paired Δ: ${(medianPairedDelta >= 0 ? "+" : "") + medianPairedDelta.toFixed(3)})`);
  console.log(`  Overall:       ${(safetyPass && qualityPass) ? passStr : failStr}`);

  // ─── Save Report ──────────────────────────────────────────────────────────────
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  const isoTimestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const reportDir = path.join(__dirname, "benchmark-reports");
  if (!fs.existsSync(reportDir)) fs.mkdirSync(reportDir, { recursive: true });
  const reportPath = path.join(reportDir, `ab_report_${isoTimestamp}.json`);

  const summary = {
    meta: {
      model: MODEL,
      temperature: TEMPERATURE,
      copyFramework: COPY_FRAMEWORK,
      tone: TONE,
      language: LANGUAGE,
      objective: OBJECTIVE,
      executedAt: new Date().toISOString(),
    },
    variantA: VARIANT_A,
    variantB: VARIANT_B,
    executed,
    wins,
    primaryCriterion: {
      meanPairedDelta,
      medianPairedDelta,
      trimmedMeanPairedDelta,
      meanDeltaNeitherHallucinates,
      safetyPass,
      qualityPass,
      candidateWins: safetyPass && qualityPass,
    },
    rates: {
      publishReadyRate:     { A: aPublishReady / executed,     B: bPublishReady / executed },
      hallucinationRate:    { A: aHallucinations / executed,   B: bHallucinations / executed },
      structuralFailRate:   { A: aStructuralFailures / executed, B: bStructuralFailures / executed },
    },
    dimensions: Object.fromEntries(
      DIMS.map((d) => [d, {
        A: { mean: mean(aScores[d]), median: median(aScores[d]), p10: percentile(aScores[d], 10), p25: percentile(aScores[d], 25) },
        B: { mean: mean(bScores[d]), median: median(bScores[d]), p10: percentile(bScores[d], 10), p25: percentile(bScores[d], 25) },
        delta: { mean: mean(bScores[d]) - mean(aScores[d]), median: median(bScores[d]) - median(aScores[d]) },
      }])
    ),
  };

  fs.writeFileSync(reportPath, JSON.stringify({ summary, results: allResults }, null, 2));
  console.log(`\n📄 Report: ${reportPath}`);
  console.log("═".repeat(76) + "\n");
}

runABBenchmark();
