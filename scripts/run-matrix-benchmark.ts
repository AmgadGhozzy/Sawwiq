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

const LANGUAGE = "ar" as const;
const OBJECTIVE = "sales" as const;
const MODEL = process.env.GEMINI_MODEL ?? aiConfig.model;
const TEMPERATURE = aiConfig.temperature;
const GENERATION_CONFIG = {
  temperature: TEMPERATURE,
  responseMimeType: "application/json",
} as const;

interface VariantConfig {
  label: string;
  copyFramework: CopyFramework;
  tone: MarketingToneId;
}

const CONTROL: VariantConfig = {
  label: "Control (benefit_led / professional)",
  copyFramework: "benefit_led",
  tone: "professional",
};

const PHASE_FRAMEWORK: VariantConfig[] = [
  { label: "pas / professional", copyFramework: "pas", tone: "professional" },
  { label: "feature_benefit / professional", copyFramework: "feature_benefit", tone: "professional" },
];

const PHASE_TONE: VariantConfig[] = [
  { label: "benefit_led / energetic", copyFramework: "benefit_led", tone: "energetic" },
  { label: "benefit_led / friendly", copyFramework: "benefit_led", tone: "friendly" },
  { label: "benefit_led / premium", copyFramework: "benefit_led", tone: "premium" },
];

const DIMS = [
  "productFidelity",
  "persuasion",
  "objectiveFit",
  "platformFit",
  "naturalArabic",
  "publishReadyScore",
] as const;
type Dim = (typeof DIMS)[number];

// ─── Stats ────────────────────────────────────────────────────────────────────
function mean(arr: number[]): number {
  return arr.length === 0 ? 0 : arr.reduce((s, v) => s + v, 0) / arr.length;
}

function median(arr: number[]): number {
  if (arr.length === 0) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

function percentile(arr: number[], p: number): number {
  if (arr.length === 0) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const idx = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, idx)];
}

const pct = (num: number, total: number) => ((num / total) * 100).toFixed(1) + "%";

// ─── Runner ───────────────────────────────────────────────────────────────────
async function runVariant(
  client: ReturnType<typeof createVertexAIClient>,
  topic: string,
  platform: string,
  audience: string | undefined,
  forbiddenTerms: string[],
  requiredTerms: string[],
  variant: VariantConfig
): Promise<{ content: GeneratedContent | null; evalResult: PublishReadinessResult | null; error?: string }> {
  
  const normalized: NormalizedPlannerRequest = {
    topic,
    platform,
    objective: OBJECTIVE,
    language: LANGUAGE,
    audience,
    purpose: "marketing",
    persona: undefined,
    tone: variant.tone,
    copyFramework: variant.copyFramework,
    keyMessage: topic,
    constraints: { forbiddenTerms, requiredTerms },
  };

  const topology = MARKETING_TOPOLOGIES[variant.copyFramework];
  
  let irGraph: IRGraph;
  try {
    const res = await client.models.generateContent({
      model: MODEL,
      contents: buildMarketingPlannerPrompt(normalized),
      config: GENERATION_CONFIG,
    });
    const parsed = parsePlannerOutput(res.text ?? "");
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
    return { content: null, evalResult: null, error: `Planner: ${err.message}` };
  }

  let content: GeneratedContent;
  try {
    const res = await client.models.generateContent({
      model: MODEL,
      contents: buildMarketingRendererPrompt(irGraph, normalized),
      config: GENERATION_CONFIG,
    });
    content = parseRendererOutput(res.text ?? "");
  } catch (err: any) {
    return { content: null, evalResult: null, error: `Renderer: ${err.message}` };
  }

  let evalResult: PublishReadinessResult | null = null;
  try {
    evalResult = await evaluatePublishReadiness(content, topic, platform, "marketing", variant.copyFramework);
  } catch (err: any) {
    return { content, evalResult: null, error: `Judge: ${err.message}` };
  }

  return { content, evalResult };
}

