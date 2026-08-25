import * as fs from "fs";
import * as path from "path";
import { config } from "dotenv";
config({ path: path.join(process.cwd(), ".env.local") });

import { GoogleGenAI, Type } from "@google/genai";
import { evaluatePersona } from "../lib/evaluation/personaEvaluator";
import { evaluateAblationWeighted } from "../lib/evaluation/ablationEvaluator";

const ai = new GoogleGenAI({
  vertexai: true,
  apiKey: process.env.VERTEX_AI_API_KEY,
});

// ─── Path to EXP-010A report ────────────────────────────────────────────────
const EXP_010A_REPORT = path.join(
  __dirname,
  "benchmark-reports",
  "exp-010A-topology-1787539531361.json"
);

async function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const retryEval = async <T>(fn: () => Promise<T>): Promise<T> => {
  let retries = 10;
  while (retries > 0) {
    try { return await fn(); }
    catch (e: any) {
      if (e?.status === 429 && retries > 1) {
        console.log(`     [Rate Limit] 429 hit. Waiting 20s...`);
        await delay(20000);
        retries--;
      } else throw e;
    }
  }
  throw new Error("Max retries exceeded");
};

// ─── SCHEMAS ────────────────────────────────────────────────────────────────
const CONTENT_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    title: { type: Type.STRING },
    hook: { type: Type.STRING },
    body: { type: Type.STRING },
    closing: { type: Type.STRING },
  },
  required: ["title", "hook", "body", "closing"]
};

const FIDELITY_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    structural_fidelity: { type: Type.NUMBER },
    invented_mechanisms: { type: Type.NUMBER },
    missing_nodes: { type: Type.ARRAY, items: { type: Type.STRING } },
    renderer_drift_detected: { type: Type.BOOLEAN },
    evidence: { type: Type.STRING }
  },
  required: ["structural_fidelity", "invented_mechanisms", "missing_nodes", "renderer_drift_detected", "evidence"]
};

const IR_PURITY_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    structural_purity: { type: Type.NUMBER },
    psychology_leakage: { type: Type.NUMBER },
    developer_leakage: { type: Type.NUMBER },
    intellectual_leakage: { type: Type.NUMBER },
    creative_leakage: { type: Type.NUMBER },
    overall_purity: { type: Type.NUMBER },
  },
  required: ["structural_purity", "psychology_leakage", "developer_leakage", "intellectual_leakage", "creative_leakage", "overall_purity"]
};

// ─── 1. BLIND RENDERER ──────────────────────────────────────────────────────
async function renderFromGraph(graph: any): Promise<string> {
  const prompt = `You are an Arabic Content Renderer.
Your ONLY job is to faithfully translate the provided Causal Graph into a well-written Arabic social media post.

STRICT RULES:
1. Follow the causal sequence in the graph exactly.
2. DO NOT add causal claims that are not in the graph.
3. DO NOT remove causal claims from the graph.
4. DO NOT reinterpret the graph through a different worldview.
5. DO NOT introduce new mechanisms or motives.
6. Language: Arabic (الفصحى البيضاء). Style: professional and engaging.
7. The closing MUST reflect the final node's claim.

Causal Graph (JSON):
${JSON.stringify(graph, null, 2)}
`;

  const response = await retryEval(() => ai.models.generateContent({
    model: "gemini-3.1-flash-lite",
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: CONTENT_SCHEMA as any,
      temperature: 0.6
    }
  }));

  const data = JSON.parse(response.text!);
  return `${data.title}\n\n${data.hook}\n\n${data.body}\n\n${data.closing}`;
}

// ─── 2. IR PURITY EVALUATOR (independent LLM call) ─────────────────────────
async function evaluateIRPurity(graph: any, targetPersona: string) {
  const prompt = `You are an IR Purity Auditor.
Assess the Causal Graph for cross-persona contamination.
Target persona: ${targetPersona.toUpperCase()}

Graph:
${JSON.stringify(graph, null, 2)}

Score each leakage type from 0 to 100 (0=no leakage, 100=completely leaked).
Score 'structural_purity' from 0 to 100 (100=perfectly follows target topology).
Score 'overall_purity' from 0 to 100.
`;

  const response = await retryEval(() => ai.models.generateContent({
    model: "gemini-3.1-flash-lite",
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: IR_PURITY_SCHEMA as any,
      temperature: 0.1
    }
  }));

  return JSON.parse(response.text!);
}

