/**
 * EXP-014: Intellectual Semantic Sufficiency
 *
 * Causal Question:
 *   Does I1 (EXP-014 semantic function contracts) rescue Intellectual cases
 *   that I0 / R2 failed in EXP-013, without increasing contamination or
 *   breaking IR topology?
 *
 * Setup:
 *   Source:   Intellectual cases where R2 failed in EXP-013 (failed subset)
 *   Renderer: R2 frozen (Deterministic Constrained Mapper — verbatim from EXP-013)
 *   Planner arms:
 *     I0 = original constraints (inlined — NOT read from semanticConstraints.ts)
 *     I1 = EXP-014 contracts (read from live semanticConstraints.ts)
 *   Evaluators: FROZEN (contractNodeEvaluator, personaEvaluator,
 *               intellectualContaminationGuard — not modified during this run)
 *   Temperature: 0 (deterministic, reduce sampling variance)
 *
 * Report layers:
 *   L1 Planner validity:    IR Purity, Topology (deterministic), semantic compliance
 *   L2 Identity sufficiency: personaEvaluator, contamination guard, node coverage
 *   L3 Surface realization:  R2 Fidelity (monitoring only — NOT a gate)
 *
 * Gate label: "EXP-014 subset gate" — NOT "production accuracy"
 *   accuracy_on_failed_subset ≥ 85%
 *   contamination ≤ 10%
 *   ir_purity ≥ 90
 *   forbidden_nodes = 0
 *   topology_compliance = 100%
 *
 * Primary diagnostic: I1 rescue rate = (I0 contaminated → I1 clean) / (I0 contaminated total)
 *
 * If EXP-014 passes: → EXP-015 is the 24-cell generalization gate.
 */

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { config } from 'dotenv';
config({ path: path.join(process.cwd(), '.env.local') });

import { Type } from '@google/genai';
import { callAI, MODEL } from './lib/aiClient';
import { evaluatePersona } from '../lib/evaluation/personaEvaluator';
import { evaluateContractNodeCoverage } from '../lib/evaluation/contractNodeEvaluator';
import {
  evaluateIntellectualContamination,
  computeContaminationRate,
  passesContaminationGate,
} from '../lib/evaluation/intellectualContaminationGuard';
import { PERSONA_LETTER_MAP } from '../lib/evaluation/types';
import { buildSemanticPlannerConstraints } from '../lib/content/personas/semanticConstraints';

const delay = (ms: number) => new Promise(res => setTimeout(res, ms));

// ─── Concurrency limiter (max simultaneous LLM calls = key pool size) ─────────
// Prevents all keys from hitting quota simultaneously when Promise.all fires.
const MAX_CONCURRENT = 3; // match your key pool size
let _active = 0;
const _queue: Array<() => void> = [];
function acquireSemaphore(): Promise<void> {
  return new Promise(resolve => {
    if (_active < MAX_CONCURRENT) { _active++; resolve(); }
    else { _queue.push(() => { _active++; resolve(); }); }
  });
}
function releaseSemaphore() {
  _active--;
  if (_queue.length > 0) { const next = _queue.shift()!; next(); }
}
async function limitedCall<T>(fn: () => Promise<T>): Promise<T> {
  await acquireSemaphore();
  try { return await fn(); }
  finally { releaseSemaphore(); }
}

// ─── I0 constraints (FROZEN inline — unchanged from EXP-013) ─────────────────
// Inlined deliberately. Do NOT read from semanticConstraints.ts for this arm.
// If you do, future edits to the file will silently corrupt the baseline.
const I0_CONSTRAINTS = `Intellectual Constraints:
- assumption: Starts from a widely held assumption.
- contradiction: Challenges/invalidates the assumption (NOT just discovering a problem).
- why_fails: Explains why the original framing is epistemologically insufficient.
- reframe: Redefines the question itself (FORBIDDEN: "the best solution is...").
- synthesis: A paradigm shift or philosophical redefinition (FORBIDDEN: recommendation).
- Global Forbidden: problem -> intervention -> measurable outcome.`;

// I1 = live EXP-014 contracts (the variable under test)
const I1_CONSTRAINTS = buildSemanticPlannerConstraints('intellectual');

