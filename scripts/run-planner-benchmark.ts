// Fixed benchmark seed for deterministic randomness
const BENCHMARK_SEED = 12345;

// Seeded PRNG (mulberry32) – deterministic based on BENCHMARK_SEED
function mulberry32(a: number) {
  return function () {
    a = (a + 0x6d2b79f5) | 0;
    var t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

import fs from "fs";
import path from "path";
import { config } from "dotenv";
config({ path: ".env.local" });
config({ path: ".env" });

import dataset from "../lib/evaluation/dataset.json" assert { type: "json" };
import { runPlannerLocal, LocalPipelineResult } from "../lib/evaluation/localPipeline.ts";
import { evaluateModeIdentifiability, evaluateCreativeGroundedness, evaluatePublishReadiness, evaluateIntellectualDiversity } from "../lib/evaluation/plannerLLMJudge.ts";
import { PlannerRequestDTO } from "../lib/planner/validation.ts";
import { ProductionGenerationAdapter } from "../lib/ai/productionAdapter.ts"; // Pipeline A
import { GenerationInput } from "../types/content.ts";

export type FailureClass =
  | "length"
  | "platform_fit"
  | "objective_mismatch"
  | "hallucinated_claim"
  | "cliche_density"
  | "missing_field"
  | "persona_drift"
  | "cta_mismatch"
  | "semantic_structure"
  | "other";

// Map typed validation code to taxonomy bucket
function mapSignalToFailureClass(code: string): FailureClass {
  switch (code) {
    case "LENGTH_EXCEEDED":
      return "length";
    case "HALLUCINATED_CLAIM":
      return "hallucinated_claim";
    case "CLICHE_DENSITY":
      return "cliche_density";
    case "MISSING_FIELD":
      return "missing_field";
    case "FORBIDDEN_TERM":
    case "FORMATTING_ARTIFACT":
      return "semantic_structure";
    case "PLATFORM_FIT":
      return "platform_fit";
    case "OBJECTIVE_MISMATCH":
      return "objective_mismatch";
    case "CTA_MISMATCH":
      return "cta_mismatch";
    case "PERSONA_DRIFT":
      return "persona_drift";
    default:
      return "other";
  }
}

async function runBenchmark() {
  const runDiversity = process.argv.includes("--diversity");

  if (process.argv.includes("--test-compact")) {
    console.log(`\n🔬 Running Phase C: Compact Mode Benchmark on re-01`);
    const tc = dataset.find((c: any) => c.id === "re-01") || dataset[0];
    const rawPlatform = tc.input.platform || "x";

    let topologyValidCount = 0;
    let lengthPassCount = 0;
    let publishReadyCount = 0;
    let identifiedCount = 0;

    const modes = ["thought_provoking", "analytical", "philosophical"] as const;
    const modeResults: any[] = [];

    for (const mode of modes) {
      console.log(`  Testing mode: ${mode}...`);
      const req: PlannerRequestDTO = {
        topic: tc.input.rawInput,
        platform: rawPlatform === "x_twitter" ? "x" : rawPlatform,
        objective: "sales",
        persona: "intellectual",
        language: "ar",
        audience: tc.input.metadata?.targetAudience || "",
        constraints: {
          forcedIntellectualMode: mode,
        }
      };

      const res = await runPlannerLocal(req);

      const isTopologyValid = !!res.plannerOutputRaw && !res.error;
      if (isTopologyValid) topologyValidCount++;

      // LENGTH_EXCEEDED is now soft — success can be true even if length exceeds profile.
      // We track lengthFit separately to distinguish generation success from length fit.
      const passedLength = !res.failureSignals.some(s => s.code === "LENGTH_EXCEEDED");
      if (passedLength) lengthPassCount++;

      let isIdentified = false;
      let isPublishReady = false;
      let actualMode = "unknown";

      if (res.success && res.content) {
        const idEval = await evaluateModeIdentifiability(res.content, req.topic, "compact");
        actualMode = idEval.identifiedMode;
        isIdentified = actualMode === mode;
        if (isIdentified) identifiedCount++;

        const prEval = await evaluatePublishReadiness(res.content, req.topic, req.platform, "thought", req.persona, "compact");
        isPublishReady = prEval.publishReadyScore >= 4;
        if (isPublishReady) publishReadyCount++;
      }
      
      if (mode === "analytical") {
        console.log(`\n\n=== DIAGNOSTIC DUMP: ANALYTICAL COMPACT ===`);
        console.log(`[Planner raw output]\n${res.plannerOutputRaw}\n`);
        const l = res.lengths;
        if (l) {
          console.log(`IR Length:     ${l.irLength} ch`);
          console.log(`First-pass:    ${l.finalFirstPass} ch  (exp: ${l.expansionRatioFirstPass.toFixed(2)}x)`);
          if (res.retryUsed) {
            console.log(`Retry (${res.retryReason}): ${l.finalRetry ?? 0} ch  (exp: ${l.expansionRatioRetry?.toFixed(2) ?? 0}x)`);
          }
        }
        console.log(`Signals: ${res.failureSignals.map(s => `${s.code}(${s.severity})`).join(", ") || "none"}`);
        console.log(`Success: ${res.success}`);
        console.log(`Final length: ${res.content ? `${res.content.title ?? ""} ${res.content.hook ?? ""} ${res.content.body ?? ""} ${res.content.callToAction ?? ""} ${(res.content.hashtags ?? []).join(" ")}`.trim().length : 0} ch`);
        console.log(`===========================================\n\n`);
      }

      modeResults.push({
        Mode: mode,
        IR_Valid: isTopologyValid,
        LengthFit: passedLength,
        Detected_Mode: actualMode,
        Publish_Ready: isPublishReady,
      });
    }

    console.log(`\n📊 Compact Benchmark Results:`);
    console.log(`  irTopologyValid:     ${topologyValidCount}/3 (${Math.round(topologyValidCount / 3 * 100)}%)`);
    console.log(`  lengthFit:           ${lengthPassCount}/3 (${Math.round(lengthPassCount / 3 * 100)}%)  (soft — output within profile)`);
    console.log(`  modeIdentifiability: ${identifiedCount}/3 (${Math.round(identifiedCount / 3 * 100)}%)`);
    console.log(`  publishReady:        ${publishReadyCount}/3 (${Math.round(publishReadyCount / 3 * 100)}%)`);
    console.log(`\nDetailed:`);
    console.table(modeResults);
    return;
  }

  console.log(`\n🧪 Running Planner Benchmark (Pipeline B)${runDiversity ? " + Diversity" : ""}`);
  // Dataset accounting – do NOT slice before we know the actual size
  const REQUESTED_CASES = 35;
  const available = dataset.length;
  const missing = Math.max(0, REQUESTED_CASES - available);
  const testCases = dataset.slice(0, Math.min(REQUESTED_CASES, available));
  const executed = testCases.length;

  console.log(`Dataset accounting:`);
  console.log(`  Requested: ${REQUESTED_CASES}`);
  console.log(`  Available: ${available}`);
  console.log(`  Executed:  ${executed}`);
  console.log(`  Missing:   ${missing}`);

  const results: any[] = [];
  const blindComparison: any[] = [];
  const blindKey: any[] = [];

  // Metric counters
  let firstPassTotal = 0;
  let generationTotal = 0;   // success (first pass OR after retry)
  let firstPassFailures = 0;
  let lengthFitTotal = 0;    // cases where output fits the effective length profile
  let hardFailureTotal = 0;
  let hardFailureRetriedCases = 0;
  let hardFailureRescuedCases = 0;

  const hardFailureTaxonomy: Record<FailureClass, number> = {
    length: 0,
    platform_fit: 0,
    objective_mismatch: 0,
    hallucinated_claim: 0,
    cliche_density: 0,
    missing_field: 0,
    persona_drift: 0,
    cta_mismatch: 0,
    semantic_structure: 0,
    other: 0,
  };
  const softFailureTaxonomy: Record<FailureClass, number> = { ...hardFailureTaxonomy };

  const oldPipeline = new ProductionGenerationAdapter();

  // Deterministic RNG using the fixed seed
  const rng = mulberry32(BENCHMARK_SEED);

  for (const [index, tc] of testCases.entries()) {
    process.stdout.write(`⏳ [${String(index + 1).padStart(2, "0")}/${executed}] [${tc.category.padEnd(16)}] ${tc.name.slice(0, 25).padEnd(27)} ... `);

    const rawPlatform = tc.input.platform || "x"; // fallback
    const plannerRequest: PlannerRequestDTO = {
      topic: tc.input.rawInput,
      platform: rawPlatform === "x_twitter" ? "x" : rawPlatform,
      objective:
        tc.input.metadata?.marketingObjective === "sell"
          ? "sales"
          : tc.input.metadata?.marketingObjective === "generate_leads"
            ? "leads"
            : tc.input.metadata?.marketingObjective === "attract_messages"
              ? "messages"
              : tc.input.metadata?.marketingObjective === "drive_traffic"
                ? "traffic"
                : "awareness",
      persona: tc.expectations.persona || "intellectual",
      language: "ar",
      audience: tc.input.metadata?.targetAudience || "",
      purpose: tc.input.purpose || "thought",
      arabicStyle: tc.input.arabicStyle,
      keyMessage: tc.input.rawInput,
      copyFramework: "auto",
      constraints: {
        customInstructions: tc.input.customInstructions || "",
        forbiddenTerms: tc.expectations.mustNotContain || [],
        requiredTerms: tc.expectations.mustContain || [],
        maxLength: tc.expectations.maxLength || undefined,
      },
    };

    // ----- Pipeline B (new) -----
    const pipelineBResult: LocalPipelineResult = await runPlannerLocal(plannerRequest);

    // ----- Metrics for Pipeline B -----
    if (pipelineBResult.firstPassSuccess) {
      firstPassTotal++;
    } else {
      firstPassFailures++;
    }
    if (pipelineBResult.success) {
      generationTotal++;
    }
    // lengthFit: output does not trigger LENGTH_EXCEEDED (now a soft signal)
    // We check the final pass's signals, not failureSignals (which only contains hard failures)
    const finalPassSignals = pipelineBResult.allValidationPasses[pipelineBResult.allValidationPasses.length - 1]?.signals || [];
    const lengthFit = !finalPassSignals.some(s => s.code === "LENGTH_EXCEEDED");
    if (lengthFit) lengthFitTotal++;

    if (pipelineBResult.retryUsed) {
      hardFailureRetriedCases++;
      if (pipelineBResult.success) {
        hardFailureRescuedCases++;
      }
    }
    // Hard failure taxonomy across all validation passes for this case
    const hardSignalsForCase = new Set<string>();
    for (const pass of pipelineBResult.allValidationPasses) {
      for (const signal of pass.signals) {
        if (signal.severity === "hard") {
          hardSignalsForCase.add(signal.code);
          hardFailureTotal++;
        }
      }
    }
    for (const code of hardSignalsForCase) {
      hardFailureTaxonomy[mapSignalToFailureClass(code)]++;
    }
    // Soft taxonomy (collected uniquely across ALL validation passes for this case)
    const softSignalsForCase = new Set<string>();
    for (const pass of pipelineBResult.allValidationPasses) {
      if (pass.signals) {
        for (const signal of pass.signals) {
          if (signal.severity === "soft") {
            softSignalsForCase.add(mapSignalToFailureClass(signal.code));
          }
        }
      }
    }
    for (const failureClass of softSignalsForCase) {
      softFailureTaxonomy[failureClass as FailureClass]++;
    }

    // ----- Persona specific evaluations -----
    let personaTestResults: any = {};
    if (pipelineBResult.success && pipelineBResult.content) {
      const strategyId = plannerRequest.purpose === "marketing" ? (plannerRequest.copyFramework === "auto" ? "benefit_led" : plannerRequest.copyFramework) : plannerRequest.persona;
      const publishReadiness = await evaluatePublishReadiness(pipelineBResult.content, plannerRequest.topic, plannerRequest.platform, plannerRequest.purpose, strategyId);
      personaTestResults.publishReadiness = publishReadiness;
      if (plannerRequest.persona === "creative") {
        const creativeEval = await evaluateCreativeGroundedness(pipelineBResult.content, plannerRequest.topic);
        personaTestResults.creative = creativeEval;
      }
      if (plannerRequest.persona === "intellectual") {
        const modeEval = await evaluateModeIdentifiability(pipelineBResult.content, plannerRequest.topic);
        personaTestResults.intellectual = modeEval;
      }
    }

    // ----- Pipeline A (old) -----
    let pipelineAOutput: any = null;
    let aAvailable = true;
    let aPersonaTestResults: any = {};
    try {
      const inputPayload = { ...tc.input, platform: tc.input.platform || "x" } as GenerationInput;
      const aResult = await oldPipeline.generateContent(inputPayload);
      pipelineAOutput = aResult.content;
      
      if (pipelineAOutput) {
        const strategyId = plannerRequest.purpose === "marketing" ? (plannerRequest.copyFramework === "auto" ? "benefit_led" : plannerRequest.copyFramework) : plannerRequest.persona;
        const aPublishReadiness = await evaluatePublishReadiness(pipelineAOutput, plannerRequest.topic, plannerRequest.platform, plannerRequest.purpose, strategyId);
        aPersonaTestResults.publishReadiness = aPublishReadiness;
      }
    } catch (e) {
      aAvailable = false;
      pipelineAOutput = { error: String(e) };
    }

    // ----- Blind comparison (no identity info) -----
    const isBFirst = rng() > 0.5;
    const bAvailable = pipelineBResult.success && pipelineBResult.content;
    const optionB = bAvailable ? pipelineBResult.content : { error: "B_UNAVAILABLE" };
    const optionA = aAvailable ? pipelineAOutput : { error: "A_UNAVAILABLE" };
    blindComparison.push({
      caseId: tc.id,
      topic: plannerRequest.topic,
      platform: plannerRequest.platform,
      objective: plannerRequest.objective,
      option1: isBFirst ? optionB : optionA,
      option2: isBFirst ? optionA : optionB,
    });

    // ----- Blind key (stores true mapping) -----
    blindKey.push({
      caseId: tc.id,
      mapping: {
        option1: isBFirst
          ? bAvailable
            ? "Pipeline B"
            : "B_UNAVAILABLE"
          : aAvailable
            ? "Pipeline A"
            : "A_UNAVAILABLE",
        option2: isBFirst
          ? aAvailable
            ? "Pipeline A"
            : "A_UNAVAILABLE"
          : bAvailable
            ? "Pipeline B"
            : "B_UNAVAILABLE",
      },
    });

    // ----- Retry info -----
    const retryDiff = pipelineBResult.retryUsed
      ? { reason: pipelineBResult.retryReason ?? "hard_failure" }
      : null;

    // ----- Accumulate result entry -----
    results.push({
      caseId: tc.id,
      pipelineB: pipelineBResult,
      personaTests: personaTestResults,
      aPersonaTests: aPersonaTestResults,
      aAvailable,
      bAvailable: !!bAvailable,
      retryDiff,
    });

    // Extract lengths trace — purely diagnostic, no decisions made from it
    const l = pipelineBResult.lengths;
    const lengthTrace = l ?
      `(eff:${l.effective} | fp:${l.finalFirstPass}ch exp:${l.expansionRatioFirstPass.toFixed(1)}x${pipelineBResult.retryUsed ? ` | retry:${l.finalRetry ?? 0}ch exp:${l.expansionRatioRetry?.toFixed(1) ?? 0}x` : ""})` : "";

    if (pipelineBResult.success) {
      console.log(`✅ PASS (First pass: ${pipelineBResult.firstPassSuccess}) ${lengthTrace}`);
    } else {
      console.log(`❌ FAIL ${lengthTrace}`);
      const codes = pipelineBResult.failureSignals.map(s => s.code).join(", ");
      console.log(`    Signals: ${codes}`);
      if (pipelineBResult.error) {
        console.log(`    Error: ${pipelineBResult.error}`);
      }
    }
  }

  // ----- Summary calculations -----
  const publishReadyTotal = results.filter(r => r.personaTests?.publishReadiness?.publishReadyScore >= 4).length;
  const publishReadyAmongSuccessful = generationTotal > 0 ? publishReadyTotal / generationTotal : 0;
  const publishReadyOverall = executed > 0 ? publishReadyTotal / executed : 0;
  const hardFailureRetryRate = executed > 0 ? hardFailureRetriedCases / executed : 0;
  const hardFailureRescueRate = hardFailureRetriedCases > 0 ? hardFailureRescuedCases / hardFailureRetriedCases : 0;

  console.log("\n" + "=".repeat(70));
  console.log(`Benchmark Results:`);
  console.log(`  Total Cases:             ${executed}`);
  console.log(`  Generation Success:      ${generationTotal} / ${executed} = ${Math.round((generationTotal / executed) * 100)}%`);
  console.log(`    First-pass Success:    ${firstPassTotal} / ${executed} = ${Math.round((firstPassTotal / executed) * 100)}%`);
  console.log(`    First-pass Failures:   ${firstPassFailures}`);
  console.log(`  Length Fit:              ${lengthFitTotal} / ${executed} = ${Math.round((lengthFitTotal / executed) * 100)}%`);
  console.log(``);
  console.log(`  Hard Failure Retry (${Array.from(new Set([
    "MISSING_FIELD", "HALLUCINATED_CLAIM", "FORBIDDEN_TERM", "FORMATTING_ARTIFACT"
  ])).join("|")}):`)
  console.log(`    Retried Cases:         ${hardFailureRetriedCases} / ${executed} = ${Math.round(hardFailureRetryRate * 100)}%`);
  console.log(`    Rescued (success):     ${hardFailureRescuedCases} / ${hardFailureRetriedCases} = ${hardFailureRetriedCases > 0 ? Math.round(hardFailureRescueRate * 100) : 0}%`);
  console.log(``);
  console.log(`  Publish-ready (≥4):`);
  console.log(`    ${publishReadyTotal} / ${generationTotal} = ${Math.round(publishReadyAmongSuccessful * 100)}%  (among successful)`);
  console.log(`    ${publishReadyTotal} / ${executed}         = ${Math.round(publishReadyOverall * 100)}%  (overall)`);
  console.log(`\nFailure Taxonomy:`);
  console.log(`  Hard:`);
  for (const [k, v] of Object.entries(hardFailureTaxonomy)) {
    if (v > 0) console.log(`    ${k}: ${v}`);
  }
  console.log(`  Soft (warnings only):`);
  for (const [k, v] of Object.entries(softFailureTaxonomy)) {
    if (v > 0) console.log(`    ${k}: ${v}`);
  }

  // ----- Creative / Intellectual summaries -----
  const creativeCases = results.filter(r => r.personaTests?.creative);
  if (creativeCases.length > 0) {
    const grounded = creativeCases.filter(r => r.personaTests.creative.isGrounded).length;
    const excessive = creativeCases.filter(r => r.personaTests.creative.metaphorCount > 1).length;
    console.log(`\nCreative Budget:`);
    console.log(`  Grounded Metaphors: ${Math.round((grounded / creativeCases.length) * 100)}%`);
    console.log(`  Excessive (>1):     ${excessive} cases`);
  }

  const intellectualCases = results.filter(r => r.personaTests?.intellectual);
  if (intellectualCases.length > 0) {
    const identified = intellectualCases.filter(r => r.personaTests.intellectual.identifiedMode !== "unknown").length;
    console.log(`\nIntellectual Modes:`);
    console.log(`  Mode Identifiability: ${Math.round((identified / intellectualCases.length) * 100)}%`);
  }

  // ----- Expansion Ratio summaries -----
  const getStats = (values: number[]) => {
    if (values.length === 0) return { mean: 0, p50: 0, p90: 0, p95: 0, max: 0 };
    values.sort((a, b) => a - b);
    const sum = values.reduce((a, b) => a + b, 0);
    return {
      mean: sum / values.length,
      p50: values[Math.floor(values.length * 0.50)],
      p90: values[Math.floor(values.length * 0.90)],
      p95: values[Math.floor(values.length * 0.95)],
      max: values[values.length - 1]
    };
  };

    const firstPassExpansions = results.map(r => r.pipelineB?.lengths?.expansionRatioFirstPass).filter((v): v is number => v !== undefined && v > 0);
  const retryExpansions = results.map(r => r.pipelineB?.lengths?.expansionRatioRetry).filter((v): v is number => v !== undefined && v > 0);

  
  const fpStats = getStats(firstPassExpansions);
  const rStats = getStats(retryExpansions);

  console.log(`\nExpansion Ratio (Final Length / IR Length):`);
  console.log(`  First-pass:`);
  console.log(`    mean: ${fpStats.mean.toFixed(2)}x`);
  console.log(`    p50:  ${fpStats.p50.toFixed(2)}x`);
  console.log(`    p90:  ${fpStats.p90.toFixed(2)}x`);
  console.log(`    p95:  ${fpStats.p95.toFixed(2)}x`);
  console.log(`    max:  ${fpStats.max.toFixed(2)}x`);
  console.log(`  Retry:`);
  console.log(`    mean: ${rStats.mean.toFixed(2)}x`);
  console.log(`    p50:  ${rStats.p50.toFixed(2)}x`);
  console.log(`    p90:  ${rStats.p90.toFixed(2)}x`);
  console.log(`    p95:  ${rStats.p95.toFixed(2)}x`);
  console.log(`    max:  ${rStats.max.toFixed(2)}x`);

  // ----- Report output -----
  const isoTimestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const reportData = {
    metadata: {
      benchmarkVersion: "planner-bench-v1",
      datasetVersion: "dataset-v1",
      seed: BENCHMARK_SEED,
      requested: REQUESTED_CASES,
      available,
      executed,
      missing,
    },
    summary: {
      generationSuccess: {
        total: generationTotal,
        rate: generationTotal / executed,
        firstPassTotal,
        firstPassFailures,
      },
      lengthFit: {
        total: lengthFitTotal,
        rate: executed > 0 ? lengthFitTotal / executed : 0,
      },
      hardFailureRetry: {
        retriedCases: hardFailureRetriedCases,
        retryRate: hardFailureRetryRate,
        rescuedCases: hardFailureRescuedCases,
        rescueRate: hardFailureRescueRate,
      },
      publishReady: {
        count: publishReadyTotal,
        overallRate: publishReadyOverall,
        overallDenominator: executed,
        amongSuccessfulRate: publishReadyAmongSuccessful,
        amongSuccessfulDenominator: generationTotal,
      },
      failureTaxonomy: {
        hard: hardFailureTaxonomy,
        soft: softFailureTaxonomy,
      },
      expansionRatio: {
        firstPass: fpStats,
        retry: rStats,
      },
    },
    results,
  };

  const reportPath = path.join(__dirname, "benchmark-reports", `planner_report_${isoTimestamp}.json`);
  fs.writeFileSync(reportPath, JSON.stringify(reportData, null, 2));
  console.log(`\n📄 Planner Report saved to: ${reportPath}`);

  const blindPath = path.join(__dirname, "benchmark-reports", `blind_comparison_${isoTimestamp}.json`);
  const blindKeyPath = path.join(__dirname, "benchmark-reports", `blind_key_${isoTimestamp}.json`);
  fs.writeFileSync(blindPath, JSON.stringify(blindComparison, null, 2));
  fs.writeFileSync(blindKeyPath, JSON.stringify({
    benchmarkVersion: "planner-bench-v1",
    seed: BENCHMARK_SEED,
    entries: blindKey,
  }, null, 2));
  console.log(`🎭 Blind Comparison saved to: ${blindPath}`);
  console.log(`🔑 Blind Key saved to: ${blindKeyPath}`);

  console.log("=".repeat(70) + "\n");

  // ----- --diversity: Intellectual Diversity Benchmark (opt-in) -----
  if (runDiversity) {
    console.log("\n🔬 Running Intellectual Diversity Benchmark...");
    // Pick the first intellectual persona case that succeeded for a representative topic.
    const intellectualCase = results.find(
      r => r.pipelineB.success && r.personaTests?.intellectual
    );
    if (!intellectualCase) {
      console.log("⚠️  No successful intellectual case found for diversity test.");
    } else {
      const tc = testCases.find(t => t.id === intellectualCase.caseId)!;
      const rawPlatform = tc.input.platform || "x";
      const diversityRequest: PlannerRequestDTO = {
        topic: tc.input.rawInput,
        platform: rawPlatform === "x_twitter" ? "x" : rawPlatform,
        objective: "awareness",
        persona: "intellectual",
        language: "ar",
        audience: tc.input.metadata?.targetAudience || "",
      };
      console.log(`  Topic: ${diversityRequest.topic.slice(0, 60)}...`);
      const diversityResult = await evaluateIntellectualDiversity(diversityRequest);

      console.log(`\nIntellectual Diversity`);
      console.log(`────────────────────────────────`);
      if (diversityResult.status === "insufficient_outputs") {
        console.log(`Lexical similarity       null ↓`);
        console.log(`Structural divergence    null ↑`);
        console.log(`LLM distinctness         null / 5 ↑`);
        console.log(`LLM mode fidelity        null / 5 ↑`);
        console.log(`Template repetition      null / 5 ↓`);
      } else {
        console.log(`Lexical similarity       ${diversityResult.lexicalSimilarity!.toFixed(2)} ↓`);
        console.log(`Structural divergence    ${diversityResult.structuralDivergence!.toFixed(2)} ↑`);
        console.log(`LLM distinctness         ${diversityResult.llmDistinctness!.toFixed(1)} / 5 ↑`);
        console.log(`LLM mode fidelity        ${diversityResult.llmModeFidelity!.toFixed(1)} / 5 ↑`);
        console.log(`Template repetition      ${diversityResult.llmTemplateRepetition!.toFixed(1)} / 5 ↓`);
      }
      console.log(`\nReasoning: ${diversityResult.llmReasoning}`);
      console.log(`\nModes execution:`);
      for (const m of diversityResult.modes) {
        console.log(`  [${m.mode}] ${m.success ? "✅ PASS" : `❌ FAIL: ${m.error}`}`);
      }
      const diversityPath = path.join(
        __dirname,
        "benchmark-reports",
        `diversity_report_${isoTimestamp}.json`
      );
      fs.writeFileSync(diversityPath, JSON.stringify(diversityResult, null, 2));
      console.log(`\n📊 Diversity Report saved to: ${diversityPath}`);
    }
  }
}

runBenchmark();
