/**
 * EXP-006 — Perspective Model v2 Validation/Invalidation Benchmark
 * ────────────────────────────────────────────────────────────────
 * FROZEN: evaluator = v2, dataset = dataset-exp-006.json (independent)
 * Do NOT modify prompt or evaluator during or after this run until
 * failure cases are analysed.
 *
 * Gates (all must pass for v2 to be declared proven):
 *   Persona Accuracy (v2)      >= 80%
 *   Reasoning Separation       >= 80
 *   Causal Separation          >= 80
 *   Worldview Separation       >= 80
 *   Vocabulary-only Swap       <= 15%
 *   Contract Node Coverage     >= 85%
 *   Ablation Delta             >= 25
 *   Cross-topic Consistency    >= 75%
 *   CoT Leakage                = 0
 */

import fs from "fs";
import path from "path";
import { config } from "dotenv";
config({ path: path.join(process.cwd(), ".env.local") });

import { evaluatePersona } from "../lib/evaluation/personaEvaluator";
import { evaluateReasoningSeparation } from "../lib/evaluation/reasoningSeparationEvaluator";
import { evaluateAblationWeighted } from "../lib/evaluation/ablationEvaluator";
import { evaluateContractNodeCoverage } from "../lib/evaluation/contractNodeEvaluator";
import { buildSystemPrompt, buildUserPrompt } from "../lib/content/prompt/compiler";
import { GEMINI_RESPONSE_SCHEMA } from "../supabase/functions/generate/validation/schema";
import { getPersona } from "../lib/content/personas/registry";
import { PERSONA_LETTER_MAP } from "../lib/evaluation/types";
import type { PersonaId } from "../lib/evaluation/types";
import { GoogleGenAI } from "@google/genai";
import type { InputDTO } from "../types/content";

// ─── Frozen configuration ─────────────────────────────────────────────────────

const EVALUATOR_VERSION = "v2" as const; // DO NOT change during EXP-006
const DATASET_PATH = path.join(__dirname, "datasets", "dataset-exp-006.json");
const REPORT_DIR = path.join(__dirname, "benchmark-reports");

// ─── CoT leakage detector ─────────────────────────────────────────────────────
// Deterministic check — no LLM call needed.
// Any of these patterns in the generated output = CoT bleed.

const COT_LEAK_PATTERNS = [
  /<thinking>/i,
  /<\/thinking>/i,
  /<step>/i,
  /<reasoning>/i,
  /\[thinking\]/i,
  /Step \d+:/i,
  /First, I will/i,
  /Let me think/i,
  /\u0623\u0648\u0644\u0627\u064b\u060c \u0633\u0623\u0642\u0648\u0645/i,
  /\u062f\u0639\u0646\u064a \u0623\u0641\u0643\u0631/i,
];

function detectCotLeakage(text: string): boolean {
  return COT_LEAK_PATTERNS.some((pattern) => pattern.test(text));
}

// ─── AI client ────────────────────────────────────────────────────────────────

const ai = new GoogleGenAI({
  vertexai: true,
  apiKey: process.env.VERTEX_AI_API_KEY,
});

async function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function extractFullText(jsonString: string): string {
  try {
    const parsed = JSON.parse(jsonString);
    return `${parsed.title}\n\n${parsed.hook}\n\n${parsed.body}\n\n${parsed.callToAction}`;
  } catch {
    return jsonString;
  }
}

async function generateContent(input: InputDTO): Promise<string> {
  let retries = 10;
  while (retries > 0) {
    try {
      const systemInstruction = buildSystemPrompt(input as any);
      const userPrompt = buildUserPrompt();

      const personaCfg = (input as any).metadata?.persona;
      if (personaCfg) {
        const expectedMarker =
          personaCfg.perspectiveVersion === "v1"
            ? "<perspective_constraint>"
            : "<reasoning_contract>";
        if (!systemInstruction.includes(expectedMarker)) {
          throw new Error(
            `INSTRUMENTATION FAILURE: expected ${expectedMarker} in the prompt but it is missing — aborting the entire run.`
          );
        }
      }
      const response = await ai.models.generateContent({
        model: "gemini-3.1-flash-lite",
        contents: userPrompt,
        config: {
          systemInstruction,
          responseMimeType: "application/json",
          responseSchema: GEMINI_RESPONSE_SCHEMA,
          temperature: 0.7,
        },
      });
      return response.text!;
    } catch (e: any) {
      if (e?.status === 429 && retries > 1) {
        console.log(
          `     [Rate Limit / Gen] 429 — waiting 20s (${retries} left)...`
        );
        await delay(20000);
        retries--;
      } else {
        throw e;
      }
    }
  }
  throw new Error("Max retries exceeded in generateContent");
}

