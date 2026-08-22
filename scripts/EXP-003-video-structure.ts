// ---------------------------------------------------------------------------
// EXP-003-video-structure.ts — Prompt Experiment: Video Structural Compliance
//
// DESIGN: Paired — each trial runs A → B → C (or shuffled order) on the SAME
// input, then moves to the next trial. This isolates temporal API variance
// and ensures a fair comparison.
//
// PRIMARY METRIC: Initial Structural Pass Rate (before any repair)
//
// Versions:
//   A  → Baseline (current prompt, no video policy)
//   B  → Baseline + Compact Video Policy  (≤ 5% prompt growth target)
//   C  → Baseline + Video Policy + Format Constraints
//
// Usage:
//   VERTEX_AI_API_KEY=... npx tsx scripts/EXP-003-video-structure.ts
//   EXP_003_CASES=5  npx tsx scripts/EXP-003-video-structure.ts        ← smoke
//   EXP_003_CASES=20 npx tsx scripts/EXP-003-video-structure.ts        ← real
//   npx tsx scripts/EXP-003-video-structure.ts --dry-run               ← schema only
//   npx tsx scripts/EXP-003-video-structure.ts --randomize-order       ← rotate version order
// ---------------------------------------------------------------------------

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { config } from "dotenv";
config({ path: ".env.local" });
config({ path: ".env" });

import { ProductionGenerationAdapter } from "../lib/ai/productionAdapter";
import { evaluateVideoCompliance, aggregateVideoResults } from "../lib/evaluation/videoEvaluator";
import type { VideoComplianceResult } from "../lib/evaluation/videoEvaluator";
import { estimatePromptTokens } from "../lib/evaluation/promptBudget";
import { GenerationInput } from "../types/content";
import { PROMPT_VERSION } from "../lib/config";

import * as compilerModule from "../lib/content/prompt/compiler";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

const cliArgs = process.argv.slice(2);
const dryRun = cliArgs.includes("--dry-run");
const randomizeOrder = cliArgs.includes("--randomize-order");

// ---------------------------------------------------------------------------
// Prompt Policies
// ---------------------------------------------------------------------------

/** Version B: Compact video policy — minimal token footprint */
const VIDEO_POLICY_COMPACT = `
## قواعد هيكل الفيديو (Video Structure Policy)
- افتح بمشهد أول مدته ≤ 3 ثوانٍ (Hook قوي وسريع).
- رقّم المشاهد بالتسلسل: [Scene 1 - Xs] ثم [Scene 2 - Xs] وهكذا.
- لكل مشهد: سطر [Visual] وسطر [Audio] إلزاميان.
- لا تكرر أرقام المشاهد.
`.trim();

/** Version C: Compact policy + format constraints */
const VIDEO_POLICY_WITH_FORMAT = `
## قواعد هيكل الفيديو (Video Structure Policy)
- افتح بمشهد أول مدته ≤ 3 ثوانٍ (Hook قوي وسريع).
- رقّم المشاهد بالتسلسل: [Scene 1 - Xs] ثم [Scene 2 - Xs] وهكذا.
- لكل مشهد: سطر [Visual] وسطر [Audio] إلزاميان.
- لا تكرر أرقام المشاهد.
- اختم بمشهد CTA واضح فيه دعوة للعمل صريحة.
- المجموع الكلي للمدة: حسب المطلوب في الطلب.
- لا تضف حقولاً خارج البنية المحددة.
`.trim();

// ---------------------------------------------------------------------------
// Fixed generation input — SAME for all trials and all versions
// ---------------------------------------------------------------------------