// ─── 3. SURFACE FIDELITY EVALUATOR ──────────────────────────────────────────
async function evaluateSurfaceFidelity(graph: any, text: string) {
  const prompt = `You are a Surface Fidelity Auditor.
Compare the generated text against the source Causal Graph.

Source Graph:
${JSON.stringify(graph, null, 2)}

Generated Text:
${text}

Score 'structural_fidelity' from 0.0 to 1.0.
Count 'invented_mechanisms' (causal claims in text NOT in graph).
List 'missing_nodes' (graph nodes not represented in text).
Set 'renderer_drift_detected' = true if text introduces a new worldview/framing.
`;

  const response = await retryEval(() => ai.models.generateContent({
    model: "gemini-3.1-flash-lite",
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: FIDELITY_SCHEMA as any,
      temperature: 0.1
    }
  }));

  return JSON.parse(response.text!);
}

// ─── ATTRIBUTION LOGIC ───────────────────────────────────────────────────────
function computeAttribution(
  repairAttempts: number,
  irPurity: any,
  fidelity: any,
  isPersonaMatch: boolean
) {
  return {
    planner_failure: irPurity.overall_purity < 80,
    validator_drift: repairAttempts > 0 && irPurity.overall_purity >= 80,
    repair_failure: repairAttempts >= 3 && irPurity.overall_purity < 80,
    renderer_drift: fidelity.renderer_drift_detected || fidelity.structural_fidelity < 0.9,
    evaluator_collision: irPurity.overall_purity >= 80 && fidelity.structural_fidelity >= 0.9 && !isPersonaMatch
  };
}

