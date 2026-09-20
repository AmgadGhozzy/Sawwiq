import fs from "fs";
import path from "path";
import { config } from "dotenv";
config({ path: ".env.local" });
config({ path: ".env" });

import dataset from "../lib/evaluation/dataset.json" assert { type: "json" };
import { runPlannerLocal } from "../lib/evaluation/localPipeline.ts";
import { evaluatePublishReadiness } from "../lib/evaluation/plannerLLMJudge.ts";
import { PlannerRequestDTO } from "../lib/planner/validation.ts";

async function runBenchmark() {
  console.log(`\n🧪 Running Mode-Separated Benchmark`);
  console.log(`Hypothesis: Removing persona contamination (marketing mode) improves marketing performance compared to thought mode.\n`);

  const REQUESTED_CASES = 35;
  const available = dataset.length;
  const testCases = dataset.slice(0, Math.min(REQUESTED_CASES, available));
  const executed = testCases.length;

  console.log(`Dataset: ${executed} cases\n`);

  const results: any[] = [];
  let thoughtTotalScore = 0;
  let marketingTotalScore = 0;
  let thoughtSuccess = 0;
  let marketingSuccess = 0;

  for (const [index, tc] of testCases.entries()) {
    process.stdout.write(`⏳ [${String(index + 1).padStart(2, "0")}/${executed}] [${tc.category.padEnd(16)}] ${tc.name.slice(0, 25).padEnd(27)} ...\n`);

    const rawPlatform = tc.input.platform || "x"; 
    const platform = rawPlatform === "x_twitter" ? "x" : rawPlatform;
    
    // --- Run Thought Mode ---
    const thoughtReq: PlannerRequestDTO = {
      purpose: "thought",
      topic: tc.input.rawInput,
      platform,
      objective: "sales", // Most marketing cases are sales/leads
      persona: "intellectual",
      language: "ar",
      audience: tc.input.metadata?.targetAudience || "",
      constraints: {
        forbiddenTerms: tc.expectations?.mustNotContain || [],
        requiredTerms: tc.expectations?.mustContain || [],
      },
    };

    const thoughtRes = await runPlannerLocal(thoughtReq);
    let thoughtScore = 0;
    if (thoughtRes.success && thoughtRes.content) {
      const evalRes = await evaluatePublishReadiness(thoughtRes.content, thoughtReq.topic, platform, "thought", "intellectual");
      thoughtScore = evalRes.publishReadyScore;
      thoughtSuccess++;
    }
    thoughtTotalScore += thoughtScore;

    // --- Run Marketing Mode ---
    const marketingReq: PlannerRequestDTO = {
      purpose: "marketing",
      topic: tc.input.rawInput,
      platform,
      objective: "sales",
      copyFramework: "benefit_led",
      tone: "professional",
      keyMessage: tc.input.rawInput,
      language: "ar",
      audience: tc.input.metadata?.targetAudience || "",
      constraints: {
        forbiddenTerms: tc.expectations?.mustNotContain || [],
        requiredTerms: tc.expectations?.mustContain || [],
      },
    };

    const marketingRes = await runPlannerLocal(marketingReq);
    let marketingScore = 0;
    if (marketingRes.success && marketingRes.content) {
      const evalRes = await evaluatePublishReadiness(marketingRes.content, marketingReq.topic, platform, "marketing", "benefit_led");
      marketingScore = evalRes.publishReadyScore;
      marketingSuccess++;
    } else {
      console.error("Marketing Failed:", marketingRes.error);
      console.error("Signals:", JSON.stringify(marketingRes.failureSignals, null, 2));
    }
    marketingTotalScore += marketingScore;

    console.log(`   Thought Mode Score:   ${thoughtScore}`);
    console.log(`   Marketing Mode Score: ${marketingScore}`);
    console.log(`   Delta:                ${(marketingScore - thoughtScore).toFixed(2)}\n`);

    results.push({
      caseId: tc.id,
      thoughtScore,
      marketingScore,
      delta: marketingScore - thoughtScore,
      thoughtSuccess: thoughtRes.success,
      marketingSuccess: marketingRes.success,
    });
  }

  const thoughtAvg = thoughtTotalScore / executed;
  const marketingAvg = marketingTotalScore / executed;

  console.log("\n" + "=".repeat(70));
  console.log(`Benchmark Results:`);
  console.log(`  Total Cases:             ${executed}`);
  console.log(`  Thought Mode Avg:        ${thoughtAvg.toFixed(2)} / 5 (Success: ${thoughtSuccess}/${executed})`);
  console.log(`  Marketing Mode Avg:      ${marketingAvg.toFixed(2)} / 5 (Success: ${marketingSuccess}/${executed})`);
  console.log(`  Overall Delta:           ${(marketingAvg - thoughtAvg).toFixed(2)}`);
  
  if (marketingAvg > thoughtAvg) {
    console.log(`\n✅ Hypothesis CONFIRMED: Marketing mode outperforms Thought mode on marketing tasks.`);
  } else {
    console.log(`\n❌ Hypothesis FAILED: Marketing mode did not outperform Thought mode.`);
  }
  
  const isoTimestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const reportPath = path.join(__dirname, "benchmark-reports", `mode_separated_report_${isoTimestamp}.json`);
  fs.writeFileSync(reportPath, JSON.stringify({ summary: { thoughtAvg, marketingAvg, delta: marketingAvg - thoughtAvg }, results }, null, 2));
  console.log(`\n📄 Report saved to: ${reportPath}`);
  console.log("=".repeat(70) + "\n");
}

runBenchmark();
