// ---------------------------------------------------------------------------
// Automated Benchmark & Evaluation Suite Runner
//
// Usage:
//   npx tsx scripts/run-benchmark.ts              (Deterministic only)
//   npx tsx scripts/run-benchmark.ts --semantic   (Runs LLM-as-judge)
//   npx tsx scripts/run-benchmark.ts --save-output (Saves generated text)
// ---------------------------------------------------------------------------

import fs from "fs";
import path from "path";
import { config } from "dotenv";
config({ path: ".env.local" });
config({ path: ".env" });

import dataset from "../lib/evaluation/dataset.json";
import { aiConfig, PROMPT_VERSION, DATASET_VERSION } from "../lib/config";
import type { EvaluationTestCase, BenchmarkReport, TestCaseResult } from "../lib/evaluation/types";
import { GeminiProvider } from "../lib/ai/gemini";
import { evaluateDeterministic, evaluateSemantic, computeCombinedScore } from "../lib/evaluation/evaluator";

const runSemantic = process.argv.includes("--semantic");
const saveOutput = process.argv.includes("--save-output");

async function runFullBenchmark() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error("❌ GEMINI_API_KEY is not set.");
    process.exit(1);
  }

  const model = process.env.GEMINI_MODEL ?? aiConfig.model;
  
  console.log(`\n🧪 Running Benchmark`);
  console.log(`Model:         ${model}`);
  console.log(`Prompt Ver:    ${PROMPT_VERSION}`);
  console.log(`Dataset Ver:   ${DATASET_VERSION}`);
  console.log(`Test Cases:    ${dataset.length}`);
  console.log(`Semantic Eval: ${runSemantic ? "Enabled" : "Disabled"}`);
  console.log(`Save Output:   ${saveOutput ? "Enabled" : "Disabled"}\n`);

  const provider = new GeminiProvider();
  const testCases = dataset as EvaluationTestCase[];

  const results: TestCaseResult[] = [];
  let passedTotal = 0;
  let totalSemScore = 0;

  for (const [index, tc] of testCases.entries()) {
    process.stdout.write(`⏳ [${String(index + 1).padStart(2, "0")}/${testCases.length}] [${tc.category.padEnd(16)}] ${tc.name.slice(0, 25).padEnd(27)} ... `);

    try {
      const startTime = Date.now();
      
      let generatedContent;
      try {
        const inputPayload = { ...tc.input, platform: "tiktok" } as import("../types/content").GenerationInput;
        const generationResult = await provider.generateContent(inputPayload);
        generatedContent = generationResult.content;
      } catch (err: any) {
        console.log(`❌ FAIL: ${err.message}`);
        results.push({
          testCaseId: tc.id,
          testCaseName: tc.name,
          category: tc.category,
          deterministic: { checks: [], score: 0, passed: false, details: [err.message] },
          claimViolations: [err.message],
          combinedScore: 0,
          latencyMs: Date.now() - startTime
        });
        continue;
      }

      const latencyMs = Date.now() - startTime;

      const detScore = evaluateDeterministic(generatedContent, tc.expectations);

      let semScore = undefined;
      if (runSemantic && detScore.passed) {
        semScore = await evaluateSemantic(
          generatedContent,
          tc.input.rawInput,
          tc.input.contentType,
          tc.input.arabicStyle,
          tc.criteria
        ) || undefined;
      }

      const combinedScore = computeCombinedScore(detScore, semScore);

      if (semScore) totalSemScore += semScore.overall;
      if (detScore.passed) passedTotal++;

      results.push({
        testCaseId: tc.id,
        testCaseName: tc.name,
        category: tc.category,
        deterministic: detScore,
        semantic: semScore,
        claimViolations: [],
        combinedScore,
        latencyMs,
        output: saveOutput ? generatedContent : undefined
      });

      if (detScore.passed) {
        console.log(`✅ PASS (Det: ${detScore.score}%${semScore ? `, Sem: ${semScore.overall}%` : ""})`);
      } else {
        console.log(`❌ FAIL (Det: ${detScore.score}%) -> ${detScore.details[0]}`);
      }

    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      console.log(`❌ ERROR: ${message}`);
    }
  }

  // --- Compile Failure Taxonomy ---
  const failureReasons = {
    mustContain: 0,
    mustNotContain: 0,
    hashtags: 0,
    claimViolation: 0,
    malformedOutput: 0
  };

  const regressions: string[] = [];

  for (const r of results) {
    if (!r.deterministic.passed || r.claimViolations.length > 0) {
      let reasonRecorded = false;
      if (r.claimViolations.length > 0) {
        failureReasons.claimViolation++;
        regressions.push(`${r.testCaseId} → Claim violation: ${r.claimViolations[0]}`);
        reasonRecorded = true;
      }
      
      const failedChecks = r.deterministic.checks?.filter(c => !c.passed) || [];
      for (const check of failedChecks) {
        if (check.name === 'mustContain') {
          failureReasons.mustContain++;
          regressions.push(`${r.testCaseId} → ${check.detail}`);
          reasonRecorded = true;
        } else if (check.name === 'mustNotContain') {
          failureReasons.mustNotContain++;
          regressions.push(`${r.testCaseId} → ${check.detail}`);
          reasonRecorded = true;
        } else if (check.name.startsWith('hashtag')) {
          failureReasons.hashtags++;
          regressions.push(`${r.testCaseId} → ${check.detail || "Hashtags rule failed"}`);
          reasonRecorded = true;
        } else if (!reasonRecorded) {
          failureReasons.malformedOutput++;
          regressions.push(`${r.testCaseId} → Malformed output (${check.name})`);
          reasonRecorded = true;
        }
      }
    }
  }

  const structuralPassRate = Math.round((passedTotal / testCases.length) * 100);
  const productionReadiness = structuralPassRate === 100 ? "PASS" : "FAIL";
  const semScoreAvg = runSemantic && passedTotal > 0 ? (totalSemScore / passedTotal).toFixed(1) : "N/A";

  console.log("\n" + "=".repeat(70));
  console.log(`Benchmark: ${structuralPassRate}%\n`);
  
  console.log(`Structural Gate`);
  console.log(`  Passed: ${passedTotal}/${testCases.length}`);
  console.log(`  Failed: ${testCases.length - passedTotal}\n`);
  
  console.log(`Failure reasons`);
  console.log(`  mustContain       ${failureReasons.mustContain}`);
  console.log(`  mustNotContain    ${failureReasons.mustNotContain}`);
  console.log(`  hashtags          ${failureReasons.hashtags}`);
  console.log(`  claim violation   ${failureReasons.claimViolation}`);
  console.log(`  malformed output  ${failureReasons.malformedOutput}\n`);

  console.log(`Passed structural cases`);
  console.log(`  Semantic average: ${semScoreAvg}\n`);
  
  console.log(`Production Readiness: ${productionReadiness}`);

  if (regressions.length > 0) {
    console.log(`\nTop regressions`);
    // Deduplicate regressions per test case for cleaner output
    const uniqueRegressions = Array.from(new Set(regressions));
    uniqueRegressions.slice(0, 5).forEach(reg => console.log(`  ${reg}`));
  }
  console.log("=".repeat(70) + "\n");

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const report: BenchmarkReport = {
    timestamp: new Date().toISOString(),
    model,
    promptVersion: PROMPT_VERSION,
    datasetVersion: DATASET_VERSION,
    totalCases: testCases.length,
    passedCases: passedTotal,
    overallDeterministicScore: structuralPassRate,
    overallSemanticScore: runSemantic && passedTotal > 0 ? Math.round(totalSemScore / passedTotal) : undefined,
    overallCombinedScore: structuralPassRate,
    categoryScores: {},
    results
  };

  const reportsDir = path.join(__dirname, "benchmark-reports");
  if (!fs.existsSync(reportsDir)) {
    fs.mkdirSync(reportsDir, { recursive: true });
  }

  const reportPath = path.join(reportsDir, `report_${timestamp}.json`);
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  console.log(`📄 Report saved to: scripts/benchmark-reports/report_${timestamp}.json\n`);
}

runFullBenchmark();