// ─── Main ─────────────────────────────────────────────────────────────────────
async function runMatrixBenchmark() {
  const args = process.argv.slice(2);
  
  const phaseIdx = args.indexOf("--phase");
  const phaseArg = phaseIdx >= 0 ? args[phaseIdx + 1] : "framework";
  
  const casesIdx = args.indexOf("--cases");
  const REQUESTED_CASES = casesIdx >= 0 ? parseInt(args[casesIdx + 1]) : 30;

  let candidatesToRun: VariantConfig[] = [];
  if (phaseArg === "framework") candidatesToRun = PHASE_FRAMEWORK;
  else if (phaseArg === "tone") candidatesToRun = PHASE_TONE;
  else if (phaseArg === "all") candidatesToRun = [...PHASE_FRAMEWORK, ...PHASE_TONE];
  else {
    console.error(`Invalid phase: ${phaseArg}. Use 'framework', 'tone', or 'all'.`);
    process.exit(1);
  }

  const testCases = dataset.slice(0, Math.min(REQUESTED_CASES, dataset.length));
  const executed = testCases.length;

  console.log(`\n🧪 Secondary Matrix Benchmark [Phase: ${phaseArg}]`);
  console.log(`   Model:     ${MODEL}  |  Temperature: ${TEMPERATURE}`);
  console.log(`   Control:   ${CONTROL.label}`);
  console.log(`   Cases:     ${executed}`);
  console.log(`   Candidates to test: ${candidatesToRun.length}\n`);

  const client = createVertexAIClient();
  const allReports: any[] = [];

  for (const candidate of candidatesToRun) {
    console.log("═".repeat(76));
    console.log(`🚀 Testing Candidate: ${candidate.label}  vs  Control`);
    console.log("─".repeat(76));

    const results = [];
    const scoresControl: Record<Dim, number[]> = { productFidelity: [], persuasion: [], objectiveFit: [], platformFit: [], naturalArabic: [], publishReadyScore: [] };
    const scoresCandidate: Record<Dim, number[]> = { productFidelity: [], persuasion: [], objectiveFit: [], platformFit: [], naturalArabic: [], publishReadyScore: [] };
    
    let aHallucinations = 0, bHallucinations = 0;
    let aStructuralFailures = 0, bStructuralFailures = 0;
    let aPublishReady = 0, bPublishReady = 0;
    const wins = { A: 0, B: 0, tie: 0, both_failed: 0 };

    for (const [i, tc] of testCases.entries()) {
      const rawPlatform = (tc.input.platform || "x") as string;
      const platform = rawPlatform === "x_twitter" ? "x" : rawPlatform;
      const topic = tc.input.rawInput;
      const audience = (tc.input.metadata as any)?.targetAudience as string | undefined;
      const forbiddenTerms: string[] = tc.expectations?.mustNotContain ?? [];
      const requiredTerms: string[] = tc.expectations?.mustContain ?? [];

      process.stdout.write(`[${String(i + 1).padStart(2, "0")}/${executed}] ${tc.name.slice(0, 24).padEnd(26)} `);

      // Run Control (A)
      const resA = await runVariant(client, topic, platform, audience, forbiddenTerms, requiredTerms, CONTROL);
      if (resA.evalResult) {
        for (const d of DIMS) scoresControl[d].push((resA.evalResult as any)[d]);
        if (resA.evalResult.hasHallucinations) aHallucinations++;
        if (resA.evalResult.publishReadyScore >= 4.0) aPublishReady++;
      } else {
        aStructuralFailures++;
      }

      // Run Candidate (B)
      const resB = await runVariant(client, topic, platform, audience, forbiddenTerms, requiredTerms, candidate);
      if (resB.evalResult) {
        for (const d of DIMS) scoresCandidate[d].push((resB.evalResult as any)[d]);
        if (resB.evalResult.hasHallucinations) bHallucinations++;
        if (resB.evalResult.publishReadyScore >= 4.0) bPublishReady++;
      } else {
        bStructuralFailures++;
        if (resB.error) process.stdout.write(` (Error: ${resB.error}) `);
      }

      let delta = 0;
      let winner: "A" | "B" | "tie" | "both_failed" = "both_failed";

      if (resA.evalResult && resB.evalResult) {
        delta = resB.evalResult.publishReadyScore - resA.evalResult.publishReadyScore;
        winner = delta > 0.05 ? "B" : delta < -0.05 ? "A" : "tie";
      } else if (resA.evalResult) winner = "A";
      else if (resB.evalResult) winner = "B";
      
      wins[winner]++;

      const aStr = resA.evalResult ? resA.evalResult.publishReadyScore.toFixed(2) : "FAIL";
      const bStr = resB.evalResult ? resB.evalResult.publishReadyScore.toFixed(2) : "FAIL";
      const dStr = resA.evalResult && resB.evalResult ? (delta >= 0 ? "+" : "") + delta.toFixed(2) : " N/A";
      const winMark = winner === "A" ? "◀Ctrl" : winner === "B" ? "Cand▶" : winner === "tie" ? "  =" : "  ✗";
      
      console.log(`C:${aStr}  T:${bStr}  Δ:${dStr.padStart(5)}  ${winMark}`);

      results.push({
        caseId: tc.id,
        control: { success: !!resA.content, hallucinated: resA.evalResult?.hasHallucinations, score: resA.evalResult?.publishReadyScore },
        candidate: { success: !!resB.content, hallucinated: resB.evalResult?.hasHallucinations, score: resB.evalResult?.publishReadyScore },
        delta,
        winner
      });
    }

    // Report for this Candidate
    const pairedDeltas = results.map(r => r.delta).filter(d => d !== undefined && !isNaN(d));
    const meanPairedDelta = mean(pairedDeltas);
    const medianPairedDelta = median(pairedDeltas);
    
    console.log("\n── Candidate Results ────────────────────────────────────────────────");
    
    // Safety
    const hallucinationRateA = aHallucinations / executed;
    const hallucinationRateB = bHallucinations / executed;
    const structuralFailRateA = aStructuralFailures / executed;
    const structuralFailRateB = bStructuralFailures / executed;
    const safetyPass = (hallucinationRateB <= hallucinationRateA) && (structuralFailRateB <= structuralFailRateA);

    console.log(`  Publish Ready ≥ 4.0:   Ctrl: ${pct(aPublishReady, executed)}   Cand: ${pct(bPublishReady, executed)}`);
    console.log(`  Hallucination Rate:    Ctrl: ${pct(aHallucinations, executed)}   Cand: ${pct(bHallucinations, executed)}`);
    console.log(`  Structural Failures:   Ctrl: ${pct(aStructuralFailures, executed)}   Cand: ${pct(bStructuralFailures, executed)}`);
    
    // Quality & Dimensions
    console.log(`\n  Mean Publish Ready:    Ctrl: ${mean(scoresControl.publishReadyScore).toFixed(3)}   Cand: ${mean(scoresCandidate.publishReadyScore).toFixed(3)}`);
    console.log(`  Persuasion:            Ctrl: ${mean(scoresControl.persuasion).toFixed(3)}   Cand: ${mean(scoresCandidate.persuasion).toFixed(3)}`);
    console.log(`  Product Fidelity:      Ctrl: ${mean(scoresControl.productFidelity).toFixed(3)}   Cand: ${mean(scoresCandidate.productFidelity).toFixed(3)}`);

    // Paired
    console.log(`\n  Mean Paired Δ:         ${(meanPairedDelta >= 0 ? "+" : "") + meanPairedDelta.toFixed(3)}`);
    console.log(`  Median Paired Δ:       ${(medianPairedDelta >= 0 ? "+" : "") + medianPairedDelta.toFixed(3)}`);
    console.log(`  Win Rate (Cand > Ctrl): ${pct(wins.B, executed)} (${wins.B} cases)`);
    console.log(`  Loss Rate (Ctrl > Cand):${pct(wins.A, executed)} (${wins.A} cases)`);
    console.log(`  Tie Rate:              ${pct(wins.tie, executed)} (${wins.tie} cases)`);

    // Gated Decisions
    console.log("\n── Decisions ────────────────────────────────────────────────────────");
    const qualityPass = meanPairedDelta > 0.20 || medianPairedDelta > 0.00;
    console.log(`  Safety Gate:           ${safetyPass ? "✅ PASS" : "❌ FAIL"}`);
    console.log(`  Quality Gate:          ${qualityPass ? "✅ PASS" : "❌ FAIL"}`);

    if (Math.abs(meanPairedDelta) < 0.10) {
      console.log(`  ⚠️ Practical Variance Warning: Low practical variance (|Mean Δ| < 0.10).`);
      console.log(`     Insufficient evidence to claim meaningful superiority for this configuration.`);
    }

    allReports.push({
      control: CONTROL,
      candidate,
      metrics: {
        safetyPass, qualityPass, meanPairedDelta, medianPairedDelta,
        wins, hallucinationRateA, hallucinationRateB
      }
    });
  }

  // Save full report
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  const isoTimestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const reportDir = path.join(__dirname, "benchmark-reports");
  if (!fs.existsSync(reportDir)) fs.mkdirSync(reportDir, { recursive: true });
  const reportPath = path.join(reportDir, `matrix_report_${phaseArg}_${isoTimestamp}.json`);
  fs.writeFileSync(reportPath, JSON.stringify({ phase: phaseArg, executed, reports: allReports }, null, 2));
  console.log(`\n📄 Report saved: ${reportPath}`);
}

runMatrixBenchmark();
