/**
 * EXP-011A — Feature Sufficiency Analysis (with Counterfactual)
 *
 * For each failed case (Intellectual or Creative predicted as Developer),
 * runs an independent evaluator that:
 *  1. Identifies Developer-leak signals.
 *  2. Identifies missing target-persona signals.
 *  3. Proposes counterfactual: which 1-2 node CLAIMS to change and how.
 *  4. Predicts whether the change SHOULD alter surface identity.
 *  5. Computes developer_likeness_score and identity_margin.
 *
 * The counterfactual proposals feed directly into EXP-011B.
 * We can later verify: did the proposals ACTUALLY work?
 */

import * as fs from "fs";
import * as path from "path";
import { config } from "dotenv";
config({ path: path.join(process.cwd(), ".env.local") });

import { Type } from "@google/genai";
import { callAI, MODEL } from "./lib/aiClient";

const EXP_010B_REPORT = path.join(
  __dirname,
  "benchmark-reports",
  "exp-010B-rendering-1787542225904.json"
);

// ─── Schema ─────────────────────────────────────────────────────────────────
const FEATURE_SUFFICIENCY_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    target_persona: { type: Type.STRING },
    predicted_as: { type: Type.STRING },
    developer_likeness_score: { type: Type.NUMBER }, // 0.0 – 1.0
    identity_margin: {
      type: Type.NUMBER,
      description: "target_persona_score - highest_competing_score. Negative = collision."
    },
    persona_scores: {
      type: Type.OBJECT,
      description: "Estimated probability that a blind reader would assign each persona.",
      properties: {
        developer: { type: Type.NUMBER },
        psychology: { type: Type.NUMBER },
        intellectual: { type: Type.NUMBER },
        creative: { type: Type.NUMBER }
      },
      required: ["developer", "psychology", "intellectual", "creative"]
    },
    developer_leak_signals: {
      type: Type.ARRAY,
      description: "Specific node claim phrases or edge patterns that make this read as Developer.",
      items: { type: Type.STRING }
    },
    missing_identity_signals: {
      type: Type.ARRAY,
      description: "Signals the target persona SHOULD have but are absent.",
      items: { type: Type.STRING }
    },
    collision_causes: {
      type: Type.ARRAY,
      description: "Root-cause explanations for the Developer collapse.",
      items: { type: Type.STRING }
    },
    counterfactual_mutations: {
      type: Type.ARRAY,
      description: "Max 2 specific claim/evidence changes (not topology changes) that would make this graph identity-discriminative.",
      items: {
        type: Type.OBJECT,
        properties: {
          node_id: { type: Type.STRING },
          field: { type: Type.STRING, enum: ["claim", "evidence"] },
          current_value: { type: Type.STRING },
          proposed_value: { type: Type.STRING },
          rationale: { type: Type.STRING },
          predicted_identity_shift: { type: Type.STRING }
        },
        required: ["node_id", "field", "current_value", "proposed_value", "rationale", "predicted_identity_shift"]
      }
    }
  },
  required: [
    "target_persona", "predicted_as", "developer_likeness_score", "identity_margin",
    "persona_scores", "developer_leak_signals", "missing_identity_signals",
    "collision_causes", "counterfactual_mutations"
  ]
};

// ─── Persona identity reference ──────────────────────────────────────────────
const PERSONA_IDENTITY = {
  intellectual: `
INTELLECTUAL identity — text must feel like:
- Starts from widely-held assumption → challenges it.
- Conclusion REDEFINES the question. It does NOT propose a fix.
- 'synthesis' = paradigm shift, NOT recommendation.
- 'reframe' = WHY the original framing was wrong, not how to improve it.
- FORBIDDEN: "to fix X", "the solution is", "we should", "this improves", "you can".
- REQUIRED: reader feels the original question was wrong — not that they know the answer.
`,
  creative: `
CREATIVE identity — text must feel like:
- Starts from a concrete physical scene with sensory detail.
- 'association' = unexpected, non-logical leap.
- 'transformation' = represented through image/action, NOT explanation.
- Ends by returning to the original physical scene (echo, not conclusion).
- FORBIDDEN: explicit recommendations, problem/solution framing, optimization language.
- REQUIRED: reader experiences a perceptual shift through imagery, not argument.
`,
  developer: `
DEVELOPER identity — text feels like:
- Systems with inputs, outputs, bottlenecks.
- Root causes and failure modes.
- Structural fixes, rules, trade-offs.
- Conclusions feel like an algorithm or diagnostic finding.
`
};