const VIDEO_GENERATION_INPUT: GenerationInput = {
  platform: "tiktok",
  contentType: "short_video_script",
  arabicStyle: "saudi_marketing",
  rawInput:
    "منتج: سماعات لاسلكية فاخرة طراز S9 Pro\n" +
    "المميزات: صوت نقي، عزل للضوضاء، بطارية 30 ساعة، مقاومة للماء\n" +
    "السعر: 299 ريال\n" +
    "العرض: خصم 15% لأول 100 مشتري\n" +
    "الفئة المستهدفة: شباب 18-35 يهتمون بالموسيقى والتكنولوجيا\n" +
    "عدد المشاهد المطلوب: 4 مشاهد\n" +
    "المدة الإجمالية: 20 ثانية",
};

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Version = "A" | "B" | "C";

interface TrialVersionResult {
  version: Version;
  trialId: string;
  trialIndex: number;

  promptVersion: string;
  promptEstimatedTokens: number;

  // Raw output
  generatedBody?: string;
  generationError?: string;
  latencyMs: number;

  // Compliance
  parseable: boolean;
  initialValid: boolean | null;
  repaired: boolean;
  finalValid: boolean | null;
  violationCodesBeforeRepair: string[];
  violationCodesAfterRepair: string[];
  violationCountBeforeRepair: number;
}

interface TrialResult {
  trialId: string;
  trialIndex: number;
  versionOrder: Version[];
  results: Record<Version, TrialVersionResult>;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isRetryableError(error: unknown): boolean {
  const msg = error instanceof Error ? error.message : String(error);
  return /RESOURCE_EXHAUSTED|\b429\b|rate.?limit|fetch failed/i.test(msg);
}

/**
 * Rotate array by offset — used to vary version order per trial.
 * Trial 0: A B C, Trial 1: B C A, Trial 2: C A B, Trial 3: A B C ...
 */
function rotateVersionOrder(versions: Version[], trialIndex: number): Version[] {
  const offset = randomizeOrder ? trialIndex % versions.length : 0;
  return [...versions.slice(offset), ...versions.slice(0, offset)];
}

// ---------------------------------------------------------------------------
// Measure prompt sizes (once, before any generation)
// ---------------------------------------------------------------------------

function measurePromptSizes(): Record<Version, number> {
  const sizes: Partial<Record<Version, number>> = {};
  const basePrompt = compilerModule.compilePrompt({} as any);

  sizes["A"] = estimatePromptTokens(basePrompt.length);
  sizes["B"] = estimatePromptTokens((basePrompt + "\n\n" + VIDEO_POLICY_COMPACT).length);
  sizes["C"] = estimatePromptTokens((basePrompt + "\n\n" + VIDEO_POLICY_WITH_FORMAT).length);

  return sizes as Record<Version, number>;
}

// ---------------------------------------------------------------------------
// Apply prompt policy for a version
// ---------------------------------------------------------------------------

function applyVersionPolicy(version: Version): () => void {
  const original = compilerModule.compilePrompt;

  // @ts-ignore — experiment-time mock
  compilerModule.compilePrompt = (cfg: any) => {
    const base = original(cfg);
    if (version === "A") return base;
    if (version === "B") return base + "\n\n" + VIDEO_POLICY_COMPACT;
    if (version === "C") return base + "\n\n" + VIDEO_POLICY_WITH_FORMAT;
    return base;
  };

  // Returns restore function
  return () => {
    // @ts-ignore
    compilerModule.compilePrompt = original;
  };
}

// ---------------------------------------------------------------------------
// Generate one version of one trial
// ---------------------------------------------------------------------------

async function generateForVersion(
  version: Version,
  provider: ProductionGenerationAdapter,
  trialId: string,
  trialIndex: number,
  promptTokens: number
): Promise<TrialVersionResult> {
  const restore = applyVersionPolicy(version);
  const startTime = Date.now();

  let generatedBody: string | undefined;
  let generationError: string | undefined;
  let compliance: VideoComplianceResult | null = null;

  if (!dryRun) {
    let retries = 0;
    while (retries <= 2) {
      try {
        const genResult = await provider.generateContent(VIDEO_GENERATION_INPUT);
        generatedBody = genResult.content.body;
        compliance = evaluateVideoCompliance(generatedBody);
        break;
      } catch (err: unknown) {
        if (isRetryableError(err) && retries < 2) {
          retries++;
          const delay = 3000 * 2 ** (retries - 1);
          process.stdout.write(` ↻r${retries}`);
          await sleep(delay);
        } else {
          generationError = err instanceof Error ? err.message : String(err);
          break;
        }
      }
    }
  }

  restore();
  const latencyMs = Date.now() - startTime;

  if (!compliance) {
    return {
      version, trialId, trialIndex,
      promptVersion: PROMPT_VERSION,
      promptEstimatedTokens: promptTokens,
      generatedBody,
      generationError,
      latencyMs,
      parseable: false,
      initialValid: null,
      repaired: false,
      finalValid: null,
      violationCodesBeforeRepair: generationError ? ["GENERATION_ERROR"] : ["UNPARSEABLE_SCRIPT"],
      violationCodesAfterRepair: [],
      violationCountBeforeRepair: 1,
    };
  }

  return {
    version, trialId, trialIndex,
    promptVersion: PROMPT_VERSION,
    promptEstimatedTokens: promptTokens,
    generatedBody,
    latencyMs,
    parseable: compliance.parseable,
    initialValid: compliance.initialValid,
    repaired: compliance.repaired,
    finalValid: compliance.finalValid,
    violationCodesBeforeRepair: compliance.initialViolations.map((v) => v.code),
    violationCodesAfterRepair: compliance.finalViolations.map((v) => v.code),
    violationCountBeforeRepair: compliance.initialViolations.length,
  };
}

// ---------------------------------------------------------------------------
// Aggregate per-version
// ---------------------------------------------------------------------------

interface VersionSummary {
  version: Version;
  total: number;
  generationErrors: number;