// ─── Topology (fixed, enforced deterministically — see checkTopology()) ───────
const REQUIRED_EDGE_SEQUENCE: Array<{ from: string; to: string; relation: string }> = [
  { from: 'assumption',    to: 'contradiction', relation: 'contradicts' },
  { from: 'contradiction', to: 'why_fails',     relation: 'causes'     },
  { from: 'why_fails',     to: 'reframe',       relation: 'reframes'   },
  { from: 'reframe',       to: 'synthesis',     relation: 'leads_to'   },
];
const REQUIRED_NODE_TYPES = ['assumption', 'contradiction', 'why_fails', 'reframe', 'synthesis'];
const FORBIDDEN_NODE_TYPES = ['intervention', 'outcome', 'fix'];

// ─── Schemas ─────────────────────────────────────────────────────────────────
const ALLOWED_NODES = [
  'observation', 'assumption', 'trigger', 'system', 'constraint',
  'motive', 'behavior', 'reinforcement', 'contradiction', 'reframe',
  'scene', 'association', 'tension', 'transformation', 'outcome',
  'bottleneck', 'mechanism', 'intervention', 'sensory_detail',
  'return_to_scene', 'awareness_shift', 'why_fails', 'synthesis',
];
const ALLOWED_EDGES = [
  'causes', 'constrains', 'reinforces', 'contradicts', 'reframes',
  'maps_to', 'transforms', 'results_in', 'leads_to', 'produces',
];

const PLANNER_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    nodes: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          id: { type: Type.STRING },
          type: { type: Type.STRING, enum: ALLOWED_NODES },
          claim: { type: Type.STRING },
          evidence: { type: Type.STRING },
        },
        required: ['id', 'type', 'claim', 'evidence'],
      },
    },
    edges: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          from: { type: Type.STRING },
          to: { type: Type.STRING },
          relation: { type: Type.STRING, enum: ALLOWED_EDGES },
        },
        required: ['from', 'to', 'relation'],
      },
    },
  },
  required: ['nodes', 'edges'],
};

const CONTENT_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    title: { type: Type.STRING },
    hook: { type: Type.STRING },
    body: { type: Type.STRING },
    closing: { type: Type.STRING },
  },
  required: ['title', 'hook', 'body', 'closing'],
};

const FIDELITY_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    structural_fidelity: { type: Type.NUMBER },
    invented_mechanisms: { type: Type.NUMBER },
    missing_nodes: { type: Type.ARRAY, items: { type: Type.STRING } },
    renderer_drift_detected: { type: Type.BOOLEAN },
    evidence: { type: Type.STRING },
  },
  required: ['structural_fidelity', 'invented_mechanisms', 'missing_nodes', 'renderer_drift_detected', 'evidence'],
};

const IR_PURITY_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    structural_purity: { type: Type.NUMBER },
    developer_leakage: { type: Type.NUMBER },
    psychology_leakage: { type: Type.NUMBER },
    creative_leakage: { type: Type.NUMBER },
    overall_purity: { type: Type.NUMBER },
  },
  required: ['structural_purity', 'developer_leakage', 'psychology_leakage', 'creative_leakage', 'overall_purity'],
};

// ─── Deterministic Topology Check (no LLM needed) ────────────────────────────
interface TopologyCheck {
  compliant: boolean;
  missing_required_nodes: string[];
  forbidden_nodes_found: string[];
  missing_required_edges: string[];
  extra_topology_violations: string[];
}