async function withRetry<T>(fn: () => Promise<T>): Promise<T> {
  let retries = 10;
  while (retries > 0) {
    try {
      return await fn();
    } catch (e: any) {
      if (e?.status === 429 && retries > 1) {
        console.log(
          `     [Rate Limit / Eval] 429 — waiting 20s (${retries} left)...`
        );
        await delay(20000);
        retries--;
      } else {
        throw e;
      }
    }
  }
  throw new Error("Max retries exceeded in withRetry");
}

// ─── Main runner ──────────────────────────────────────────────────────────────

async function runExp006Reeval() {
  const dataset = JSON.parse(fs.readFileSync(DATASET_PATH, "utf-8"));

  const isSample = process.env.EXP_006_SAMPLE === "true";
  const allPersonas: PersonaId[] = dataset.personas as PersonaId[];
  const allTopics: Array<{ id: string; name: string; prompt: string }> = dataset.topics;

  let matrix = allTopics.flatMap((topic) =>
    allPersonas.map((persona) => ({ topic, persona, platform: "linkedin" as const }))
  );

  if (isSample) {
    matrix = matrix.slice(0, 4);
    console.log(`WARNING: SAMPLE MODE — running only ${matrix.length} cases`);
  }

  console.log(
    `\nEXP-006 Re-Evaluation — ${matrix.length} cases | evaluator frozen at ${EVALUATOR_VERSION}`
  );
  console.log(`   Dataset: ${dataset.name} (v${dataset.version})\n`);

  interface CaseResult {
    caseId: string;
    topic: string;
    persona: PersonaId;
    v1_accuracy: boolean;
    v2_accuracy: boolean;
    v1_topic_leakage_risk: number;
    v2_topic_leakage_risk: number;
    reasoning_separation: number;
    causal_separation: number;
    worldview_separation: number;
    vocab_only_swap: boolean;
    ablation_delta: number;
    ablation_causal: number;
    ablation_reasoning: number;
    ablation_worldview: number;
    node_coverage_pct: number;
    node_coverage_details: string;
    cot_leakage_v1: boolean;
    cot_leakage_v2: boolean;
  }

  const results: CaseResult[] = [];

  for (let i = 0; i < matrix.length; i++) {
    const { topic, persona, platform } = matrix[i];
    const caseId = `C${(i + 1).toString().padStart(3, "0")}-${persona}-${topic.id}`;
    const expectedLetter = PERSONA_LETTER_MAP[persona];

    console.log(`\n[${i + 1}/${matrix.length}] ${caseId}`);

    const basePersona = getPersona(persona);
    if (!basePersona) throw new Error(`Persona '${persona}' not found in registry`);

    // Generate V1
    console.log(`   -> Generating V1...`);
    const inputV1: any = {
      rawInput: topic.prompt,
      platform,
      contentType: "social_post",
      mode: "creator",
      arabicStyle: "white_arabic",
      metadata: {
        persona: { ...basePersona, usePerspectiveConstraint: true, perspectiveVersion: "v1" },
        style: "storytelling",
        intent: "education",
        originality: "creative",
      },
    };
    const rawV1 = await generateContent(inputV1);
    const textV1 = extractFullText(rawV1);
    await delay(2000);

    // Generate V2
    console.log(`   -> Generating V2...`);
    const inputV2: any = {
      ...inputV1,
      metadata: {
        ...inputV1.metadata,
        persona: { ...basePersona, usePerspectiveConstraint: true, perspectiveVersion: "v2" },
      },
    };
    const rawV2 = await generateContent(inputV2);
    const textV2 = extractFullText(rawV2);
    await delay(2000);

    // CoT Leakage (deterministic)
    const cotV1 = detectCotLeakage(textV1);
    const cotV2 = detectCotLeakage(textV2);
    if (cotV1 || cotV2) console.log(`   WARNING: CoT leakage! V1=${cotV1}, V2=${cotV2}`);

    // Persona accuracy (evaluator frozen at v2)
    // evaluatePersona returns predicted_persona in {A,B,C,D}
    console.log(`   -> Evaluating persona accuracy (evaluator ${EVALUATOR_VERSION})...`);
    const evalV1 = await withRetry(() => evaluatePersona(textV1, EVALUATOR_VERSION));
    await delay(2000);
    const evalV2 = await withRetry(() => evaluatePersona(textV2, EVALUATOR_VERSION));
    await delay(2000);

    const v1Match = evalV1.predicted_persona === expectedLetter;
    const v2Match = evalV2.predicted_persona === expectedLetter;
    console.log(`   -> V1 predicted=${evalV1.predicted_persona} expected=${expectedLetter} match=${v1Match} leak_risk=${evalV1.topic_leakage_risk}`);
    console.log(`   -> V2 predicted=${evalV2.predicted_persona} expected=${expectedLetter} match=${v2Match} leak_risk=${evalV2.topic_leakage_risk}`);

    // Reasoning separation (V1 text vs V2 text, same persona)
    // Signature: evaluateReasoningSeparation(textA, personaA, textB, personaB)
    console.log(`   -> Evaluating reasoning separation (V1 vs V2)...`);
    const sep = await withRetry(() =>
      evaluateReasoningSeparation(textV1, persona, textV2, persona)
    );
    await delay(2000);
    console.log(`   -> Separation=${sep.separation_score} vocab_only=${sep.is_vocabulary_only_swap}`);

    // Ablation on V2 text
    // Return: { ablatedText, signals, weightedScore, isVocabularyOnly, blindClassificationAfterAblation }
    console.log(`   -> Evaluating ablation (V2)...`);
    const ablation = await withRetry(() => evaluateAblationWeighted(textV2, persona));
    await delay(2000);
    console.log(`   -> Ablation delta=${ablation.weightedScore} causal=${ablation.signals.causal_model_delta}`);

    // Contract node coverage on V2 text
    console.log(`   -> Evaluating contract node coverage (V2)...`);
    const coverage = await withRetry(() => evaluateContractNodeCoverage(textV2, persona));
    await delay(2000);
    const nodeCoveragePct = (coverage.nodes_found / 5) * 100;
    console.log(`   -> Nodes ${coverage.nodes_found}/5 (${nodeCoveragePct.toFixed(0)}%)`);

    results.push({
      caseId,
      topic: topic.id,
      persona,
      v1_accuracy: v1Match,
      v2_accuracy: v2Match,
      v1_topic_leakage_risk: evalV1.topic_leakage_risk ?? 0,
      v2_topic_leakage_risk: evalV2.topic_leakage_risk ?? 0,
      reasoning_separation: sep.separation_score,
      causal_separation: ablation.signals.causal_model_delta,
      worldview_separation: ablation.signals.worldview_framing_delta,
      vocab_only_swap: sep.is_vocabulary_only_swap,
      ablation_delta: ablation.weightedScore,
      ablation_causal: ablation.signals.causal_model_delta,
      ablation_reasoning: ablation.signals.reasoning_structure_delta,
      ablation_worldview: ablation.signals.worldview_framing_delta,
      node_coverage_pct: nodeCoveragePct,
      node_coverage_details: coverage.details,
      cot_leakage_v1: cotV1,
      cot_leakage_v2: cotV2,
    });
  }

  // Aggregate
  const n = results.length;
  const v1AccuracyPct = (results.filter((r) => r.v1_accuracy).length / n) * 100;
  const v2AccuracyPct = (results.filter((r) => r.v2_accuracy).length / n) * 100;
  const avgReasoningSep = results.reduce((s, r) => s + r.reasoning_separation, 0) / n;
  const avgCausalSep = results.reduce((s, r) => s + r.causal_separation, 0) / n;
  const avgWorldviewSep = results.reduce((s, r) => s + r.worldview_separation, 0) / n;
  const vocabOnlySwapRate = (results.filter((r) => r.vocab_only_swap).length / n) * 100;
  const avgNodeCoverage = results.reduce((s, r) => s + r.node_coverage_pct, 0) / n;
  const avgAblationDelta = results.reduce((s, r) => s + r.ablation_delta, 0) / n;
  const cotLeakageCount = results.filter((r) => r.cot_leakage_v2).length;

  // Cross-topic consistency: per-persona % where v2 was correctly classified.
  // Gate = min across personas >= 75%.
  const crossTopicConsistencyPerPersona: Record<string, number> = {};
  for (const persona of allPersonas) {
    const pc = results.filter((r) => r.persona === persona);
    if (pc.length === 0) continue;
    crossTopicConsistencyPerPersona[persona] =
      (pc.filter((r) => r.v2_accuracy).length / pc.length) * 100;
  }
  const minCrossTopicConsistency =
    Object.values(crossTopicConsistencyPerPersona).length > 0
      ? Math.min(...Object.values(crossTopicConsistencyPerPersona))
      : 0;

  // Topic leakage sanity: avg leakage_risk on correct v2 cases
  const correctV2 = results.filter((r) => r.v2_accuracy);
  const avgLeakageRiskOnCorrect =
    correctV2.length > 0
      ? correctV2.reduce((s, r) => s + r.v2_topic_leakage_risk, 0) / correctV2.length
      : 0;

  // Gates
  const gates = {
    persona_accuracy_v2: v2AccuracyPct >= 80,
    reasoning_separation: avgReasoningSep >= 80,
    causal_separation: avgCausalSep >= 80,
    worldview_separation: avgWorldviewSep >= 80,
    vocab_only_swap: vocabOnlySwapRate <= 15,
    contract_node_coverage: avgNodeCoverage >= 85,
    ablation_delta: avgAblationDelta >= 25,
    cross_topic_consistency: minCrossTopicConsistency >= 75,
    cot_leakage: cotLeakageCount === 0,
  };

  const allGatesPassed = Object.values(gates).every(Boolean);

  // Write report
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const reportPath = path.join(REPORT_DIR, `exp-006-reeval-${timestamp}.json`);

  const report = {
    metadata: {
      name: "EXP-006 Re-Evaluation",
      timestamp,
      evaluatorVersion: EVALUATOR_VERSION,
      dataset: dataset.name,
      datasetVersion: dataset.version,
      cases: n,
      sampleMode: isSample,
    },
    summary: {
      "Persona Accuracy (V1)": +v1AccuracyPct.toFixed(1),
      "Persona Accuracy (V2)": +v2AccuracyPct.toFixed(1),
      "Reasoning Separation": +avgReasoningSep.toFixed(1),
      "Causal Separation": +avgCausalSep.toFixed(1),
      "Worldview Separation": +avgWorldviewSep.toFixed(1),
      "Vocabulary-only Swap Rate": +vocabOnlySwapRate.toFixed(1),
      "Contract Node Coverage": +avgNodeCoverage.toFixed(1),
      "Ablation Delta": +avgAblationDelta.toFixed(1),
      "Cross-topic Consistency (min per-persona)": +minCrossTopicConsistency.toFixed(1),
      "CoT Leakage Count": cotLeakageCount,
      "Avg Topic Leakage Risk (on correct v2 cases)": +avgLeakageRiskOnCorrect.toFixed(1),
    },
    crossTopicConsistencyPerPersona,
    gates,
    verdict: allGatesPassed ? "PASS -- v2 PROVEN" : "FAIL -- v2 not proven",
    cases: results,
  };

  fs.mkdirSync(REPORT_DIR, { recursive: true });
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2), "utf-8");

  // Console summary
  const TARGET: Record<string, string> = {
    "Persona Accuracy (V2)": ">= 80%",
    "Reasoning Separation": ">= 80",
    "Causal Separation": ">= 80",
    "Worldview Separation": ">= 80",
    "Vocabulary-only Swap Rate": "<= 15%",
    "Contract Node Coverage": ">= 85%",
    "Ablation Delta": ">= 25",
    "Cross-topic Consistency (min per-persona)": ">= 75%",
    "CoT Leakage Count": "= 0",
  };

  const GATE_KEYS: Record<string, keyof typeof gates> = {
    "Persona Accuracy (V2)": "persona_accuracy_v2",
    "Reasoning Separation": "reasoning_separation",
    "Causal Separation": "causal_separation",
    "Worldview Separation": "worldview_separation",
    "Vocabulary-only Swap Rate": "vocab_only_swap",
    "Contract Node Coverage": "contract_node_coverage",
    "Ablation Delta": "ablation_delta",
    "Cross-topic Consistency (min per-persona)": "cross_topic_consistency",
    "CoT Leakage Count": "cot_leakage",
  };

  console.log("\n" + "=".repeat(62));
  console.log("  EXP-006 Results");
  console.log("=".repeat(62));

  for (const [label, target] of Object.entries(TARGET)) {
    const key = GATE_KEYS[label];
    const value = (report.summary as any)[label];
    const passed = gates[key];
    console.log(
      `  ${passed ? "[PASS]" : "[FAIL]"}  ${label.padEnd(44)} ${String(value).padStart(6)}  (${target})`
    );
  }

  console.log("\n  Cross-topic consistency per persona:");
  for (const [p, pct] of Object.entries(crossTopicConsistencyPerPersona)) {
    console.log(
      `         ${pct >= 75 ? "[PASS]" : "[FAIL]"}  ${p.padEnd(14)} ${pct.toFixed(0)}%`
    );
  }

  console.log(`\n  V1 Accuracy (reference only): ${v1AccuracyPct.toFixed(1)}%`);
  console.log(`  Avg topic leakage risk on correct v2 cases: ${avgLeakageRiskOnCorrect.toFixed(1)}`);
  console.log("\n" + "=".repeat(62));
  console.log(`  ${report.verdict}`);
  console.log("=".repeat(62));
  console.log(`\n  Report saved -> ${reportPath}\n`);
}

runExp006Reeval().catch((e) => {
  console.error("EXP-006 fatal error:", e);
  process.exit(1);
});