  parseSuccessRate: number;
  initialPassRate: number;
  repairRate: number;
  finalPassRate: number;
  hardFailureRate: number;
  avgViolationsBeforeRepair: number;

  promptEstimatedTokens: number;
  promptDeltaVsA: number;
  qualityGainPerPromptDelta: number;

  violationCodeDistribution: Record<string, number>;
}

function summarize(
  version: Version,
  vResults: TrialVersionResult[],
  promptTokens: number,
  baselineTokens: number,
  baselineInitialPassRate: number
): VersionSummary {
  const success = vResults.filter((r) => !r.generationError);
  const total = success.length;
  const pct = (n: number, d: number) => d === 0 ? 0 : Math.round((n / d) * 1000) / 10;

  const parseable = success.filter((r) => r.parseable).length;
  const initValid = success.filter((r) => r.initialValid === true).length;
  const repaired = success.filter((r) => r.repaired).length;
  const finalValid = success.filter((r) => r.finalValid === true).length;
  const hardFail = success.filter((r) => r.parseable && r.finalValid === false).length;

  const sumViolations = success.reduce((s, r) => s + r.violationCountBeforeRepair, 0);
  const initialInvalidCount = success.filter((r) => r.initialValid === false).length;
  const avgViolations = initialInvalidCount > 0
    ? Math.round((sumViolations / initialInvalidCount) * 100) / 100
    : 0;

  const violationCodeDistribution: Record<string, number> = {};
  for (const r of success) {
    for (const code of r.violationCodesBeforeRepair) {
      violationCodeDistribution[code] = (violationCodeDistribution[code] ?? 0) + 1;
    }
  }

  const initialPassRate = pct(initValid, total);
  const promptDeltaVsA = baselineTokens > 0
    ? Math.round(((promptTokens - baselineTokens) / baselineTokens) * 1000) / 10
    : 0;
  const initialPassDelta = initialPassRate - baselineInitialPassRate;
  const qualityGainPerPromptDelta =
    promptDeltaVsA > 0 ? Math.round((initialPassDelta / promptDeltaVsA) * 100) / 100 : 0;

  return {
    version,
    total: vResults.length,
    generationErrors: vResults.length - total,
    parseSuccessRate: pct(parseable, total),
    initialPassRate,
    repairRate: pct(repaired, parseable),
    finalPassRate: pct(finalValid, total),
    hardFailureRate: pct(hardFail, total),
    avgViolationsBeforeRepair: avgViolations,
    promptEstimatedTokens: promptTokens,
    promptDeltaVsA,
    qualityGainPerPromptDelta,
    violationCodeDistribution,
  };
}

// ---------------------------------------------------------------------------
// Print per-version detailed card
// ---------------------------------------------------------------------------

function printVersionCard(s: VersionSummary) {
  const L = (label: string, value: string | number) =>
    console.log(`  ${label.padEnd(30)} ${value}`);

  console.log(`\nVersion ${s.version}`);
  console.log("  " + "─".repeat(44));
  L("Parse Success Rate",      `${s.parseSuccessRate}%`);
  L("⭐ Initial Pass Rate",    `${s.initialPassRate}%`);
  L("Repair Rate",             `${s.repairRate}%`);
  L("Final Pass Rate",         `${s.finalPassRate}%`);
  L("🛡️  Hard Failure Rate",  `${s.hardFailureRate}%`);
  L("Avg Violations (init)",   `${s.avgViolationsBeforeRepair}`);
  L("Prompt Tokens (est.)",    `${s.promptEstimatedTokens}`);
  L("Prompt Delta vs A",       `${s.promptDeltaVsA > 0 ? "+" : ""}${s.promptDeltaVsA}%`);
  if (s.version !== "A") {
    L("Quality Gain / Prompt Δ", `${s.qualityGainPerPromptDelta}`);
  }
  L("Generation Errors",       `${s.generationErrors}`);

  if (Object.keys(s.violationCodeDistribution).length > 0) {
    console.log(`\n  Violation Codes (before repair):`);
    const sorted = Object.entries(s.violationCodeDistribution).sort(([, a], [, b]) => b - a);
    for (const [code, count] of sorted) {
      console.log(`    ${code.padEnd(28)} ${count}`);
    }
  }
}

// ---------------------------------------------------------------------------
// Print delta comparison
// ---------------------------------------------------------------------------

function printDeltas(summaries: VersionSummary[]) {
  const a = summaries.find((s) => s.version === "A")!;
  const versions = summaries.filter((s) => s.version !== "A");

  console.log("\n" + "═".repeat(60));
  console.log("📈  Δ vs Version A (Primary Comparison)\n");
  console.log(
    `  ${"Metric".padEnd(28)}` +
    versions.map((s) => `  Ver ${s.version}`.padStart(9)).join("")
  );
  console.log("  " + "─".repeat(56));

  const deltaRow = (label: string, fn: (s: VersionSummary) => number, unit = "%") => {
    const row = versions.map((s) => {
      const d = fn(s) - fn(a);
      const sign = d > 0 ? "+" : "";
      return `${sign}${d.toFixed(1)}${unit}`.padStart(9);
    }).join("  ");
    console.log(`  ${label.padEnd(28)}  ${row}`);
  };

  deltaRow("⭐ Δ Initial Pass Rate",  (s) => s.initialPassRate);
  deltaRow("Δ Repair Rate",           (s) => s.repairRate);
  deltaRow("🛡️ Δ Hard Failure Rate", (s) => s.hardFailureRate);
  deltaRow("Δ Final Pass Rate",       (s) => s.finalPassRate);
  deltaRow("Δ Prompt Tokens",         (s) => s.promptDeltaVsA, "%");
}

// ---------------------------------------------------------------------------
// Print acceptance gates
// ---------------------------------------------------------------------------

function printAcceptanceGates(summaries: VersionSummary[]) {
  const a = summaries.find((s) => s.version === "A")!;
  const nonA = summaries.filter((s) => s.version !== "A");
  const best = summaries.reduce((p, c) => c.initialPassRate > p.initialPassRate ? c : p);

  const gates = [
    {
      id: "G1", name: "Hard Failure Rate = 0 (all)",
      passed: summaries.every((s) => s.hardFailureRate === 0),
    },
    {
      id: "G2", name: "Final Pass Rate ≥ 98% (any)",
      passed: summaries.some((s) => s.finalPassRate >= 98),
    },
    {
      id: "G3", name: "Initial Pass Rate improved (B or C > A)",
      passed: nonA.some((s) => s.initialPassRate > a.initialPassRate),
    },
    {
      id: "G4", name: "Repair Rate decreased (B or C < A)",
      passed: nonA.some((s) => s.repairRate < a.repairRate),
    },
    {
      id: "G5", name: `Prompt Growth ≤ 5% (best: Ver ${best.version})`,
      passed: best.promptDeltaVsA <= 5,
    },
  ];

  console.log("\n" + "═".repeat(60));
  console.log("🚦  Acceptance Gates\n");

  let allPassed = true;
  for (const g of gates) {
    console.log(`  ${g.passed ? "✅" : "❌"}  [${g.id}] ${g.name}`);
    if (!g.passed) allPassed = false;
  }

  console.log(`\n  Recommended version: ${best.version}  (Initial Pass Rate: ${best.initialPassRate}%)`);
  console.log(`  Production Readiness: ${allPassed ? "PASS ✅" : "FAIL ❌"}`);
  console.log("\n  ⚠️  No prompt will be merged without manual violation analysis.");
  console.log("═".repeat(60) + "\n");
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function runExp003() {
  const caseCount = parseInt(process.env.EXP_003_CASES ?? "5", 10);
  const isSmoke = caseCount <= 5;
  const VERSIONS: Version[] = ["A", "B", "C"];

  console.log("\n" + "═".repeat(60));
  console.log("🧪  EXP-003: Video Structure Prompt Experiment");
  console.log("═".repeat(60));
  console.log(`Mode:            ${isSmoke ? "🔥 Smoke Test" : "📊 Benchmark"}`);
  console.log(`Trials:          ${caseCount} (each runs A, B, C = ${caseCount * 3} total calls)`);
  console.log(`Design:          Paired — same input per trial across A/B/C`);
  console.log(`Version order:   ${randomizeOrder ? "Rotated per trial" : "Fixed A → B → C"}`);
  console.log(`Dry-run:         ${dryRun}`);
  console.log("═".repeat(60) + "\n");

  if (!process.env.VERTEX_AI_API_KEY && !dryRun) {
    console.error("❌ VERTEX_AI_API_KEY is not set.");
    process.exit(1);
  }

  // Measure prompt sizes once
  const promptTokens = measurePromptSizes();
  console.log("📏  Prompt sizes (estimated tokens):");
  for (const v of VERSIONS) {
    const delta = v === "A" ? "" : `  (+${promptTokens[v] - promptTokens["A"]} vs A)`;
    console.log(`    Version ${v}: ${promptTokens[v]}${delta}`);
  }
  console.log();

  const provider = new ProductionGenerationAdapter();
  const allTrials: TrialResult[] = [];
  const versionResults: Record<Version, TrialVersionResult[]> = { A: [], B: [], C: [] };

  // ---------------------------------------------------------------------------
  // Paired loop: for each trial, run all versions before moving to the next
  // ---------------------------------------------------------------------------

  for (let t = 0; t < caseCount; t++) {
    const trialId = `trial_${String(t + 1).padStart(2, "0")}`;
    const versionOrder = rotateVersionOrder(VERSIONS, t);

    console.log(`\n${"─".repeat(60)}`);
    console.log(`  Trial ${t + 1}/${caseCount}  [${versionOrder.join(" → ")}]`);
    console.log(`${"─".repeat(60)}`);

    const trialVersionResults: Record<Version, TrialVersionResult> = {} as any;

    for (const version of versionOrder) {
      process.stdout.write(`  Ver ${version}: `);

      if (dryRun) {
        console.log("⏭️  (dry-run)");
        trialVersionResults[version] = {
          version, trialId, trialIndex: t,
          promptVersion: PROMPT_VERSION,
          promptEstimatedTokens: promptTokens[version],
          latencyMs: 0,
          parseable: false, initialValid: null,
          repaired: false, finalValid: null,
          violationCodesBeforeRepair: [],
          violationCodesAfterRepair: [],
          violationCountBeforeRepair: 0,
        };
        continue;
      }

      const result = await generateForVersion(version, provider, trialId, t, promptTokens[version]);
      trialVersionResults[version] = result;
      versionResults[version].push(result);

      const icon =
        result.generationError ? "❌ GEN_ERR" :
        !result.parseable ? "⚪ UNPARSE" :
        result.initialValid ? "✅ PASS" :
        result.finalValid ? "🔧 REPAIR" : "❌ HARD_FAIL";

      const codes = result.violationCodesBeforeRepair.length > 0
        ? `  [${result.violationCodesBeforeRepair.join(", ")}]`
        : "";
      console.log(`${icon}${codes}  (${result.latencyMs}ms)`);

      // Rate limit buffer between versions within a trial
      if (!dryRun) await sleep(3000);
    }

    allTrials.push({ trialId, trialIndex: t, versionOrder, results: trialVersionResults });

    // Buffer between trials
    if (t < caseCount - 1 && !dryRun) await sleep(2000);
  }

  if (dryRun) {
    console.log("\n⏭️  Dry-run complete — no generations were made.\n");
    return;
  }

  // ---------------------------------------------------------------------------
  // Compute summaries (A first so deltas are correct)
  // ---------------------------------------------------------------------------

  const summaryA = summarize("A", versionResults["A"], promptTokens["A"], promptTokens["A"], 0);
  const summaryB = summarize("B", versionResults["B"], promptTokens["B"], promptTokens["A"], summaryA.initialPassRate);
  const summaryC = summarize("C", versionResults["C"], promptTokens["C"], promptTokens["A"], summaryA.initialPassRate);
  const summaries = [summaryA, summaryB, summaryC];

  // ---------------------------------------------------------------------------
  // Print results
  // ---------------------------------------------------------------------------

  console.log("\n" + "═".repeat(60));
  console.log(isSmoke ? "📋  Smoke Test Results" : "📊  EXP-003 Results");

  for (const s of summaries) {
    printVersionCard(s);
  }

  printDeltas(summaries);
  printAcceptanceGates(summaries);

  if (isSmoke) {
    console.log("ℹ️  Smoke test complete. Results are indicative only (N=5).");
    console.log("   Run EXP_003_CASES=20 for meaningful benchmark data.\n");
  }

  // ---------------------------------------------------------------------------
  // Save report
  // ---------------------------------------------------------------------------

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const reportsDir = path.join(__dirname, "benchmark-reports");
  if (!fs.existsSync(reportsDir)) fs.mkdirSync(reportsDir, { recursive: true });

  const report = {
    experimentId: "EXP-003",
    mode: isSmoke ? "smoke" : "benchmark",
    timestamp: new Date().toISOString(),
    promptVersion: PROMPT_VERSION,
    design: "paired",
    versionOrderRotation: randomizeOrder,
    caseCount,
    promptSizes: promptTokens,
    summaries,
    trials: allTrials,
    rawResults: versionResults,
  };

  const tag = isSmoke ? "smoke" : "benchmark";
  const reportPath = path.join(reportsDir, `exp003_${tag}_${timestamp}.json`);
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  console.log(`📄 Report: scripts/benchmark-reports/exp003_${tag}_${timestamp}.json\n`);
}

runExp003().catch((err) => {
  console.error("❌ EXP-003 failed:", err);
  process.exit(1);
});