function checkTopology(graph: any): TopologyCheck {
  const nodeTypes = new Set<string>((graph.nodes ?? []).map((n: any) => n.type as string));
  const edgeLookup = new Set<string>(
    (graph.edges ?? []).map((e: any) => `${e.from}→${e.to}:${e.relation}`)
  );
  // Also check by node type (since node IDs may differ from type names)
  const typeToIds: Record<string, string[]> = {};
  for (const n of graph.nodes ?? []) {
    if (!typeToIds[n.type]) typeToIds[n.type] = [];
    typeToIds[n.type].push(n.id);
  }

  const missing_required_nodes = REQUIRED_NODE_TYPES.filter(t => !nodeTypes.has(t));
  const forbidden_nodes_found = FORBIDDEN_NODE_TYPES.filter(t => nodeTypes.has(t));

  // Check required edges by type — find if any edge connects two nodes of the right types
  const missing_required_edges: string[] = [];
  for (const req of REQUIRED_EDGE_SEQUENCE) {
    const fromIds = typeToIds[req.from] ?? [];
    const toIds = typeToIds[req.to] ?? [];
    let found = false;
    for (const f of fromIds) {
      for (const t of toIds) {
        if (edgeLookup.has(`${f}→${t}:${req.relation}`)) { found = true; break; }
      }
      if (found) break;
    }
    if (!found) missing_required_edges.push(`${req.from} --${req.relation}--> ${req.to}`);
  }

  const extra_topology_violations: string[] = [];
  if (forbidden_nodes_found.length > 0) {
    extra_topology_violations.push(`Forbidden node types present: ${forbidden_nodes_found.join(', ')}`);
  }

  const compliant =
    missing_required_nodes.length === 0 &&
    forbidden_nodes_found.length === 0 &&
    missing_required_edges.length === 0;

  return { compliant, missing_required_nodes, forbidden_nodes_found, missing_required_edges, extra_topology_violations };
}

// ─── Retry wrapper (exponential backoff + jitter) ────────────────────────────
async function retry<T>(fn: () => Promise<T>, label = 'eval'): Promise<T> {
  const MAX_ATTEMPTS = 8;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try { return await fn(); }
    catch (e: any) {
      if (attempt >= MAX_ATTEMPTS) {
        console.error(`     [Fatal] ${label} failed completely:`, e);
        throw e;
      }
      // Detect quota/rate-limit errors → longer base wait
      const is429 =
        e?.status === 429 ||
        e?.error?.code === 429 ||
        e?.message?.includes('429') ||
        e?.message?.includes('quota') ||
        e?.message?.includes('RESOURCE_EXHAUSTED');
      const baseMs = is429 ? 15_000 : 3_000;
      const waitMs = Math.min(baseMs * Math.pow(1.8, attempt - 1) + Math.random() * 2_000, 60_000);
      const remaining = MAX_ATTEMPTS - attempt;
      console.error(`     [Retry] ${label} failed (${is429 ? '429' : e?.status ?? e?.code ?? 'ERR'}). Waiting ${(waitMs / 1000).toFixed(1)}s... (${remaining} left)`);
      await delay(waitMs);
    }
  }
  throw new Error('Max retries exceeded');
}

// ─── Planner (temperature: 0 for determinism) ─────────────────────────────────
async function runPlanner(topic: string, constraints: string, arm: string): Promise<any> {
  const prompt = `You are the Causal Planner for the INTELLECTUAL persona.
Your task is to populate a machine-verifiable Causal Graph (nodes and edges)
representing the argument based on the topic: "${topic}"

REQUIRED TOPOLOGY:
CANONICAL EDGE PATTERN:
assumption --contradicts--> contradiction
contradiction --causes--> why_fails
why_fails --reframes--> reframe
reframe --leads_to--> synthesis

RULES:
- NO 'intervention' or 'fix' nodes. You do not fix the system, you prove the question is wrong.
- Must show a logical paradox or framing error.
- Do NOT add nodes of type 'outcome' unless it is inside the synthesis node itself.

SEMANTIC CONSTRAINTS:
${constraints}

Generate the Causal Graph now.`;

  console.log(`     [Planner ${arm}] Generating IR...`);
  const text = await callAI({
    model: MODEL.GENERATION,
    contents: prompt,
    config: {
      responseMimeType: 'application/json',
      responseSchema: PLANNER_SCHEMA as any,
      temperature: 0,  // deterministic — reduce sampling variance
    },
  });
  return JSON.parse(text);
}

