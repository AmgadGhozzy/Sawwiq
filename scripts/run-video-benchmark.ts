// ---------------------------------------------------------------------------
// run-video-benchmark.ts — Deterministic Video Compliance Benchmark
//
// Runs with NO LLM API calls. Measures the validator + repair pipeline
// against dataset-video.json and outputs a structured report.
//
// Usage:
//   npx tsx scripts/run-video-benchmark.ts
//   npx tsx scripts/run-video-benchmark.ts --verbose
//   npx tsx scripts/run-video-benchmark.ts --group C_timing
// ---------------------------------------------------------------------------

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

import dataset from "./datasets/dataset-video.json";
import { evaluateVideoCompliance, aggregateVideoResults } from "../lib/evaluation/videoEvaluator";
import type { VideoComplianceResult } from "../lib/evaluation/videoEvaluator";
import type { VideoScriptValidationOptions } from "../lib/evaluation/videoValidator";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ---------------------------------------------------------------------------
// CLI Flags
// ---------------------------------------------------------------------------

const cliArgs = process.argv.slice(2);
const verbose = cliArgs.includes("--verbose");
const groupFilter = (() => {
  const idx = cliArgs.indexOf("--group");
  return idx !== -1 ? cliArgs[idx + 1] : null;
})();

// ---------------------------------------------------------------------------
// Dataset type
// ---------------------------------------------------------------------------

interface VideoDatasetCase {
  id: string;
  group: string;
  name: string;
  category: "valid" | "invalid" | "edge" | "ambiguous";
  description: string;
  opts: VideoScriptValidationOptions;
  body: string;
}

// ---------------------------------------------------------------------------
// Per-case Result
// ---------------------------------------------------------------------------

interface VideoBenchmarkCaseResult {
  id: string;
  group: string;
  name: string;
  category: string;

  // -- Outcome --
  parseable: boolean;
  initialValid: boolean | null;
  repaired: boolean;
  finalValid: boolean | null;

  // -- Classification --
  /** PASS = finalValid, FAIL = hard failure (not finalValid), REPAIR = needed repair but finalValid. */
  outcome: "PASS" | "REPAIR" | "FAIL" | "UNPARSEABLE";