// ─── EXP-010B RUNNER ────────────────────────────────────────────────────────
async function runExp010B() {
  const exp010aData = JSON.parse(fs.readFileSync(EXP_010A_REPORT, "utf-8"));
  const cases = exp010aData.cases;

  // ─── Resume Logic ──────────────────────────────────────────────────────────
  // Find the latest existing 010B report to resume from
  const reportsDir = path.join(__dirname, "benchmark-reports");
  const existingReports = fs.readdirSync(reportsDir)
    .filter(f => f.startsWith("exp-010B-rendering-"))
    .sort()
    .reverse();

  let reportPath: string;
  let results: any;
  let processedKeys: Set<string>;

  if (existingReports.length > 0) {
    reportPath = path.join(reportsDir, existingReports[0]);
    results = JSON.parse(fs.readFileSync(reportPath, "utf-8"));
    processedKeys = new Set(results.cases.map((c: any) => `${c.topic_id}-${c.persona}`));
    console.log(`🔄 Resuming from: ${existingReports[0]}`);
    console.log(`   Already processed: ${processedKeys.size} / ${cases.length} cases\n`);
  } else {
    reportPath = path.join(reportsDir, `exp-010B-rendering-${Date.now()}.json`);
    processedKeys = new Set<string>();
    console.log(`🚀 Starting EXP-010B: Rendering Validation (${cases.length} cases)`);
    console.log(`   (9 repaired cases will be flagged as monitoring group)\n`);
  }

  // If fresh start, initialize results structure
  if (!results) {
    results = {
      summary: {
        total: 0, repaired_cases_count: 0,
        avg_ir_purity: 0, avg_surface_fidelity: 0, avg_persona_accuracy: 0,
        avg_ablation_delta: 0, collision_rate: "0%", composite_score: 0,
        attribution_breakdown: { planner_failures: 0, validator_drift: 0, renderer_drift: 0, evaluator_collisions: 0 },
        collision_matrix: {
          developer: { developer: 0, psychology: 0, intellectual: 0, creative: 0 },
          psychology: { developer: 0, psychology: 0, intellectual: 0, creative: 0 },
          intellectual: { developer: 0, psychology: 0, intellectual: 0, creative: 0 },
          creative: { developer: 0, psychology: 0, intellectual: 0, creative: 0 }
        },
        repaired_group: { avg_persona_accuracy: 0, avg_surface_fidelity: 0, count: 0 }
      },
      cases: []
    };
  }

  let totalIRPurity = 0;
  let totalFidelity = 0;
  let totalPersonaAccuracyCorrect = 0;
  let totalAblation = 0;
  let repairedGroupCorrect = 0;
  let repairedGroupFidelity = 0;
  const repairedCaseCount = cases.filter((c: any) => c.repair_attempts > 0).length;

  for (const c010a of cases) {
    const { persona, topic_id, category, final_graph, repair_attempts } = c010a;
    const isRepaired = repair_attempts > 0;
    const caseKey = `${topic_id}-${persona}`;

    // Skip already-processed cases (resume mode)
    if (processedKeys.has(caseKey)) {
      process.stdout.write(`   [${topic_id}] ${persona} ✅ (skipped — already done)\n`);
      continue;
    }

    process.stdout.write(`   [${topic_id}] ${persona}${isRepaired ? " (repaired)" : ""}... `);
    results.summary.total++;
    if (isRepaired) results.summary.repaired_cases_count++;

    // Step 1: IR Purity (independent LLM auditor)
    const irPurity = await retryEval(() => evaluateIRPurity(final_graph, persona));
    await delay(1500);

    // Step 2: Blind Render
    const text = await renderFromGraph(final_graph);
    await delay(1500);

    // Step 3: Surface Fidelity
    const fidelity = await retryEval(() => evaluateSurfaceFidelity(final_graph, text));
    await delay(1500);

    // Step 4: Persona Evaluation
    const personaEval = await retryEval(() => evaluatePersona(text, "v2"));
    await delay(1500);

    // Step 5: Ablation
    const ablation = await retryEval(() => evaluateAblationWeighted(text, persona as any));
    await delay(1500);

    const mapAtoD: Record<string, string> = { a: "developer", b: "psychology", c: "intellectual", d: "creative" };
    const rawPredicted = personaEval.predicted_persona?.toLowerCase() || "unknown";
    const predicted = mapAtoD[rawPredicted] || rawPredicted;
    const isMatch = predicted === persona.toLowerCase();

    // Collision matrix
    if (results.summary.collision_matrix[persona]) {
      const p = predicted as keyof typeof results.summary.collision_matrix[typeof persona];
      if (results.summary.collision_matrix[persona][p] !== undefined) {
        results.summary.collision_matrix[persona][p]++;
      }
    }

    // Attribution
    const attribution = computeAttribution(repair_attempts, irPurity, fidelity, isMatch);

    // Accumulate
    totalIRPurity += irPurity.overall_purity;
    totalFidelity += fidelity.structural_fidelity;
    if (isMatch) totalPersonaAccuracyCorrect++;
    totalAblation += ablation.weightedScore || 0;

    if (isRepaired) {
      repairedGroupCorrect += isMatch ? 1 : 0;
      repairedGroupFidelity += fidelity.structural_fidelity;
    }

    // Attribution breakdown
    if (attribution.planner_failure) results.summary.attribution_breakdown.planner_failures++;
    if (attribution.validator_drift) results.summary.attribution_breakdown.validator_drift++;
    if (attribution.renderer_drift) results.summary.attribution_breakdown.renderer_drift++;
    if (attribution.evaluator_collision) results.summary.attribution_breakdown.evaluator_collisions++;

    console.log(`Persona Match: ${isMatch ? "✅" : "❌ -> " + predicted} | IR Purity: ${irPurity.overall_purity} | Fidelity: ${fidelity.structural_fidelity.toFixed(2)}`);

    results.cases.push({
      topic_id,
      category,
      persona,
      is_repaired_case: isRepaired,
      repair_attempts,
      initial_ir: c010a.initial_ir || {},
      final_ir: final_graph,
      initial_validation: c010a.initial_validation || {},
      final_validation: c010a.final_validation || {},
      ir_purity: irPurity,
      renderer: {
        text,
        fidelity_to_ir: fidelity.structural_fidelity,
        invented_mechanisms: fidelity.invented_mechanisms,
        missing_nodes: fidelity.missing_nodes,
        renderer_drift_detected: fidelity.renderer_drift_detected
      },
      persona_evaluation: {
        predicted,
        confidence: personaEval.confidence || 0,
        is_match: isMatch
      },
      ablation: {
        delta: ablation.weightedScore || 0,
      },
      attribution
    });

    // Save incrementally
    fs.writeFileSync(reportPath, JSON.stringify(results, null, 2));
  }

  const total = results.summary.total;
  results.summary.avg_ir_purity = (totalIRPurity / total).toFixed(1);
  results.summary.avg_surface_fidelity = (totalFidelity / total).toFixed(2);
  results.summary.avg_persona_accuracy = ((totalPersonaAccuracyCorrect / total) * 100).toFixed(1) + "%";
  results.summary.avg_ablation_delta = (totalAblation / total).toFixed(1);
  results.summary.collision_rate = (((total - totalPersonaAccuracyCorrect) / total) * 100).toFixed(1) + "%";
  results.summary.composite_score = (
    (totalIRPurity / total / 100) *
    (totalFidelity / total) *
    (totalPersonaAccuracyCorrect / total)
  ).toFixed(3);

  if (repairedCaseCount > 0) {
    results.summary.repaired_group.count = repairedCaseCount;
    results.summary.repaired_group.avg_persona_accuracy = ((repairedGroupCorrect / repairedCaseCount) * 100).toFixed(1) + "%";
    results.summary.repaired_group.avg_surface_fidelity = (repairedGroupFidelity / repairedCaseCount).toFixed(2);
  }

  fs.writeFileSync(reportPath, JSON.stringify(results, null, 2));

  console.log(`\n✅ EXP-010B Complete. Report saved to: ${reportPath}`);
  console.log("\n=== SUMMARY ===");
  console.log(JSON.stringify(results.summary, null, 2));
}

runExp010B().catch(console.error);