// ─── R2 Renderer (frozen — verbatim from EXP-013) ────────────────────────────
async function renderR2(graph: any): Promise<string> {
  const prompt = `You are a Deterministic Graph-to-Text Mapper.
Your task is to convert each node of the Causal Graph into Arabic surface text,
maintaining the exact claim, evidence, and function.

STRICT RULES:
1. Do NOT add any persona style, persona names, or stylistic embellishments.
2. Do NOT invent claims that are not explicitly in the IR.
3. Do NOT delete or skip any identity-bearing nodes.
4. Do NOT reinterpret the topology or add missing links.
5. Do NOT add recommendations or solutions unless they exist in the graph.
6. Map the exact causal sequence as provided.
   Output format must be clean Arabic text without mentioning the graph itself.

Causal Graph:
${JSON.stringify(graph, null, 2)}`;

  const text = await callAI({
    model: MODEL.GENERATION,
    contents: prompt,
    config: {
      responseMimeType: 'application/json',
      responseSchema: CONTENT_SCHEMA as any,
      temperature: 0.6,  // matches EXP-013 exactly
    },
  });
  const d = JSON.parse(text);
  return [d.title, d.hook, d.body, d.closing].filter(Boolean).join('\n\n');
}

// ─── IR Purity (LLM) ─────────────────────────────────────────────────────────
async function evalIRPurity(graph: any): Promise<any> {
  const prompt = `You are an IR Purity Auditor.
Assess the Causal Graph for cross-persona contamination.
Target persona: INTELLECTUAL

Graph:
${JSON.stringify(graph, null, 2)}

Score each leakage 0-100 (0=none). Score overall_purity 0-100 (100=pure).`;
  const text = await callAI({
    model: MODEL.EVALUATION,
    contents: prompt,
    config: {
      responseMimeType: 'application/json',
      responseSchema: IR_PURITY_SCHEMA as any,
      temperature: 0.1,
    },
  });
  return JSON.parse(text);
}

// ─── Fidelity (L3 — monitoring only) ─────────────────────────────────────────
async function evalFidelity(graph: any, rendered: string): Promise<any> {
  const prompt = `You are a Surface Fidelity Auditor.
Source Graph:
${JSON.stringify(graph, null, 2)}

Generated Text:
${rendered}

Score structural_fidelity 0.0-1.0.
Count invented_mechanisms.
List missing_nodes.
Set renderer_drift_detected.`;
  const text = await callAI({
    model: MODEL.EVALUATION,
    contents: prompt,
    config: {
      responseMimeType: 'application/json',
      responseSchema: FIDELITY_SCHEMA as any,
      temperature: 0.1,
    },
  });
  return JSON.parse(text);
}

// ─── Arm result types ─────────────────────────────────────────────────────────
interface ArmResult {
  arm: 'I0' | 'I1';
  constraints_version: string;    // sha256 of the constraints text used
  generation_model: string;
  generation_temperature: number;
  evaluation_model: string;
  plannerIR: any;
  renderedText: string;
  // L1: Planner validity (topology = deterministic, purity = LLM)
  l1: {
    topology: TopologyCheck;
    ir_purity: number;
    ir_developer_leakage: number;
  };
  // L2: Identity sufficiency
  l2: {
    identity_correct: boolean;
    predicted_persona: string;
    confidence: number;
    node_coverage: number;        // 0-5
    node_coverage_details: string;
    is_developer_contaminated: boolean;
    contamination_type: string;
    contamination_confidence: number;
    // Split forbidden signal clearly from contamination
    forbidden_nodes_in_graph: string[];    // from deterministic topology check
    forbidden_semantic_patterns: boolean;  // from contamination guard
  };
  // L3: Surface realization (monitoring only — NOT a gate)
  l3: {
    structural_fidelity: number;
    renderer_drift: boolean;
    missing_nodes: string[];
  };
}

