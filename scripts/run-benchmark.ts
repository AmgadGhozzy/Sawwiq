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
import { aiConfig, PROMPT_VERSION, DATASET_VERSION, PROMPT_EXPERIMENT_ID, PROMPT_MAX_GROWTH_PERCENT } from "../lib/config";
import type { EvaluationTestCase, BenchmarkReport, TestCaseResult } from "../lib/evaluation/types";
import { ProductionGenerationAdapter } from "../lib/ai/productionAdapter";
import { evaluateDeterministic, evaluateSemantic, computeCombinedScore } from "../lib/evaluation/evaluator";
import { analyzeBenchmark } from "../lib/evaluation/benchmarkAnalysis";
import { estimatePromptTokens, measurePromptBudget } from "../lib/evaluation/promptBudget";
import { buildGroupScores } from "../lib/evaluation/benchmarkGroups";
import { buildSystemPrompt, USER_PROMPT } from "../supabase/functions/generate/prompts/promptBuilder";

const cliArgs = process.argv.slice(2);
const hasFlag = (flag: string, environmentFlag: string) =>
  cliArgs.includes(flag) || process.env[environmentFlag] === "1";
const runSemantic = hasFlag("--semantic", "BENCHMARK_SEMANTIC");
const saveOutput = hasFlag("--save-output", "BENCHMARK_SAVE_OUTPUT");
const compareBaseline = hasFlag("--compare-baseline", "BENCHMARK_COMPARE_BASELINE");
const saveBaseline = hasFlag("--save-baseline", "BENCHMARK_SAVE_BASELINE");
const maxRetries = Number(process.env.BENCHMARK_MAX_RETRIES ?? "3");

function isRetryableProviderError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /RESOURCE_EXHAUSTED|\b429\b|rate.?limit|fetch failed/i.test(message);
}

