/**
 * EXP-014R: Repeatability / Variance Isolation
 *
 * Causal Question:
 *   Are the successes/failures of I1 on C003 and C007 due to actual Planner IR improvements,
 *   or just Renderer/Evaluator stochasticity?
 *
 * Setup:
 *   Source: C003 (I0 clean, I1 contaminated? / variance) and C007 (I0 contaminated, I1 clean)
 *   Planner: temperature=0 (runs ONCE per arm to fix the IR)
 *   Renderer (R2): temperature=0.0, runs 5 TIMES per IR.
 *   Evaluators: temperature=0.0
 *   Constraints & Contracts: FROZEN (no changes to semanticConstraints.ts)
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
import { evaluateIntellectualContamination } from '../lib/evaluation/intellectualContaminationGuard';
import { PERSONA_LETTER_MAP } from '../lib/evaluation/types';
import { buildSemanticPlannerConstraints } from '../lib/content/personas/semanticConstraints';

const delay = (ms: number) => new Promise(res => setTimeout(res, ms));

// ─── Concurrency limiter ──────────────────────────────────────────────────────
const MAX_CONCURRENT = 3;
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

// ─── Stats tracking for 429s ──────────────────────────────────────────────────
let total429s = 0;
let totalAttempts = 0;

async function retry<T>(fn: () => Promise<T>, label = 'eval'): Promise<T> {
  const MAX_ATTEMPTS = 8;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    totalAttempts++;
    try { return await fn(); }
    catch (e: any) {
      if (attempt >= MAX_ATTEMPTS) {
        console.error(`     [Fatal] ${label} failed completely:`, e);
        throw e;
      }
      const is429 =
        e?.status === 429 ||
        e?.error?.code === 429 ||
        e?.message?.includes('429') ||
        e?.message?.includes('quota') ||
        e?.message?.includes('RESOURCE_EXHAUSTED') ||
        e?.message?.includes('API_KEY_SERVICE_BLOCKED');
      
      if (is429) total429s++;

      const baseMs = is429 ? 15_000 : 3_000;
      const waitMs = Math.min(baseMs * Math.pow(1.8, attempt - 1) + Math.random() * 2_000, 60_000);
      const remaining = MAX_ATTEMPTS - attempt;
      console.error(`     [Retry] ${label} failed (${is429 ? '429' : e?.status ?? e?.code ?? 'ERR'}). Waiting ${(waitMs / 1000).toFixed(1)}s... (${remaining} left)`);
      await delay(waitMs);
    }
  }
  throw new Error('Max retries exceeded');
}

// ─── Constraints & Topology ───────────────────────────────────────────────────
const I0_CONSTRAINTS = `Intellectual Constraints:
- assumption: Starts from a widely held assumption.
- contradiction: Challenges/invalidates the assumption (NOT just discovering a problem).
- why_fails: Explains why the original framing is epistemologically insufficient.
- reframe: Redefines the question itself (FORBIDDEN: "the best solution is...").
- synthesis: A paradigm shift or philosophical redefinition (FORBIDDEN: recommendation).
- Global Forbidden: problem -> intervention -> measurable outcome.`;

const I1_CONSTRAINTS = buildSemanticPlannerConstraints('intellectual');

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

// ─── Math Utils ──────────────────────────────────────────────────────────────
function getMean(arr: number[]): number {
  if (arr.length === 0) return 0;
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

function getStdDev(arr: number[]): number {
  if (arr.length <= 1) return 0;
  const mean = getMean(arr);
  const variance = arr.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / (arr.length - 1);
  return Math.sqrt(variance);
}

function hashIR(graph: any): string {
  return crypto
    .createHash('sha256')
    .update(JSON.stringify(graph))
    .digest('hex')
    .slice(0, 16);
}

// ─── Topology Check ──────────────────────────────────────────────────────────
function checkTopology(graph: any) {
  const nodeTypes = new Set<string>((graph.nodes ?? []).map((n: any) => n.type as string));
  const edgeLookup = new Set<string>(
    (graph.edges ?? []).map((e: any) => `${e.from}→${e.to}:${e.relation}`)
  );
  const typeToIds: Record<string, string[]> = {};
  for (const n of graph.nodes ?? []) {
    if (!typeToIds[n.type]) typeToIds[n.type] = [];
    typeToIds[n.type].push(n.id);
  }

  const missing_required_nodes = REQUIRED_NODE_TYPES.filter(t => !nodeTypes.has(t));
  const forbidden_nodes_found = FORBIDDEN_NODE_TYPES.filter(t => nodeTypes.has(t));

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

  const compliant =
    missing_required_nodes.length === 0 &&
    forbidden_nodes_found.length === 0 &&
    missing_required_edges.length === 0;

  return { compliant, missing_required_nodes, forbidden_nodes_found, missing_required_edges };
}

// ─── LLM Functions (temp = 0.0) ──────────────────────────────────────────────
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

  const text = await callAI({
    model: MODEL.GENERATION,
    contents: prompt,
    config: {
      responseMimeType: 'application/json',
      responseSchema: PLANNER_SCHEMA as any,
      temperature: 0,
    },
  });
  return JSON.parse(text);
}

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
      temperature: 0.0, // FORCED 0.0 for EXP-014R
    },
  });
  const d = JSON.parse(text);
  return [d.title, d.hook, d.body, d.closing].filter(Boolean).join('\n\n');
}

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
      temperature: 0.0, // FORCED 0.0 for EXP-014R
    },
  });
  return JSON.parse(text);
}

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
      temperature: 0.0, // FORCED 0.0 for EXP-014R
    },
  });
  return JSON.parse(text);
}

// ─── Repeatability Runner ───────────────────────────────────────────────────
interface RepeatResult {
  repeat_idx: number;
  renderedText: string;
  identity_correct: boolean;
  predicted_persona: string;
  is_developer_contaminated: boolean;
  contamination_type: string;
  contamination_confidence: number;
  node_coverage: number;
  structural_fidelity: number;
}

async function evaluateArmWithRepeats(
  topic: string,
  arm: 'I0' | 'I1',
  constraints: string,
  repeats: number = 5
) {
  console.log(`\n     [Planner ${arm}] Generating IR (once)...`);
  const plannerIR = await limitedCall(() => retry(() => runPlanner(topic, constraints, arm), `planner-${arm}`));

  const topology = checkTopology(plannerIR);
  console.log(`     [L1] IR Purity...`);
  const purity = await limitedCall(() => retry(() => evalIRPurity(plannerIR), `purity-${arm}`));

  const repeatResults: RepeatResult[] = [];

  for (let r = 1; r <= repeats; r++) {
    console.log(`     [R2 Repeat ${r}/${repeats}] Rendering & Evaluating...`);
    
    const renderedText = await limitedCall(() => retry(() => renderR2(plannerIR), `render-${arm}-${r}`));

    const [personaEval, nodeCov, contamination, fidelity] = await Promise.all([
      limitedCall(() => retry(() => evaluatePersona(renderedText, 'v2', { temperature: 0.0 }), `persona-${arm}-${r}`)),
      limitedCall(() => retry(() => evaluateContractNodeCoverage(renderedText, 'intellectual', { temperature: 0.0 }), `nodes-${arm}-${r}`)),
      limitedCall(() => retry(() => evaluateIntellectualContamination(renderedText, { temperature: 0.0 }), `contamination-${arm}-${r}`)),
      limitedCall(() => retry(() => evalFidelity(plannerIR, renderedText), `fidelity-${arm}-${r}`)),
    ]);

    repeatResults.push({
      repeat_idx: r,
      renderedText,
      identity_correct: personaEval.predicted_persona === PERSONA_LETTER_MAP['intellectual'],
      predicted_persona: personaEval.predicted_persona,
      is_developer_contaminated: contamination.is_developer_contaminated,
      contamination_type: contamination.contamination_type,
      contamination_confidence: contamination.confidence,
      node_coverage: nodeCov.nodes_found,
      structural_fidelity: fidelity.structural_fidelity,
    });
  }

  // Calculate variance stats
  const contaminationArr = repeatResults.map(r => r.is_developer_contaminated ? 100 : 0);
  const identityArr = repeatResults.map(r => r.identity_correct ? 100 : 0);
  const coverageArr = repeatResults.map(r => r.node_coverage);
  const fidelityArr = repeatResults.map(r => r.structural_fidelity);

  const stats = {
    contamination: {
      min: Math.min(...contaminationArr),
      max: Math.max(...contaminationArr),
      mean: getMean(contaminationArr),
      stddev: getStdDev(contaminationArr),
    },
    identity: {
      min: Math.min(...identityArr),
      max: Math.max(...identityArr),
      mean: getMean(identityArr),
      stddev: getStdDev(identityArr),
    },
    coverage: {
      min: Math.min(...coverageArr),
      max: Math.max(...coverageArr),
      mean: getMean(coverageArr),
      stddev: getStdDev(coverageArr),
    },
    fidelity: {
      min: Math.min(...fidelityArr),
      max: Math.max(...fidelityArr),
      mean: getMean(fidelityArr),
      stddev: getStdDev(fidelityArr),
    },
  };

  const contaminationFlipRate =
    repeatResults.length > 1
      ? repeatResults.slice(1).filter(
          (r, i) =>
            r.is_developer_contaminated !==
            repeatResults[i].is_developer_contaminated
        ).length / (repeatResults.length - 1)
      : 0;

  const identityFlipRate =
    repeatResults.length > 1
      ? repeatResults.slice(1).filter(
          (r, i) =>
            r.identity_correct !==
            repeatResults[i].identity_correct
        ).length / (repeatResults.length - 1)
      : 0;

  const plannerIRHash = hashIR(plannerIR);

  return {
    arm,
    plannerIR,
    plannerIRHash,
    topology,
    ir_purity: purity.overall_purity,
    stats: {
      ...stats,
      contaminationFlipRate,
      identityFlipRate,
    },
    repeats: repeatResults,
  };
}

// ─── Main ─────────────────────────────────────────────────────────────────────
async function run() {
  const sourcePath = path.join(
    __dirname,
    'benchmark-reports',
    'exp-013-renderer-fidelity-1787553535728.json',
  );
  const exp013 = JSON.parse(fs.readFileSync(sourcePath, 'utf-8'));

  const casesToRun = exp013
    .filter((c: any) => c.caseId === 'C003-intellectual-T-P01' || c.caseId === 'C007-intellectual-T-P02')
    .map((c: any) => ({ caseId: c.caseId, topic: c.topic ?? c.caseId }));

  console.log(`\n════════════════════════════════════════════════════════`);
  console.log(`  EXP-014R: Repeatability / Variance Isolation`);
  console.log(`  Target: C003 (stochasticity check) and C007 (control)`);
  console.log(`  Planner temp: 0`);
  console.log(`  Renderer (R2) temp: 0.0 (5 repeats per IR)`);
  console.log(`  Evaluators temp: 0.0`);
  console.log(`════════════════════════════════════════════════════════`);

  const reportPath = path.join(
    __dirname,
    'benchmark-reports',
    `exp-014R-repeatability-${Date.now()}.json`,
  );

  const caseResults: any[] = [];

  for (const c of casesToRun) {
    console.log(`\n======================================================`);
    console.log(`  CASE: ${c.caseId}`);
    console.log(`======================================================`);

    const armI0 = await evaluateArmWithRepeats(c.topic, 'I0', I0_CONSTRAINTS, 5);
    const armI1 = await evaluateArmWithRepeats(c.topic, 'I1', I1_CONSTRAINTS, 5);

    console.log(`\n  ── RESULTS: ${c.caseId} ─────────────────────────────`);
    console.log(`     I0 IR Hash:             ${armI0.plannerIRHash}`);
    console.log(`     I1 IR Hash:             ${armI1.plannerIRHash}`);
    console.log(`     I0 Contamination array: [${armI0.repeats.map(r => r.is_developer_contaminated ? '1' : '0').join(', ')}]`);
    console.log(`     I1 Contamination array: [${armI1.repeats.map(r => r.is_developer_contaminated ? '1' : '0').join(', ')}]`);
    console.log(`     I1 Contamination mean:  ${armI1.stats.contamination.mean}% (stddev: ${armI1.stats.contamination.stddev.toFixed(1)}, flip: ${(armI1.stats.contaminationFlipRate*100).toFixed(1)}%)`);
    console.log(`     I1 Identity mean:       ${armI1.stats.identity.mean}% (stddev: ${armI1.stats.identity.stddev.toFixed(1)}, flip: ${(armI1.stats.identityFlipRate*100).toFixed(1)}%)`);
    console.log(`     I1 Topology:            ${armI1.topology.compliant ? 'PASS' : 'FAIL'}`);
    console.log(`     I1 IR Purity:           ${armI1.ir_purity}`);

    caseResults.push({
      caseId: c.caseId,
      I0: armI0,
      I1: armI1,
    });

    fs.writeFileSync(reportPath, JSON.stringify({ 
      summary: {
        experiment: 'EXP-014R',
        total429s,
        totalAttempts,
      }, 
      cases: caseResults 
    }, null, 2));
  }

  console.log('\n\n════════════════════════════════════════════════════════');
  console.log('  EXP-014R SUMMARY');
  console.log('════════════════════════════════════════════════════════\n');
  
  for (const r of caseResults) {
    console.log(`  ${r.caseId}`);
    console.log(`    I0 Contamination repeats: [${r.I0.repeats.map((x:any) => x.is_developer_contaminated ? '1' : '0').join(', ')}]`);
    console.log(`    I1 Contamination repeats: [${r.I1.repeats.map((x:any) => x.is_developer_contaminated ? '1' : '0').join(', ')}]`);
    console.log(`    I1 Purity:                ${r.I1.ir_purity}`);
    console.log(`    I1 Identity repeats:      [${r.I1.repeats.map((x:any) => x.identity_correct ? '1' : '0').join(', ')}]`);
    console.log('');
  }

  console.log(`  API Stats: Total attempts = ${totalAttempts}, 429s = ${total429s}`);
  console.log(`\n✅ Report saved → ${reportPath}\n`);
}

run().catch(console.error);