async function evaluateArm(
  topic: string,
  arm: 'I0' | 'I1',
  constraints: string,
): Promise<ArmResult> {
  const plannerIR = await limitedCall(() => retry(() => runPlanner(topic, constraints, arm), `planner-${arm}`));

  // L1 — Topology: deterministic (no LLM needed)
  const topology = checkTopology(plannerIR);

  // L1 IR Purity + R2 Render — parallel (both only need plannerIR)
  console.log(`     [L1] IR Purity... (parallel with R2 Render)`);
  console.log(`     [R2] Rendering...`);
  const [purity, renderedText] = await Promise.all([
    limitedCall(() => retry(() => evalIRPurity(plannerIR), `purity-${arm}`)),
    limitedCall(() => retry(() => renderR2(plannerIR),     `render-${arm}`)),
  ]);

  // L2 + L3 — all evaluators in parallel (all only need renderedText / plannerIR)
  console.log(`     [L2] Persona eval... (parallel with node coverage, contamination guard, fidelity)`);
  const [personaEval, nodeCov, contamination, fidelity] = await Promise.all([
    limitedCall(() => retry(() => evaluatePersona(renderedText, 'v2'),                          `persona-${arm}`)),
    limitedCall(() => retry(() => evaluateContractNodeCoverage(renderedText, 'intellectual'),   `nodes-${arm}`)),
    limitedCall(() => retry(() => evaluateIntellectualContamination(renderedText),              `contamination-${arm}`)),
    limitedCall(() => retry(() => evalFidelity(plannerIR, renderedText),                        `fidelity-${arm}`)),
  ]);

  const isCorrect = personaEval.predicted_persona === PERSONA_LETTER_MAP['intellectual'];

  return {
    arm,
    constraints_version: crypto.createHash('sha256').update(constraints).digest('hex').slice(0, 12),
    generation_model: MODEL.GENERATION,
    generation_temperature: 0,
    evaluation_model: MODEL.EVALUATION,
    plannerIR,
    renderedText,
    l1: {
      topology,
      ir_purity: purity.overall_purity,
      ir_developer_leakage: purity.developer_leakage,
    },
    l2: {
      identity_correct: isCorrect,
      predicted_persona: personaEval.predicted_persona,
      confidence: personaEval.confidence_score,
      node_coverage: nodeCov.nodes_found,
      node_coverage_details: nodeCov.details,
      is_developer_contaminated: contamination.is_developer_contaminated,
      contamination_type: contamination.contamination_type,
      contamination_confidence: contamination.confidence,
      // Cleanly separated signals
      forbidden_nodes_in_graph: topology.forbidden_nodes_found,
      forbidden_semantic_patterns: contamination.is_developer_contaminated,
    },
    l3: {
      structural_fidelity: fidelity.structural_fidelity,
      renderer_drift: fidelity.renderer_drift_detected,
      missing_nodes: fidelity.missing_nodes ?? [],
    },
  };
}