async function wait(milliseconds: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function runFullBenchmark() {
  const apiKey = process.env.VERTEX_AI_API_KEY;
  if (!apiKey) {
    console.error("❌ VERTEX_AI_API_KEY is not set.");
    process.exit(1);
  }

  const model = process.env.GEMINI_MODEL ?? aiConfig.model;

  console.log(`\n🧪 Running Benchmark`);
  console.log(`Model:         ${model}`);
  console.log(`Prompt Ver:    ${PROMPT_VERSION}`);
  console.log(`Experiment:    ${PROMPT_EXPERIMENT_ID}`);
  console.log(`Dataset Ver:   ${DATASET_VERSION}`);
  console.log(`Test Cases:    ${dataset.length}`);
  console.log(`Semantic Eval: ${runSemantic ? "Enabled" : "Disabled"}`);
  console.log(`Save Output:   ${saveOutput ? "Enabled" : "Disabled"}`);
  console.log(`Compare Base:  ${compareBaseline ? "Enabled" : "Disabled"}\n`);
  console.log(`Save Baseline: ${saveBaseline ? "Enabled" : "Disabled"}\n`);
  console.log(`CLI Args:      ${cliArgs.join(" ") || "(none)"}`);
  console.log(`Max Retries:   ${maxRetries}\n`);

  let baselineReport: BenchmarkReport | null = null;
  if (compareBaseline) {
    const baselinePath = path.join(__dirname, "benchmark-reports", "baseline.json");
    if (fs.existsSync(baselinePath)) {
      baselineReport = JSON.parse(fs.readFileSync(baselinePath, "utf-8"));
      console.log(`📊 Loaded baseline from ${baselineReport?.timestamp}\n`);
    } else {
      console.log(`⚠️ Baseline file not found at ${baselinePath}. Continuing without comparison.\n`);
    }
  }

  const provider = new ProductionGenerationAdapter();
  const testCases = dataset as EvaluationTestCase[];

  const results: TestCaseResult[] = [];
  let passedTotal = 0;
  let totalSemScore = 0;

  for (const [index, tc] of testCases.entries()) {
    process.stdout.write(`⏳ [${String(index + 1).padStart(2, "0")}/${testCases.length}] [${tc.category.padEnd(16)}] ${tc.name.slice(0, 25).padEnd(27)} ... `);

    try {
      const startTime = Date.now();

      let generatedContent;
      let tokenUsage: TestCaseResult["tokenUsage"];
      let systemPromptEstimatedTokens: number | undefined;
      let dynamicContextEstimatedTokens: number | undefined;
      let retryAttempts = 0;
      try {
        const inputPayload = { ...tc.input, platform: "tiktok" } as import("../types/content").GenerationInput;
        let generationResult;
        while (true) {
          try {
            generationResult = await provider.generateContent(inputPayload);
            break;
          } catch (error) {
            if (!isRetryableProviderError(error) || retryAttempts >= maxRetries) throw error;
            retryAttempts++;
            const delayMs = 2_000 * 2 ** (retryAttempts - 1);
            console.log(`↻ retry ${retryAttempts}/${maxRetries} in ${delayMs / 1000}s`);
            await wait(delayMs);
          }
        }
        generatedContent = generationResult.content;
        const systemPrompt = buildSystemPrompt(inputPayload);
        systemPromptEstimatedTokens = estimatePromptTokens(systemPrompt.length);
        dynamicContextEstimatedTokens = estimatePromptTokens(inputPayload.rawInput.length + USER_PROMPT.length);
        tokenUsage = generationResult.metadata.tokenUsage;
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        console.log(`❌ FAIL: ${message}`);
        const isClaimViolation = message.startsWith("Claim validation failed:");
        results.push({
          testCaseId: tc.id,
          testCaseName: tc.name,
          category: tc.category,
          deterministic: { checks: [], score: 0, passed: false, details: [message] },
          claimViolations: isClaimViolation ? [message] : [],
          generationError: isClaimViolation ? undefined : message,
          retryAttempts,
          combinedScore: 0,
          latencyMs: Date.now() - startTime
        });
        continue;
      }

      const latencyMs = Date.now() - startTime;

      const detScore = evaluateDeterministic(generatedContent, tc.expectations, tc.input.contentType);

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
        tokenUsage,
        systemPromptEstimatedTokens,
        dynamicContextEstimatedTokens,
        retryAttempts,
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
    malformedOutput: 0,
    generationError: 0,
  };

  const regressions: string[] = [];

  for (const r of results) {
    if (!r.deterministic.passed || r.claimViolations.length > 0) {
      let reasonRecorded = false;
      if (r.generationError) {
        failureReasons.generationError++;
        regressions.push(`${r.testCaseId} → Generation error: ${r.generationError}`);
        reasonRecorded = true;
      }
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
  const semScoreAvg = runSemantic && passedTotal > 0 ? (totalSemScore / passedTotal).toFixed(1) : "N/A";

  // Baseline Comparison Logic
  let newRegressions = 0;
  let fixedRegressions = 0;
  let unchangedFailures = 0;
  let delta = 0;

  if (baselineReport) {
    delta = structuralPassRate - baselineReport.overallDeterministicScore;

    for (const r of results) {
      const baselineRes = baselineReport.results.find(br => br.testCaseId === r.testCaseId);
      const isPass = r.deterministic.passed && r.claimViolations.length === 0 && !r.generationError;

      if (baselineRes) {
        const baselinePass = baselineRes.deterministic.passed && baselineRes.claimViolations.length === 0 && !baselineRes.generationError;
        if (baselinePass && !isPass) newRegressions++;
        else if (!baselinePass && isPass) fixedRegressions++;
        else if (!baselinePass && !isPass) unchangedFailures++;
      }
    }
  }

  // Production Gate Logic
  const dimensionAverages: Record<string, number> = {};
  const semanticDimensions = [
    "factuality",
    "dialectAccuracy",
    "marketingQuality",
    "readability",
    "hookQuality",
    "ctaQuality",
    "hallucinationSafety",
    "overall",
  ] as const;
  const semanticResults = results.flatMap((result) => result.semantic ? [result.semantic] : []);
  for (const dimension of semanticDimensions) {
    if (semanticResults.length > 0) {
      dimensionAverages[dimension] = Math.round(
        semanticResults.reduce((sum, result) => sum + result[dimension], 0) / semanticResults.length,
      );
    }
  }

  const categoryScores: BenchmarkReport["categoryScores"] = {};
  for (const category of new Set(results.map((result) => result.category))) {
    const categoryResults = results.filter((result) => result.category === category);
    const categorySemantic = categoryResults.flatMap((result) => result.semantic ? [result.semantic.overall] : []);
    categoryScores[category] = {
      total: categoryResults.length,
      averageDeterministic: Math.round(categoryResults.reduce((sum, result) => sum + result.deterministic.score, 0) / categoryResults.length),
      averageSemantic: categorySemantic.length > 0
        ? Math.round(categorySemantic.reduce((sum, score) => sum + score, 0) / categorySemantic.length)
        : undefined,
    };
  }

  const promptBudget = measurePromptBudget(buildSystemPrompt);
  const averageSystemPromptTokens = Math.round(
    results.reduce((sum, result) => sum + (result.systemPromptEstimatedTokens ?? 0), 0) / results.length,
  );
  const averageDynamicContextTokens = Math.round(
    results.reduce((sum, result) => sum + (result.dynamicContextEstimatedTokens ?? 0), 0) / results.length,
  );
  const acceptanceReasons: string[] = [];
  const requiredStructuralScore = baselineReport?.overallDeterministicScore ?? 100;
  if (structuralPassRate < requiredStructuralScore) {
    acceptanceReasons.push(`Structural score ${structuralPassRate}% is below required ${requiredStructuralScore}%.`);
  }
  if (newRegressions > 0) acceptanceReasons.push(`${newRegressions} new regression(s) detected.`);
  if (failureReasons.claimViolation > 0) acceptanceReasons.push("Claim violations detected.");
  if (failureReasons.generationError > 0) acceptanceReasons.push("Generation errors detected.");
  if (promptBudget.violations.length > 0) acceptanceReasons.push(`Prompt budget exceeded: ${promptBudget.violations.join(", ")}.`);
  if (runSemantic && semanticResults.length === 0) acceptanceReasons.push("Semantic evaluation did not return any valid scores.");
  if (baselineReport?.overallSemanticScore !== undefined && baselineReport.overallSemanticScore !== undefined &&
      semanticResults.length > 0 && Math.round(totalSemScore / passedTotal) < baselineReport.overallSemanticScore) {
    acceptanceReasons.push("Semantic average is below the baseline.");
  }
  for (const dimension of ["factuality", "hallucinationSafety"] as const) {
    const baselineScore = baselineReport?.dimensionAverages?.[dimension];
    if (baselineScore !== undefined && dimensionAverages[dimension] !== undefined && dimensionAverages[dimension] < baselineScore) {
      acceptanceReasons.push(`${dimension} is below the baseline.`);
    }
  }

  const providerFailureCount = results.filter((result) => result.generationError).length;
  const runComplete = providerFailureCount === 0 && results.length === testCases.length;
  const productionGateFailed = acceptanceReasons.length > 0 || !runComplete;

  const productionReadiness = productionGateFailed ? "FAIL ❌" : "PASS ✅";

  console.log("\n" + "=".repeat(70));
  console.log(`Benchmark: ${structuralPassRate}%\n`);

  if (baselineReport) {
    console.log(`Baseline Compare`);
    console.log(`  Baseline Score:     ${baselineReport.overallDeterministicScore}%`);
    console.log(`  Candidate Score:    ${structuralPassRate}%`);
    console.log(`  Delta:              ${delta > 0 ? "+" : ""}${delta}%`);
    console.log(`  New Regressions:    ${newRegressions}`);
    console.log(`  Fixed Regressions:  ${fixedRegressions}`);
    console.log(`  Unchanged Failures: ${unchangedFailures}\n`);
  }

  console.log(`Structural Gate`);
  console.log(`  Passed: ${passedTotal}/${testCases.length}`);
  console.log(`  Failed: ${testCases.length - passedTotal}\n`);

  console.log(`Failure reasons`);
  console.log(`  mustContain       ${failureReasons.mustContain}`);
  console.log(`  mustNotContain    ${failureReasons.mustNotContain}`);
  console.log(`  hashtags          ${failureReasons.hashtags}`);
  console.log(`  claim violation   ${failureReasons.claimViolation}`);
  console.log(`  malformed output  ${failureReasons.malformedOutput}\n`);
  console.log(`  generation error  ${failureReasons.generationError}\n`);

  console.log(`Passed structural cases`);
  console.log(`  Semantic average: ${semScoreAvg}\n`);

  console.log(`Prompt Budget`);
  console.log(`  Matrix characters: ${promptBudget.totalCharacters}`);
  console.log(`  Estimated tokens:  ${promptBudget.estimatedTokens}`);
  console.log(`  Violations:        ${promptBudget.violations.length}\n`);

  console.log(`Production Readiness: ${productionReadiness}`);

  if (regressions.length > 0) {
    console.log(`\nTop regressions`);
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
    experimentId: PROMPT_EXPERIMENT_ID,
    generationConfig: { temperature: aiConfig.temperature, topP: aiConfig.topP },
    totalCases: testCases.length,
    passedCases: passedTotal,
    overallDeterministicScore: structuralPassRate,
    overallSemanticScore: runSemantic && passedTotal > 0 ? Math.round(totalSemScore / passedTotal) : undefined,
    overallCombinedScore: structuralPassRate,
    dimensionAverages: Object.keys(dimensionAverages).length > 0 ? dimensionAverages : undefined,
    promptBudget: {
      maxGrowthPercent: PROMPT_MAX_GROWTH_PERCENT,
      totalCharacters: promptBudget.totalCharacters,
      estimatedTokens: promptBudget.estimatedTokens,
      violations: promptBudget.violations,
      averageSystemPromptTokens,
      averageDynamicContextTokens,
    },
    acceptance: { passed: !productionGateFailed, reasons: acceptanceReasons },
    runComplete,
    providerFailureCount,
    categoryScores,
    benchmarkGroups: buildGroupScores(results),
    results
  };

  const reportsDir = path.join(__dirname, "benchmark-reports");
  if (!fs.existsSync(reportsDir)) {
    fs.mkdirSync(reportsDir, { recursive: true });
  }

  const reportPath = path.join(reportsDir, `report_${timestamp}.json`);
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  console.log(`📄 Report saved to: scripts/benchmark-reports/report_${timestamp}.json\n`);

  const analysis = analyzeBenchmark(report, baselineReport);
  const analysisPath = path.join(reportsDir, `analysis_${timestamp}.json`);
  fs.writeFileSync(analysisPath, JSON.stringify(analysis, null, 2));
  console.log(`🔎 Analysis saved to: scripts/benchmark-reports/analysis_${timestamp}.json`);
  if (analysis.recommendedPromptEdits.length > 0) {
    console.log("Recommended next prompt edits:");
    analysis.recommendedPromptEdits.forEach((edit) => console.log(`  - ${edit}`));
  }

  const canSaveBaseline = !results.some((result) => result.generationError) &&
    (!runSemantic || semanticResults.length > 0);
  if (saveBaseline && canSaveBaseline) {
    const baselinePath = path.join(reportsDir, "baseline.json");
    fs.copyFileSync(reportPath, baselinePath);
    console.log(`📌 Baseline updated: scripts/benchmark-reports/baseline.json`);
  } else if (saveBaseline) {
    console.log("⚠️ Baseline was not updated because the run had generation errors or no semantic scores.");
  }
}

runFullBenchmark();