// ─── Analyzer ────────────────────────────────────────────────────────────────
async function analyzeCase(c: any): Promise<any> {
  const prompt = `You are an expert IR Identity Analyst. This is a DIAGNOSTIC task.

A Causal Graph was built for the TARGET persona below.
After faithful Blind Rendering (translator was blind to persona), the resulting text 
was MISCLASSIFIED as DEVELOPER by an independent evaluator.

Your task: Find EXACTLY WHY this graph collapses into Developer-sounding prose.

Target Persona: ${c.persona.toUpperCase()}
Predicted As: DEVELOPER (wrong)

DEVELOPER signals (what we do NOT want):
${PERSONA_IDENTITY.developer}

REQUIRED signals for ${c.persona.toUpperCase()}:
${PERSONA_IDENTITY[c.persona as keyof typeof PERSONA_IDENTITY]}

The IR Graph:
${JSON.stringify(c.final_ir || c.final_graph, null, 2)}

DIAGNOSTIC QUESTIONS:
1. What specific claim phrases or edge patterns make this graph read as Developer? (developer_leak_signals)
2. What signals that ${c.persona.toUpperCase()} MUST have are missing? (missing_identity_signals)
3. What are the root causes of the Developer collapse? (collision_causes)
4. COUNTERFACTUAL: Propose max 2 specific changes to 'claim' or 'evidence' fields only.
   - NO new nodes. NO new edges. NO topology changes.
   - Only change the TEXT CONTENT of existing node claims or evidence.
   - Each change must target a specific node_id from the graph.
   - Predict whether this change WOULD shift the text's identity.
5. Estimate how a blind reader would score each persona (persona_scores, must sum to ~1.0).
6. identity_margin = target_persona_score - highest_competing_score (will be negative for failed cases).
`;

  const text = await callAI({
    model: MODEL.EVALUATION,
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: FEATURE_SUFFICIENCY_SCHEMA as any,
      temperature: 0.15
    }
  });

  return JSON.parse(text);
}

// ─── Runner ──────────────────────────────────────────────────────────────────
async function runExp011A() {
  const data = JSON.parse(fs.readFileSync(EXP_010B_REPORT, "utf-8"));
  const allCases: any[] = data.cases;

  const failedCases = allCases.filter(c =>
    (c.persona === "intellectual" || c.persona === "creative") &&
    !c.persona_evaluation?.is_match
  );

  console.log(`🔬 EXP-011A: Feature Sufficiency Analysis`);
  console.log(`   ${failedCases.length} failed cases: ${failedCases.filter(c => c.persona === "intellectual").length} Intellectual, ${failedCases.filter(c => c.persona === "creative").length} Creative\n`);

  const reportPath = path.join(
    __dirname, "benchmark-reports", `exp-011A-feature-sufficiency-${Date.now()}.json`
  );

  const leakFreq: Record<string, number> = {};
  const missingFreq: Record<string, number> = {};
  const causeFreq: Record<string, number> = {};
  const allResults: any[] = [];
  let totalMargin = 0;

  for (const c of failedCases) {
    process.stdout.write(`   [${c.topic_id}] ${c.persona}... `);
    const analysis = await analyzeCase(c);
    totalMargin += analysis.identity_margin;

    for (const s of analysis.developer_leak_signals) leakFreq[s] = (leakFreq[s] || 0) + 1;
    for (const s of analysis.missing_identity_signals) missingFreq[s] = (missingFreq[s] || 0) + 1;
    for (const c2 of analysis.collision_causes) causeFreq[c2] = (causeFreq[c2] || 0) + 1;

    console.log(`Likeness: ${(analysis.developer_likeness_score * 100).toFixed(0)}% | Margin: ${analysis.identity_margin.toFixed(2)}`);

    allResults.push({
      topic_id: c.topic_id,
      category: c.category,
      persona: c.persona,
      predicted: c.persona_evaluation?.predicted,
      analysis
    });

    fs.writeFileSync(reportPath, JSON.stringify({ summary: {}, cases: allResults }, null, 2));
    await new Promise(r => setTimeout(r, 800));
  }

  const sortDesc = (obj: Record<string, number>) =>
    Object.entries(obj).sort((a, b) => b[1] - a[1]);

  const summary = {
    total: failedCases.length,
    intellectual: failedCases.filter(c => c.persona === "intellectual").length,
    creative: failedCases.filter(c => c.persona === "creative").length,
    avg_identity_margin: (totalMargin / failedCases.length).toFixed(2),
    top_leak_signals: sortDesc(leakFreq).slice(0, 10),
    top_missing_signals: sortDesc(missingFreq).slice(0, 10),
    top_collision_causes: sortDesc(causeFreq).slice(0, 10),
  };

  fs.writeFileSync(reportPath, JSON.stringify({ summary, cases: allResults }, null, 2));

  console.log(`\n✅ EXP-011A Complete → ${reportPath}`);
  console.log(`\n${"─".repeat(60)}`);
  console.log(`📊 Avg Identity Margin: ${summary.avg_identity_margin} (negative = Developer dominates)`);
  console.log(`\n🔴 Top Leak Signals (make IR look like Developer):`);
  summary.top_leak_signals.forEach(([k, v]) => console.log(`   [${v}x] ${k}`));
  console.log(`\n🟡 Top Missing Identity Signals:`);
  summary.top_missing_signals.forEach(([k, v]) => console.log(`   [${v}x] ${k}`));
  console.log(`\n🔵 Top Collision Causes:`);
  summary.top_collision_causes.forEach(([k, v]) => console.log(`   [${v}x] ${k}`));
}

runExp011A().catch(console.error);