  violationsBeforeRepair: string[];
  violationsAfterRepair: string[];
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function runVideoBenchmark() {
  const cases = dataset as VideoDatasetCase[];
  const filteredCases = groupFilter
    ? cases.filter((c) => c.group === groupFilter)
    : cases;

  console.log("\n" + "═".repeat(70));
  console.log("🎬  Video Compliance Benchmark (Deterministic)");
  console.log("═".repeat(70));
  console.log(`Dataset:    ${cases.length} total cases`);
  console.log(`Filter:     ${groupFilter ?? "(none)"}`);
  console.log(`Running:    ${filteredCases.length} cases`);
  console.log("═".repeat(70) + "\n");

  const caseResults: VideoBenchmarkCaseResult[] = [];
  const rawCompliance: VideoComplianceResult[] = [];

  for (const [i, tc] of filteredCases.entries()) {
    const padded = String(i + 1).padStart(2, "0");
    process.stdout.write(
      `[${padded}/${filteredCases.length}] [${tc.group.padEnd(14)}] ${tc.name.slice(0, 40).padEnd(42)} `
    );

    const compliance = evaluateVideoCompliance(tc.body, tc.opts);
    rawCompliance.push(compliance);

    let outcome: VideoBenchmarkCaseResult["outcome"];
    if (!compliance.parseable) {
      outcome = "UNPARSEABLE";
    } else if (compliance.initialValid) {
      outcome = "PASS";
    } else if (compliance.finalValid) {
      outcome = "REPAIR";
    } else {
      outcome = "FAIL";
    }

    const marker =
      outcome === "PASS" ? "✅" :
      outcome === "REPAIR" ? "🔧" :
      outcome === "UNPARSEABLE" ? "⚪" : "❌";

    console.log(`${marker} ${outcome}`);

    if (verbose) {
      if (!compliance.parseable) {
        console.log(`      ↳ Unparseable: no scene headers found`);
      } else {
        if (compliance.initialViolations.length > 0) {
          console.log(`      ↳ Initial violations: ${compliance.initialViolations.map((v) => v.code).join(", ")}`);
        }
        if (compliance.repaired) {
          console.log(`      ↳ Repaired: ${compliance.finalValid ? "success" : "FAILED"}`);
        }
        if (compliance.finalViolations.length > 0) {
          console.log(`      ↳ Remaining violations: ${compliance.finalViolations.map((v) => v.code).join(", ")}`);
        }
      }
    }

    caseResults.push({
      id: tc.id,
      group: tc.group,
      name: tc.name,
      category: tc.category,
      parseable: compliance.parseable,
      initialValid: compliance.initialValid,
      repaired: compliance.repaired,
      finalValid: compliance.finalValid,
      outcome,
      violationsBeforeRepair: compliance.initialViolations.map((v) => v.code),
      violationsAfterRepair: compliance.finalViolations.map((v) => v.code),
    });
  }

  // ---------------------------------------------------------------------------
  // Aggregate
  // ---------------------------------------------------------------------------

  const agg = aggregateVideoResults(rawCompliance);

  console.log("\n" + "═".repeat(70));
  console.log("📊  Aggregate Results\n");

  console.log("  Parse Layer");
  console.log(`    Parse Success Rate:      ${agg.parseSuccessRate}%  (${agg.parseableCount}/${agg.total})`);

  console.log("\n  ⭐ Primary Metric");
  console.log(`    Initial Pass Rate:       ${agg.initialPassRate}%  (${agg.initialValidCount}/${agg.total})`);

  console.log("\n  Repair Layer");
  console.log(`    Repair Rate:             ${agg.repairRate}%  (${agg.repairedCount}/${agg.parseableCount} parseable)`);

  console.log("\n  Final Layer");
  console.log(`    Final Pass Rate:         ${agg.finalPassRate}%  (${agg.finalValidCount}/${agg.total})`);

  console.log("\n  🛡️  Safety");
  console.log(`    Hard Failure Rate:       ${agg.hardFailureRate}%  (${agg.hardFailureCount}/${agg.total})`);

  if (Object.keys(agg.violationCodeDistribution).length > 0) {
    console.log("\n  Violation Distribution (before repair):");
    const sorted = Object.entries(agg.violationCodeDistribution).sort(([, a], [, b]) => b - a);
    for (const [code, count] of sorted) {
      console.log(`    ${code.padEnd(28)} ${count}`);
    }
  }

  if (agg.avgViolationsBeforeRepair > 0) {
    console.log(`\n  Avg violations/invalid case:  ${agg.avgViolationsBeforeRepair}`);
  }

  // ---------------------------------------------------------------------------
  // Group Breakdown
  // ---------------------------------------------------------------------------

  console.log("\n  By Group:");
  const groups = [...new Set(caseResults.map((r) => r.group))];
  for (const group of groups) {
    const groupResults = caseResults.filter((r) => r.group === group);
    const groupRaw = groupResults.map((r, idx) => rawCompliance[caseResults.indexOf(r)] ?? rawCompliance[idx]);

    // Recompute aggregate for this group
    const groupCompliance = groupResults.map((r) => ({
      parseable: r.parseable,
      initialValid: r.initialValid,
      repaired: r.repaired,
      finalValid: r.finalValid,
      initialViolations: rawCompliance[caseResults.findIndex((x) => x.id === r.id)]?.initialViolations ?? [],
      finalViolations: rawCompliance[caseResults.findIndex((x) => x.id === r.id)]?.finalViolations ?? [],
      rawBody: "",
      repairedBody: null,
      metrics: rawCompliance[caseResults.findIndex((x) => x.id === r.id)]?.metrics ?? {} as any,
    }));

    const gAgg = aggregateVideoResults(groupCompliance as any);
    console.log(
      `    ${group.padEnd(20)} Init: ${String(gAgg.initialPassRate).padStart(4)}%  Final: ${String(gAgg.finalPassRate).padStart(4)}%  Hard: ${gAgg.hardFailureCount}`
    );
  }

  // ---------------------------------------------------------------------------
  // Acceptance Gates
  // ---------------------------------------------------------------------------

  console.log("\n" + "═".repeat(70));
  console.log("🚦  Acceptance Gates\n");

  const gates = [
    { name: "Hard Failure Rate = 0",     passed: agg.hardFailureCount === 0 },
    { name: "Final Pass Rate ≥ 98%",     passed: agg.finalPassRate >= 98 },
    { name: "Parse Success Rate ≥ 95%",  passed: agg.parseSuccessRate >= 95 },
  ];

  let allGatesPassed = true;
  for (const gate of gates) {
    const icon = gate.passed ? "✅" : "❌";
    console.log(`  ${icon}  ${gate.name}`);
    if (!gate.passed) allGatesPassed = false;
  }

  const readiness = allGatesPassed ? "PASS ✅" : "FAIL ❌";
  console.log(`\n  Production Readiness: ${readiness}`);
  console.log("═".repeat(70) + "\n");

  // ---------------------------------------------------------------------------
  // Save Report
  // ---------------------------------------------------------------------------

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const reportsDir = path.join(__dirname, "benchmark-reports");
  if (!fs.existsSync(reportsDir)) fs.mkdirSync(reportsDir, { recursive: true });

  const report = {
    timestamp: new Date().toISOString(),
    datasetSize: filteredCases.length,
    groupFilter: groupFilter ?? null,
    aggregate: agg,
    gates: gates.map((g) => ({ name: g.name, passed: g.passed })),
    productionReadiness: allGatesPassed,
    cases: caseResults,
  };

  const reportPath = path.join(reportsDir, `video-report_${timestamp}.json`);
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  console.log(`📄 Report saved: scripts/benchmark-reports/video-report_${timestamp}.json\n`);
}

runVideoBenchmark().catch((err) => {
  console.error("❌ Benchmark failed:", err);
  process.exit(1);
});
