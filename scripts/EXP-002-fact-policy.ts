import fs from "fs";
import path from "path";
import { config } from "dotenv";
config({ path: ".env.local" });
config({ path: ".env" });

import datasetFactsV2 from "./datasets/dataset-facts-v2.json";
import { ProductionGenerationAdapter } from "../lib/ai/productionAdapter";
import { evaluateFactPreservation } from "../lib/evaluation/factEvaluator";
import { auditGeneratedFacts } from "../lib/evaluation/factAuditor";
import { evaluateDeterministic } from "../lib/evaluation/evaluator";
import { extractFacts } from "../lib/content/facts/extractor";
import { GenerationInput, GenerationConfig } from "../types/content";
import { normalizeGenerationConfig } from "../lib/content/normalizer";

// Mocking compiler
import * as compilerModule from "../lib/content/prompt/compiler";

const BASELINE_POLICY = compilerModule.compilePrompt;

const VERSION_C1_POLICY = `
FACT LEDGER:
{LEDGER_JSON}
`;

const VERSION_C2_POLICY = `
FACT LEDGER:
{LEDGER_JSON}

## Fact Policy (Conflict-Aware)
Use only the explicitly verified facts provided above.
If facts conflict (marked as "conflicting"), DO NOT resolve, average, infer, or choose between them. State explicitly that the data is conflicting, or omit it entirely if context permits.
Do not invent or fabricate missing claims.
`;

async function runExperiment() {
  console.log("🚀 Starting EXP-002: Conflict-Aware Fact Policy");
  
  const versions = ["A", "C1", "C2"];
  const provider = new ProductionGenerationAdapter();
  const testCases = datasetFactsV2 as any[];

  const results: any = { A: [], C1: [], C2: [] };

  for (const version of versions) {
    console.log(`\n\n=== Running Version ${version} ===\n`);
    
    const originalCompilePrompt = compilerModule.compilePrompt;
    
    // @ts-ignore
    compilerModule.compilePrompt = (cfg) => {
      const base = originalCompilePrompt(cfg);
      if (version === "A") return base;
      
      const ledgerJson = JSON.stringify(cfg.factLedger?.explicit || [], null, 2);
      
      if (version === "C1") {
        return base + "\n\n" + VERSION_C1_POLICY.replace("{LEDGER_JSON}", ledgerJson);
      }
      if (version === "C2") {
        return base + "\n\n" + VERSION_C2_POLICY.replace("{LEDGER_JSON}", ledgerJson);
      }
      return base;
    };

    for (const [index, tc] of testCases.entries()) {
      process.stdout.write(`⏳ [${String(index + 1).padStart(2, "0")}/${testCases.length}] [${tc.category.padEnd(20)}] ${tc.name.slice(0, 20).padEnd(22)} ... `);
      
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
      const factLedger = extractFacts(normalizedConfig);
      
      try {
        let generationResult;
        try {
           generationResult = await provider.generateContent(inputPayload);
        } catch (err: any) {
           console.log(`❌ GENERATION_FAILED: ${err.message}`);
           results[version].push({ status: "GENERATION_FAILED" });
           continue;
        }

        const generatedContent = generationResult.content;
        const detScore = evaluateDeterministic(generatedContent, tc.expectations, tc.input.contentType);
        
        await new Promise(resolve => setTimeout(resolve, 5000)); // Sleep for rate limit

        let factScore;
        let auditResult;
        try {
           factScore = await evaluateFactPreservation(generatedContent, tc.input.rawInput, factLedger);
           await new Promise(resolve => setTimeout(resolve, 5000)); // Sleep for rate limit
           auditResult = await auditGeneratedFacts(generatedContent, tc.input.rawInput, factLedger);
        } catch (err: any) {
           if (err.message === "EVALUATION_FAILED") {
             console.log(`❌ EVALUATION_FAILED`);
             results[version].push({ status: "EVALUATION_FAILED" });
             continue;
           } else {
             throw err;
           }
        }
        
        results[version].push({
          status: "SUCCESS",
          testCaseId: tc.id,
          deterministic: detScore,
          factScore,
          auditResult,
        });

        const criticalFails = factScore.criticalFactualFailureCount + auditResult.criticalUnsupportedClaimCount;
        
        if (detScore.passed && criticalFails === 0 && auditResult.inventedConflictResolutionCount === 0) {
          console.log(`✅ PASS (Det: ${detScore.score}%, Unsupported: ${auditResult.unsupportedClaimCount})`);
        } else {
          console.log(`❌ FAIL (Det: ${detScore.score}%, Critical Fails: ${criticalFails}, Invented Resolutions: ${auditResult.inventedConflictResolutionCount})`);
        }
        
        await new Promise(resolve => setTimeout(resolve, 3000));
      } catch (err: any) {
        console.log(`❌ ERROR: ${err.message}`);
      }
    }
    
    // Restore
    // @ts-ignore
    compilerModule.compilePrompt = originalCompilePrompt;
  }

  // Print Summary
  console.log("\n\n📊 EXP-002 Summary\n");
  for (const version of versions) {
    const vResults = results[version].filter((r: any) => r.status === "SUCCESS");
    const evalFailures = results[version].filter((r: any) => r.status === "EVALUATION_FAILED").length;
    const genFailures = results[version].filter((r: any) => r.status === "GENERATION_FAILED").length;
    
    const total = vResults.length;
    if (total === 0) {
      console.log(`Version ${version}: NO SUCCESSFUL RUNS (GenFails: ${genFailures}, EvalFails: ${evalFailures})`);
      continue;
    }
    
    let passed = 0;
    let totalCriticalFailures = 0;
    let totalInventedResolutions = 0;
    
    for (const r of vResults) {
      const cFails = r.factScore.criticalFactualFailureCount + r.auditResult.criticalUnsupportedClaimCount;
      const iRes = r.auditResult.inventedConflictResolutionCount;
      totalCriticalFailures += cFails;
      totalInventedResolutions += iRes;
      if (r.deterministic.passed && cFails === 0 && iRes === 0) {
        passed++;
      }
    }
    
    const avgFactScore = vResults.reduce((acc: number, r: any) => acc + r.factScore.factPreservationScore, 0) / total;
    
    console.log(`Version ${version}:`);
    console.log(`  Acceptance (Pass/Total):     ${passed}/${total}`);
    console.log(`  Avg Fact Preservation:       ${avgFactScore.toFixed(2)}%`);
    console.log(`  Total Critical Failures:     ${totalCriticalFailures}`);
    console.log(`  Total Invented Resolutions:  ${totalInventedResolutions}`);
    console.log(`  Generation Fails:            ${genFailures}`);
    console.log(`  Evaluation Fails:            ${evalFailures}`);
    console.log(`---------------------------------`);
  }
}

runExperiment();
