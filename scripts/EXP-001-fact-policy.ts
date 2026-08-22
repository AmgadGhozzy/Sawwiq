import fs from "fs";
import path from "path";
import { config } from "dotenv";
config({ path: ".env.local" });
config({ path: ".env" });

import datasetFacts from "./datasets/dataset-facts.json";
import { ProductionGenerationAdapter } from "../lib/ai/productionAdapter";
import { evaluateFactPreservation } from "../lib/evaluation/factEvaluator";
import { evaluateDeterministic } from "../lib/evaluation/evaluator";
import { extractFacts } from "../lib/content/facts/extractor";
import { GenerationInput, GenerationConfig } from "../types/content";
import { normalizeGenerationConfig } from "../lib/content/normalizer";
import { compilePrompt } from "../lib/content/prompt/compiler";

// Overriding compilePrompt is needed for EXP-001. We will mock the FactBoundaryLayer for B and C.
import * as compilerModule from "../lib/content/prompt/compiler";

const BASELINE_FACT_POLICY = compilerModule.compilePrompt;

const VERSION_B_FACT_POLICY = `
## سياسة الحقائق (Fact Policy)
Use only facts explicitly provided in the input.
Do not invent, infer, upgrade, or fabricate factual claims.
When a required fact is missing, omit it rather than guessing.
Keep numeric, commercial, technical, and location facts exact.
Creative wording may vary; factual meaning may not.
`;

async function runExperiment() {
  console.log("🚀 Starting EXP-001: Fact Preservation Experiment");
  
  const versions = ["A", "B", "C1"];
  const provider = new ProductionGenerationAdapter();
  const testCases = datasetFacts as any[];

  const results: any = { A: [], B: [], C1: [] };

  for (const version of versions) {
    console.log(`\n\n=== Running Version ${version} ===\n`);
    
    // Temporarily mock compilePrompt behavior
    const originalCompilePrompt = compilerModule.compilePrompt;
    
    // @ts-ignore - Mocking for experiment
    compilerModule.compilePrompt = (cfg) => {
      const base = originalCompilePrompt(cfg);
      if (version === "A") return base;
      if (version === "B") return base + "\n\n" + VERSION_B_FACT_POLICY;
      if (version === "C1") {
        return base + "\n\n" + VERSION_B_FACT_POLICY + "\n\nFACT LEDGER:\n" + JSON.stringify(cfg.factLedger?.explicit, null, 2);
      }
      return base;
    };

    for (const [index, tc] of testCases.entries()) {
      process.stdout.write(`⏳ [${String(index + 1).padStart(2, "0")}/${testCases.length}] [${tc.category.padEnd(16)}] ${tc.name.slice(0, 25).padEnd(27)} ... `);
      
      const v2Config: GenerationConfig = {
        platform: (tc.input.platform === "x_twitter" ? "x" : tc.input.platform) as any,
        format: tc.input.contentType === "short_video_script" ? "video" : "post",
        content: {
          type: (tc.input.contentType === "short_video_script" ? "video_script" : tc.input.contentType === "sponsored_ad" ? "advertisement" : tc.input.contentType === "ecommerce_product" ? "product_description" : tc.input.contentType === "real_estate" ? "real_estate_listing" : tc.input.contentType === "marketing_email" ? "email" : "social_post") as any,
          topic: tc.input.rawInput,
        },
        objective: (tc.input.metadata?.marketingObjective || "awareness") as any,
        language: {
          language: "ar",
          dialect: (tc.input.arabicStyle === "saudi_marketing" ? "saudi" : tc.input.arabicStyle === "gulf_premium" ? "gulf" : tc.input.arabicStyle === "egyptian_colloquial" ? "egyptian" : tc.input.arabicStyle === "formal_b2b" ? "msa" : "white_arabic") as any,
        },
        voice: {
          tone: "professional",
          style: "direct_response",
        },
        constraints: {},
      };
      const normalizedConfig = normalizeGenerationConfig(v2Config);
      
      try {
        const generationResult = await provider.generateContent(inputPayload);
        const generatedContent = generationResult.content;
        
        const detScore = evaluateDeterministic(generatedContent, tc.expectations, tc.input.contentType);
        
        await new Promise(resolve => setTimeout(resolve, 3000)); // Sleep for rate limit

        const factLedger = extractFacts(normalizedConfig);
        const factScore = await evaluateFactPreservation(generatedContent, tc.input.rawInput, factLedger);
        
        await new Promise(resolve => setTimeout(resolve, 3000)); // Sleep for rate limit
        
        results[version].push({
          testCaseId: tc.id,
          deterministic: detScore,
          factScore,
        });

        if (detScore.passed && factScore.criticalFactualFailureCount === 0) {
          console.log(`✅ PASS (Det: ${detScore.score}%, Fact: ${factScore.factPreservationScore}%)`);
        } else {
          console.log(`❌ FAIL (Det: ${detScore.score}%, Critical Fails: ${factScore.criticalFactualFailureCount})`);
        }
      } catch (err: any) {
        console.log(`❌ ERROR: ${err.message}`);
      }
    }
    
    // Restore
    // @ts-ignore
    compilerModule.compilePrompt = originalCompilePrompt;
  }

  // Print Summary
  console.log("\n\n📊 EXP-001 Summary\n");
  for (const version of versions) {
    const vResults = results[version];
    const total = vResults.length;
    const passed = vResults.filter((r: any) => r.deterministic.passed && r.factScore.criticalFactualFailureCount === 0).length;
    const avgFactScore = vResults.reduce((acc: number, r: any) => acc + r.factScore.factPreservationScore, 0) / total;
    const totalCriticalFailures = vResults.reduce((acc: number, r: any) => acc + r.factScore.criticalFactualFailureCount, 0);
    const avgUnsupported = vResults.reduce((acc: number, r: any) => acc + r.factScore.unsupportedClaimRate, 0) / total;
    
    console.log(`Version ${version}:`);
    console.log(`  Acceptance (Pass/Total):  ${passed}/${total}`);
    console.log(`  Avg Fact Preservation:    ${avgFactScore.toFixed(2)}%`);
    console.log(`  Avg Unsupported Claims:   ${avgUnsupported.toFixed(2)}%`);
    console.log(`  Total Critical Failures:  ${totalCriticalFailures}`);
    console.log(`---------------------------------`);
  }
}

runExperiment();