// ─── Main ─────────────────────────────────────────────────────────────────────
async function run() {
  const isSmokeTest = process.argv.includes('--smoke');
  const sourcePath = path.join(
    __dirname,
    'benchmark-reports',
    'exp-013-renderer-fidelity-1787553535728.json',
  );

  if (!fs.existsSync(sourcePath)) {
    console.error(`❌ Source file not found: ${sourcePath}`);
    process.exit(1);
  }

  const exp013 = JSON.parse(fs.readFileSync(sourcePath, 'utf-8'));

  // Filter: Intellectual cases that failed with R2 in EXP-013
  // Gate context: this is a "failed subset" — NOT the full 24-cell Intellectual set.
  // Accuracy on this subset is a diagnostic rescue rate, not a production gate.
  const failedIntellectualCases = exp013.filter((c: any) => {
    return c.persona === 'intellectual' && c.R2?.eval_p?.is_correct === false;
  });

  console.log(`\n════════════════════════════════════════════════════════`);
  console.log(`  EXP-014: Intellectual Semantic Sufficiency`);
  console.log(`  Causal question: Does I1 rescue I0/R2 failures?`);
  console.log(`  I0 sha256: ${crypto.createHash('sha256').update(I0_CONSTRAINTS).digest('hex').slice(0, 12)}`);
  console.log(`  I1 sha256: ${crypto.createHash('sha256').update(I1_CONSTRAINTS).digest('hex').slice(0, 12)}`);
  console.log(`  Renderer: R2 (frozen, temp=0.6)`);
  console.log(`  Planner temp: 0 (deterministic)`);
  console.log(`  Evaluators: FROZEN`);
  console.log(`════════════════════════════════════════════════════════`);
  console.log(`\n  EXP-013 total cases: ${exp013.length}`);
  console.log(`  Intellectual R2-failed cases (subset): ${failedIntellectualCases.length}`);

  let casesToRun = failedIntellectualCases;
  if (isSmokeTest) {
    casesToRun = casesToRun.slice(0, 2);
    console.log(`  [SMOKE] Running ${casesToRun.length} cases.\n`);
  } else {
    console.log(`  Running all ${casesToRun.length} failed cases.\n`);
  }

  if (casesToRun.length === 0) {
    console.log('⚠️  No failed Intellectual R2 cases found. Check source file.');
    process.exit(0);
  }

  const reportPath = path.join(
    __dirname,
    'benchmark-reports',
    `exp-014-intellectual-sufficiency-${Date.now()}.json`,
  );

  const caseResults: any[] = [];

  for (let i = 0; i < casesToRun.length; i++) {
    const c = casesToRun[i];
    const topic = c.topic ?? c.caseId ?? `case-${i}`;
    console.log(`\n[${i + 1}/${casesToRun.length}] ${c.caseId} | topic: "${topic}"`);

    console.log(`\n  ── ARM I0 & I1 — running in parallel ───────────────`);
    const [armI0, armI1] = await Promise.all([
      retry(() => evaluateArm(topic, 'I0', I0_CONSTRAINTS), `arm-I0-${i}`),
      retry(() => evaluateArm(topic, 'I1', I1_CONSTRAINTS), `arm-I1-${i}`),
    ]);

    const delta = {
      identity_delta:      (armI1.l2.identity_correct ? 1 : 0) - (armI0.l2.identity_correct ? 1 : 0),
      node_coverage_delta: armI1.l2.node_coverage - armI0.l2.node_coverage,
      ir_purity_delta:     armI1.l1.ir_purity - armI0.l1.ir_purity,
      contamination_delta: (armI1.l2.is_developer_contaminated ? 1 : 0) - (armI0.l2.is_developer_contaminated ? 1 : 0),
      // Primary rescue signal
      i0_was_contaminated: armI0.l2.is_developer_contaminated,
      i1_rescued:          armI0.l2.is_developer_contaminated && !armI1.l2.is_developer_contaminated,
    };

    console.log(`\n  ── DELTA ────────────────────────────────────────────`);
    console.log(`     Identity: I0=${armI0.l2.identity_correct ? '✅' : '❌'} → I1=${armI1.l2.identity_correct ? '✅' : '❌'} (Δ${delta.identity_delta >= 0 ? '+' : ''}${delta.identity_delta})`);
    console.log(`     Node coverage: I0=${armI0.l2.node_coverage}/5 → I1=${armI1.l2.node_coverage}/5`);
    console.log(`     IR Purity: I0=${armI0.l1.ir_purity.toFixed(1)} → I1=${armI1.l1.ir_purity.toFixed(1)}`);
    console.log(`     Contaminated: I0=${armI0.l2.is_developer_contaminated} → I1=${armI1.l2.is_developer_contaminated}`);
    console.log(`     Topology I0: ${armI0.l1.topology.compliant ? '✅' : '❌'} | I1: ${armI1.l1.topology.compliant ? '✅' : '❌'}`);
    if (delta.i0_was_contaminated) {
      console.log(`     🔬 I0 Developer contamination → I1 ${delta.i1_rescued ? '✅ RESCUED' : '❌ NOT rescued'}`);
    }

    caseResults.push({
      caseId: c.caseId,
      topic,
      // Source EXP-013 context for traceability
      source_exp013: {
        r2_prediction: c.R2?.eval_p?.predicted_persona,
        r2_correct: c.R2?.eval_p?.is_correct,
        r2_node_preservation_avg: (() => {
          const nodes = c.R2?.node_coverage?.nodes ?? [];
          if (nodes.length === 0) return null;
          return nodes.reduce((s: number, n: any) => s + (n.identity_preservation_score ?? 0), 0) / nodes.length;
        })(),
      },
      I0: { ...armI0 },
      I1: { ...armI1 },
      delta,
    });

    fs.writeFileSync(reportPath, JSON.stringify({ summary: null, cases: caseResults }, null, 2));
  }

  // ─── Aggregate Summary ────────────────────────────────────────────────────
  const n = caseResults.length;

  function aggregateArm(key: 'I0' | 'I1') {
    const cases = caseResults.map(r => r[key]);
    return {
      accuracy_on_failed_subset: (cases.filter(a => a.l2.identity_correct).length / n) * 100,
      avg_ir_purity: cases.reduce((s, a) => s + a.l1.ir_purity, 0) / n,
      topology_compliance_pct: (cases.filter(a => a.l1.topology.compliant).length / n) * 100,
      avg_node_coverage: cases.reduce((s, a) => s + a.l2.node_coverage, 0) / n,
      contamination_rate: computeContaminationRate(cases.map(a => a.l2) as any),
      forbidden_node_hits: cases.filter(a => a.l2.forbidden_nodes_in_graph.length > 0).length,
      forbidden_semantic_hits: cases.filter(a => a.l2.forbidden_semantic_patterns).length,
      avg_fidelity_l3: cases.reduce((s, a) => s + a.l3.structural_fidelity, 0) / n,
    };
  }

  const aggI0 = aggregateArm('I0');
  const aggI1 = aggregateArm('I1');

  // I1 rescue rate (primary diagnostic)
  const i0Contaminated = caseResults.filter(r => r.delta.i0_was_contaminated);
  const i1Rescued = i0Contaminated.filter(r => r.delta.i1_rescued);
  const rescueRate = i0Contaminated.length > 0
    ? (i1Rescued.length / i0Contaminated.length) * 100
    : null;

  // EXP-014 subset gates (labeled clearly — NOT production accuracy)
  const gates = {
    accuracy_on_failed_subset:  aggI1.accuracy_on_failed_subset >= 85,
    contamination:              passesContaminationGate(caseResults.map(r => r.I1.l2) as any),
    ir_purity:                  aggI1.avg_ir_purity >= 90,
    forbidden_nodes:            aggI1.forbidden_node_hits === 0,
    topology_compliance:        aggI1.topology_compliance_pct === 100,
  };
  const overallPass = Object.values(gates).every(Boolean);

  console.log('\n\n════════════════════════════════════════════════════════');
  console.log('  EXP-014 RESULTS — FAILED INTELLECTUAL SUBSET ONLY');
  console.log('  (Not production gate — EXP-015 is the 24-cell gate)');
  console.log('════════════════════════════════════════════════════════\n');

  console.log('  LAYER 1 — Planner Validity');
  console.log(`  ${'Metric'.padEnd(30)} ${'I0'.padEnd(12)} ${'I1'.padEnd(12)} Gate`);
  console.log(`  ${'─'.repeat(65)}`);
  console.log(`  ${'IR Purity'.padEnd(30)} ${aggI0.avg_ir_purity.toFixed(1).padEnd(12)} ${aggI1.avg_ir_purity.toFixed(1).padEnd(12)} ≥90 → ${gates.ir_purity ? '✅' : '❌'}`);
  console.log(`  ${'Topology compliance'.padEnd(30)} ${(aggI0.topology_compliance_pct.toFixed(0) + '%').padEnd(12)} ${(aggI1.topology_compliance_pct.toFixed(0) + '%').padEnd(12)} 100% → ${gates.topology_compliance ? '✅' : '❌'}`);
  console.log(`  ${'Forbidden node hits'.padEnd(30)} ${String(aggI0.forbidden_node_hits).padEnd(12)} ${String(aggI1.forbidden_node_hits).padEnd(12)} =0 → ${gates.forbidden_nodes ? '✅' : '❌'}`);

  console.log('\n  LAYER 2 — Identity Sufficiency');
  console.log(`  ${'Metric'.padEnd(30)} ${'I0'.padEnd(12)} ${'I1'.padEnd(12)} Gate`);
  console.log(`  ${'─'.repeat(65)}`);
  console.log(`  ${'Accuracy (failed subset)'.padEnd(30)} ${(aggI0.accuracy_on_failed_subset.toFixed(1) + '%').padEnd(12)} ${(aggI1.accuracy_on_failed_subset.toFixed(1) + '%').padEnd(12)} ≥85% subset → ${gates.accuracy_on_failed_subset ? '✅' : '❌'}`);
  console.log(`  ${'Dev Contamination'.padEnd(30)} ${(aggI0.contamination_rate.toFixed(1) + '%').padEnd(12)} ${(aggI1.contamination_rate.toFixed(1) + '%').padEnd(12)} ≤10% → ${gates.contamination ? '✅' : '❌'}`);
  console.log(`  ${'Forbidden semantic patterns'.padEnd(30)} ${String(aggI0.forbidden_semantic_hits).padEnd(12)} ${String(aggI1.forbidden_semantic_hits).padEnd(12)} (diagnostic)`);
  console.log(`  ${'Node Coverage /5'.padEnd(30)} ${aggI0.avg_node_coverage.toFixed(2).padEnd(12)} ${aggI1.avg_node_coverage.toFixed(2).padEnd(12)} (diagnostic)`);

  console.log('\n  🔬 PRIMARY DIAGNOSTIC — I1 Rescue Rate');
  if (rescueRate !== null) {
    console.log(`     I0 Developer contaminations:  ${i0Contaminated.length}/${n}`);
    console.log(`     I1 successfully rescued:      ${i1Rescued.length}/${i0Contaminated.length}`);
    console.log(`     Rescue Rate:                  ${rescueRate.toFixed(1)}%`);
    console.log(`     Interpretation: Did I1's semantic function contracts specifically`);
    console.log(`       fix the cases where I0 was Developer-contaminated?`);
  } else {
    console.log(`     N/A — no I0 Developer contaminations detected in this subset.`);
    console.log(`     (This may mean I0 did not produce Developer collisions here,`);
    console.log(`      or the subset is too small to contain them.)`);
  }

  console.log('\n  LAYER 3 — Surface Realization (monitoring only — NOT gated)');
  console.log(`  ${'R2 Fidelity'.padEnd(30)} ${aggI0.avg_fidelity_l3.toFixed(3).padEnd(12)} ${aggI1.avg_fidelity_l3.toFixed(3)}`);

  console.log('\n  ─────────────────────────────────────────────────────');
  console.log(`  EXP-014 SUBSET GATE: ${overallPass ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`  Gates: accuracy=${gates.accuracy_on_failed_subset ? '✅' : '❌'} | contamination=${gates.contamination ? '✅' : '❌'} | ir_purity=${gates.ir_purity ? '✅' : '❌'} | forbidden=${gates.forbidden_nodes ? '✅' : '❌'} | topology=${gates.topology_compliance ? '✅' : '❌'}`);
  if (overallPass) {
    console.log(`\n  Next step: EXP-015 (full 24-cell with I1 + R2) — the production gate.`);
  } else {
    console.log(`\n  Investigate: failed gates above. If topology is the blocker, consider`);
    console.log(`    whether the topology itself is insufficient for Arabic surface identity.`);
  }

  const summary = {
    experiment: 'EXP-014',
    timestamp: new Date().toISOString(),
    causal_question: 'Does I1 rescue Intellectual R2 failures from EXP-013?',
    gate_label: 'EXP-014 subset gate — NOT production accuracy (EXP-015 is the 24-cell gate)',
    source_exp013: sourcePath,
    n_cases_in_subset: n,
    constraints: {
      I0: I0_CONSTRAINTS,
      I0_sha256: crypto.createHash('sha256').update(I0_CONSTRAINTS).digest('hex').slice(0, 12),
      I1: I1_CONSTRAINTS,
      I1_sha256: crypto.createHash('sha256').update(I1_CONSTRAINTS).digest('hex').slice(0, 12),
    },
    renderer: 'R2-frozen (verbatim from EXP-013)',
    generation_model: MODEL.GENERATION,
    generation_temperature: 0,
    evaluation_model: MODEL.EVALUATION,
    aggregates: { I0: aggI0, I1: aggI1 },
    rescue_rate: {
      i0_contaminated_count: i0Contaminated.length,
      i1_rescued_count: i1Rescued.length,
      rescue_rate_pct: rescueRate,
    },
    gates,
    overall_pass: overallPass,
  };

  fs.writeFileSync(reportPath, JSON.stringify({ summary, cases: caseResults }, null, 2));
  console.log(`\n✅ Report saved → ${reportPath}\n`);
}

run().catch(console.error);
