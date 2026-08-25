/**
 * EXP-015: Production Gate — Full 24-Cell Matrix
 *
 * Causal question:
 *   Does I1 (EXP-014 semantic function contracts) generalize across all 24 cells
 *   (4 personas × 6 topics) while maintaining contamination ≤10% and identity ≥85%?
 *
 * Protocol (frozen per EXP-014R findings):
 *   - Planner:   temp=0, single run per cell/arm  (deterministic IR)
 *   - Renderer:  R2 frozen, temp=0, 5× per IR     (R_REPEATS=5)
 *   - Evaluators: temp=0, 3× per render           (E_REPEATS=3)
 *   - Boolean verdicts: majority vote over evaluator repeats
 *   - Metrics stored: contamination rate, evaluator disagreement rate,
 *                     renderer variance, evaluator variance, all raw observations
 *
 * Arms:
 *   I0 = baseline constraints (frozen inline)
 *   I1 = live semanticConstraints.ts (treatment — DO NOT EDIT during run)
 *
 * Production gates (I1 must pass all):
 *   identity_accuracy    ≥ 85%   (majority-vote persona match across all 24 cells)
 *   contamination        ≤ 10%   (majority-vote contaminated / 24-cell Intellectual subset)
 *   ir_purity            ≥ 90    (mean purity across all cells)
 *   forbidden_node_hits  = 0     (deterministic topology check)
 *   topology_compliance  = 100%  (deterministic)
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
import { checkTopology, type TopologyResult } from './lib/topologyValidator';
import { buildPlannerSchema } from './lib/plannerSchema';
import { compilePlannerOutputToGraph } from './lib/plannerCompiler';
import {
  PURITY_EVALUATOR_CONTEXT,
  PURITY_EVALUATOR_FALLBACK,
  type PurityResult,
} from './lib/purityEvaluatorContext';
import type { PersonaId } from '../lib/evaluation/types';

// ─── Protocol constants ───────────────────────────────────────────────────────
const R_REPEATS = 5;  // Renderer repeats per IR
const E_REPEATS = 3;  // Evaluator repeats per render (majority vote)

// ─── I0 baseline constraints (FROZEN inline — do NOT read from semanticConstraints.ts) ──
const I0_CONSTRAINTS: Record<string, string> = {
  intellectual: `Intellectual Constraints:
- assumption: Starts from a widely held assumption.
- contradiction: Challenges/invalidates the assumption (NOT just discovering a problem).
- why_fails: Explains why the original framing is epistemologically insufficient.
- reframe: Redefines the question itself (FORBIDDEN: "the best solution is...").
- synthesis: A paradigm shift or philosophical redefinition (FORBIDDEN: recommendation).
- Global Forbidden: problem -> intervention -> measurable outcome.`,

  developer: `Developer Constraints:
- system: Identify a concrete system or process.
- constraint: Locate the bottleneck or failure point.
- mechanism: Explain the causal link.
- intervention: A structural change targeting the mechanism.
- consequence: An observable, specific outcome.`,

  psychology: `Psychology Constraints:
- trigger: External event that activates the pattern.
- motive: Hidden emotional need or defense mechanism.
- behavior: Observable action or pattern.
- reinforcement: The payoff — why the pattern persists.
- shift: An internal realization, NOT an external fix.`,

  creative: `Creative Constraints:
- scene: A specific, sensory anchor.
- association: An unexpected metaphorical leap.
- tension: Aesthetic or emotional tension.
- transformation: The insight delivered through image or action.
- return_to_scene: An atmospheric echo of the opening scene.`,
};

// ─── Utilities ────────────────────────────────────────────────────────────────
const delay = (ms: number) => new Promise(res => setTimeout(res, ms));

let total429s = 0;
let totalAttempts = 0;

function hashIR(graph: any): string {
  return crypto.createHash('sha256').update(JSON.stringify(graph)).digest('hex').slice(0, 16);
}

function majorityVoteBoolean(arr: boolean[]): boolean {
  const trueCount = arr.filter(Boolean).length;
  return trueCount > arr.length / 2;
}

function majorityVoteString(arr: string[]): string {
  const counts: Record<string, number> = {};
  for (const v of arr) counts[v] = (counts[v] || 0) + 1;
  return Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0];
}

function getMean(arr: number[]): number {
  return arr.length === 0 ? 0 : arr.reduce((a, b) => a + b, 0) / arr.length;
}

function getStdDev(arr: number[]): number {
  if (arr.length <= 1) return 0;
  const mean = getMean(arr);
  return Math.sqrt(arr.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / (arr.length - 1));
}

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

async function retry<T>(fn: () => Promise<T>, label = 'op'): Promise<T> {
  const MAX_ATTEMPTS = 8;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    totalAttempts++;
    try { return await fn(); }
    catch (e: any) {
      if (attempt >= MAX_ATTEMPTS) { console.error(`     [Fatal] ${label} failed:`, e?.message ?? e); throw e; }
      const is429 = e?.status === 429 || e?.error?.code === 429 ||
        (e?.message ?? '').includes('429') || (e?.message ?? '').includes('RESOURCE_EXHAUSTED') ||
        (e?.message ?? '').includes('API_KEY_SERVICE_BLOCKED');
      if (is429) total429s++;
      const baseMs = is429 ? 15_000 : 3_000;
      const waitMs = Math.min(baseMs * Math.pow(1.8, attempt - 1) + Math.random() * 2_000, 60_000);
      const remaining = MAX_ATTEMPTS - attempt;
      console.error(`     [Retry] ${label} (${is429 ? '429' : e?.status ?? 'ERR'}) → ${(waitMs/1000).toFixed(1)}s (${remaining} left)`);
      await delay(waitMs);
    }
  }
  throw new Error('Max retries exceeded');
}

// ─── Schemas ─────────────────────────────────────────────────────────────────
// NOTE: PLANNER_SCHEMA is now generated dynamically per persona via buildPlannerSchema().
// The flat output is then compiled into Graph IR via compilePlannerOutputToGraph().
// CONTENT_SCHEMA and IR_PURITY_SCHEMA are unchanged.

const CONTENT_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    title: { type: Type.STRING }, hook: { type: Type.STRING },
    body: { type: Type.STRING }, closing: { type: Type.STRING },
  },
  required: ['title', 'hook', 'body', 'closing'],
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

// ─── Topology validator ───────────────────────────────────────────────────────
// Imported from scripts/lib/topologyValidator.ts (deterministic, no LLM).
// After the Option B refactor, the topology is assembled by compilePlannerOutputToGraph()
// so topology compliance is a compiler invariant, not an LLM metric.
// The validator still runs as a programming-error guard.

// ─── LLM calls ───────────────────────────────────────────────────────────────
// Planner now asks for semantic content only (flat object, no edges).
// Graph edges are deterministically compiled from TOPOLOGY_REQUIRED.
async function runPlanner(topic: string, persona: string, constraints: string, _arm: string): Promise<any> {
  const prompt = `You are the Causal Planner for the ${persona.toUpperCase()} persona.
Your task is to populate the required semantic components representing
the argument based on the topic: "${topic}"

SEMANTIC CONSTRAINTS (enforce strictly):
${constraints}

Generate the semantic components now.`;

  const schema = buildPlannerSchema(persona as PersonaId);
  const text = await callAI({
    model: MODEL.GENERATION,
    contents: prompt,
    config: { responseMimeType: 'application/json', responseSchema: schema as any, temperature: 0 },
  });
  const plannerOutput = JSON.parse(text);
  // Deterministically compile flat output → Graph IR with canonical edges
  return compilePlannerOutputToGraph(plannerOutput, persona as PersonaId);
}

async function renderR2(graph: any): Promise<string> {
  const prompt = `You are a Deterministic Graph-to-Text Mapper.
Convert each node of the Causal Graph into Arabic surface text, maintaining the exact claim, evidence, and function.

STRICT RULES:
1. Do NOT add persona style or stylistic embellishments.
2. Do NOT invent claims not in the IR.
3. Do NOT delete identity-bearing nodes.
4. Do NOT add recommendations unless in the graph.
5. Map the exact causal sequence. Clean Arabic text without mentioning the graph.

Causal Graph:
${JSON.stringify(graph, null, 2)}`;

  const text = await callAI({
    model: MODEL.GENERATION,
    contents: prompt,
    config: { responseMimeType: 'application/json', responseSchema: CONTENT_SCHEMA as any, temperature: 0 },
  });
  const d = JSON.parse(text);
  return [d.title, d.hook, d.body, d.closing].filter(Boolean).join('\n\n');
}

async function evalIRPurity(graph: any, targetPersona: string): Promise<PurityResult> {
  const personaContext =
    PURITY_EVALUATOR_CONTEXT[targetPersona] ?? PURITY_EVALUATOR_FALLBACK;

  const prompt = `You are an IR Purity Auditor.
Assess the Causal Graph for cross-persona contamination.
Target persona: ${targetPersona.toUpperCase()}

PERSONA CONTEXT:
${personaContext}

Graph:
${JSON.stringify(graph, null, 2)}

Evaluate semantic framing, reasoning mode, and causal logic.
Do NOT infer contamination from domain vocabulary alone.

Score each leakage 0-100 (0=none). Score overall_purity 0-100 (100=pure).`;
  const text = await callAI({
    model: MODEL.EVALUATION,
    contents: prompt,
    config: { responseMimeType: 'application/json', responseSchema: IR_PURITY_SCHEMA as any, temperature: 0 },
  });
  return JSON.parse(text);
}

// ─── Utility: Text Hashing ───────────────────────────────────────────────────
function hashText(text: string): string {
  return crypto.createHash('sha256').update(text).digest('hex').slice(0, 16);
}

// ─── Required persona set — fail-closed guard ───────────────────────────────────────
// An unrecognised persona would return compliant:true from checkTopology
// ("no topology to enforce"), silently passing the topology gate.
// This guard ensures the experiment fails loudly on unexpected personas.
const REQUIRED_PERSONAS = ['intellectual', 'developer', 'psychology', 'creative'] as const;
type RequiredPersona = (typeof REQUIRED_PERSONAS)[number];

function assertSupportedPersona(persona: string, caseId: string): asserts persona is RequiredPersona {
  if (!(REQUIRED_PERSONAS as readonly string[]).includes(persona)) {
    throw new Error(`Unsupported persona "${persona}" in ${caseId} — checkTopology would silently pass. Aborting.`);
  }
}

// ─── Evaluator majority-vote block ───────────────────────────────────────────
interface EvalVote {
  // Persona
  predicted_persona_votes: string[];
  predicted_persona: string;   // majority vote
  identity_correct: boolean;   // majority vote
  identity_disagreement_rate: number;

  // Contamination (intellectual only)
  is_contaminated_votes: boolean[];
  is_contaminated: boolean;    // majority vote
  contamination_disagreement_rate: number;
  contamination_types: string[];

  // Node coverage
  node_coverage_votes: number[];
  node_coverage: number;       // mean
  node_coverage_stddev: number;
}

async function evaluateWithMajorityVote(
  renderedText: string,
  persona: string,
  arm: string,
  renderIdx: number,
): Promise<EvalVote> {
  const PERSONA_LETTER = PERSONA_LETTER_MAP[persona as keyof typeof PERSONA_LETTER_MAP];

  // Run E_REPEATS evaluator calls in parallel
  const personaVotePromises = Array.from({ length: E_REPEATS }, (_, i) =>
    limitedCall(() => retry(
      () => evaluatePersona(renderedText, 'v2', { temperature: 0 }),
      `persona-${arm}-r${renderIdx}-e${i}`,
    ))
  );

  const coverageVotePromises = Array.from({ length: E_REPEATS }, (_, i) =>
    limitedCall(() => retry(
      () => evaluateContractNodeCoverage(renderedText, persona as any, { temperature: 0 }),
      `coverage-${arm}-r${renderIdx}-e${i}`,
    ))
  );

  // Contamination only for intellectual
  const contaminationVotePromises = persona === 'intellectual'
    ? Array.from({ length: E_REPEATS }, (_, i) =>
        limitedCall(() => retry(
          () => evaluateIntellectualContamination(renderedText, { temperature: 0 }),
          `contamination-${arm}-r${renderIdx}-e${i}`,
        ))
      )
    : [];

  const [personaResults, coverageResults, contaminationResults] = await Promise.all([
    Promise.all(personaVotePromises),
    Promise.all(coverageVotePromises),
    Promise.all(contaminationVotePromises),
  ]);

  const predicted_persona_votes = personaResults.map(r => r.predicted_persona);
  const predicted_persona = majorityVoteString(predicted_persona_votes);
  const identity_correct_votes = predicted_persona_votes.map(p => p === PERSONA_LETTER);
  const identity_correct = majorityVoteBoolean(identity_correct_votes);
  const identity_disagreement_rate = identity_correct_votes.filter(v => v !== identity_correct).length / E_REPEATS;

  const node_coverage_votes = coverageResults.map(r => r.nodes_found);
  const node_coverage = getMean(node_coverage_votes);
  const node_coverage_stddev = getStdDev(node_coverage_votes);

  let is_contaminated_votes: boolean[] = [];
  let is_contaminated = false;
  let contamination_disagreement_rate = 0;
  let contamination_types: string[] = [];

  if (persona === 'intellectual' && contaminationResults.length > 0) {
    is_contaminated_votes = contaminationResults.map(r => r.is_developer_contaminated);
    is_contaminated = majorityVoteBoolean(is_contaminated_votes);
    contamination_disagreement_rate = is_contaminated_votes.filter(v => v !== is_contaminated).length / E_REPEATS;
    contamination_types = contaminationResults.map(r => r.contamination_type);
  }

  return {
    predicted_persona_votes, predicted_persona, identity_correct, identity_disagreement_rate,
    is_contaminated_votes, is_contaminated, contamination_disagreement_rate, contamination_types,
    node_coverage_votes, node_coverage, node_coverage_stddev,
  };
}

// ─── Single arm execution ─────────────────────────────────────────────────────
interface ArmResult015 {
  arm: 'I0' | 'I1';
  persona: string;
  constraints_sha256: string;
  plannerIRHash: string;
  plannerIR: any;
  topology: TopologyResult;
  ir_purity: number;
  ir_purity_detail: PurityResult;
  // Per-render observations (R_REPEATS entries)
  renders: Array<{
    render_idx: number;
    renderedText: string;
    renderedTextHash: string;
    eval: EvalVote;
  }>;
  // cell_majority_identity_correct = majority vote over the R_REPEATS renders
  cell_majority_identity_correct: boolean;
  // render_identity_accuracy_pct = % of renders where evaluator majority said correct
  // (diagnostic per-arm; the aggregate gate uses the boolean above across 24 cells)
  render_identity_accuracy_pct: number;
  is_contaminated: boolean;      // majority vote across renders (intellectual only)
  contamination_rate: number;    // % renders contaminated (intellectual only)
  node_coverage_mean: number;
  node_coverage_stddev: number;
  identityEvaluatorDisagreementMean: number;
  contaminationEvaluatorDisagreementMean: number;
}

async function runArm(
  topic: string,
  persona: string,
  arm: 'I0' | 'I1',
  constraints: string,
  caseId: string,
): Promise<ArmResult015> {
  console.log(`\n     [Planner ${arm}] Generating IR...`);
  const plannerIR = await limitedCall(() => retry(
    () => runPlanner(topic, persona, constraints, arm),
    `planner-${arm}-${caseId}`,
  ));

  const topology = checkTopology(plannerIR, persona);
  const plannerIRHash = hashIR(plannerIR);

  console.log(`     [L1] IR Purity...`);
  const purity = await limitedCall(() => retry(
    () => evalIRPurity(plannerIR, persona),
    `purity-${arm}-${caseId}`,
  ));

  const renders: ArmResult015['renders'] = [];

  for (let r = 1; r <= R_REPEATS; r++) {
    process.stdout.write(`     [R${r}/${R_REPEATS}] Render+Eval×${E_REPEATS}... `);
    const renderedText = await limitedCall(() => retry(
      () => renderR2(plannerIR),
      `render-${arm}-${caseId}-r${r}`,
    ));
    const evalVote = await evaluateWithMajorityVote(renderedText, persona, `${arm}-${caseId}`, r);
    process.stdout.write(`${evalVote.identity_correct ? '✅' : '❌'} ${persona === 'intellectual' ? (evalVote.is_contaminated ? '🔴' : '🟢') : ''}\n`);
    renders.push({ render_idx: r, renderedText, renderedTextHash: hashText(renderedText), eval: evalVote });
  }

  // Aggregate across renders
  const identity_correct_across_renders = renders.map(r => r.eval.identity_correct);
  const cell_majority_identity_correct = majorityVoteBoolean(identity_correct_across_renders);
  // render_identity_accuracy_pct: % of the R_REPEATS renders where the per-render majority said correct.
  // NOTE: The 24-cell gate uses the boolean cell_majority_identity_correct aggregated across cells, not this per-arm %-figure.
  const render_identity_accuracy_pct = (identity_correct_across_renders.filter(Boolean).length / R_REPEATS) * 100;

  const contamination_across_renders = persona === 'intellectual'
    ? renders.map(r => r.eval.is_contaminated)
    : [];
  const is_contaminated = persona === 'intellectual' ? majorityVoteBoolean(contamination_across_renders) : false;
  const contamination_rate = persona === 'intellectual'
    ? (contamination_across_renders.filter(Boolean).length / R_REPEATS) * 100 : 0;

  const coverages = renders.map(r => r.eval.node_coverage);
  
  const identityEvaluatorDisagreementMean = getMean(renders.map(r => r.eval.identity_disagreement_rate));
  const contaminationEvaluatorDisagreementMean = persona === 'intellectual' 
    ? getMean(renders.map(r => r.eval.contamination_disagreement_rate)) 
    : 0;

  return {
    arm,
    persona,
    constraints_sha256: crypto.createHash('sha256').update(constraints).digest('hex').slice(0, 12),
    plannerIRHash,
    plannerIR,
    topology,
    ir_purity: purity.overall_purity,
    ir_purity_detail: purity,
    renders,
    cell_majority_identity_correct,
    render_identity_accuracy_pct,
    is_contaminated,
    contamination_rate,
    node_coverage_mean: getMean(coverages),
    node_coverage_stddev: getStdDev(coverages),
    identityEvaluatorDisagreementMean,
    contaminationEvaluatorDisagreementMean,
  };
}

// ─── Main ─────────────────────────────────────────────────────────────────────
async function run() {
  const isSmokeTest = process.argv.includes('--smoke');

  // Load dataset directly to get true topic prompts
  const datasetPath = path.join(__dirname, 'datasets', 'dataset-exp-005.json');
  if (!fs.existsSync(datasetPath)) {
    console.error(`❌ Dataset not found: ${datasetPath}`); process.exit(1);
  }
  const dataset = JSON.parse(fs.readFileSync(datasetPath, 'utf-8'));

  // Build 24-cell matrix
  let cases: any[] = [];
  for (const topic of dataset.topics) {
    for (const persona of dataset.personas) {
      cases.push({
        caseId: `C${(cases.length + 1).toString().padStart(3, "0")}-${persona}-${topic.id}`,
        persona,
        topic: topic.prompt,
      });
    }
  }

  // Pre-calculate constraints hash manifest
  const constraintManifest = Object.fromEntries(
    ['intellectual', 'developer', 'psychology', 'creative'].map(p => {
      const constraints = buildSemanticPlannerConstraints(p as any);
      return [
        p,
        {
          sha256: crypto.createHash('sha256').update(constraints).digest('hex'),
          length: constraints.length,
        },
      ];
    })
  );

  // Fail-closed: reject any persona not in REQUIRED_PERSONAS
  for (const c of cases) {
    assertSupportedPersona(c.persona, c.caseId);
    if (!c.topic) {
      throw new Error(`Missing canonical topic for ${c.caseId}`);
    }
  }

  if (!isSmokeTest && cases.length !== 24) {
    throw new Error(`EXP-015 production gate requires exactly 24 cells; got ${cases.length}`);
  }

  if (!isSmokeTest) {
    const uniqueCases = new Set(cases.map(c => c.caseId));
    if (uniqueCases.size !== 24) throw new Error("Duplicate caseIds found");
    const personaCounts = cases.reduce((acc, c) => ({...acc, [c.persona]: (acc[c.persona] || 0) + 1}), {} as Record<string,number>);
    for (const p of ['intellectual', 'developer', 'psychology', 'creative']) {
      if (personaCounts[p] !== 6) throw new Error(`Expected 6 cases for ${p}, got ${personaCounts[p]}`);
    }
  }

  if (isSmokeTest) {
    cases = cases.slice(0, 4); // one per persona
    console.log(`\n  [SMOKE] Running ${cases.length} cases only.\n`);
  }

  const reportPath = path.join(__dirname, 'benchmark-reports', `exp-015-production-gate-${Date.now()}.json`);

  console.log(`\n${'═'.repeat(60)}`);
  console.log(`  EXP-015: Production Gate — Full 24-Cell Matrix`);
  console.log(`  Renderer: R2 frozen, temp=0, ${R_REPEATS}×/IR`);
  console.log(`  Evaluators: temp=0, ${E_REPEATS}×/render (majority vote)`);
  console.log(`  Cases: ${cases.length} / 24`);
  console.log(`  I1 manifest sha256 computed.`);
  console.log(`${'═'.repeat(60)}\n`);

  const caseResults: any[] = [];

  for (let i = 0; i < cases.length; i++) {
    const c = cases[i];
    const i0Constraints = I0_CONSTRAINTS[c.persona] ?? '';
    const i1Constraints = buildSemanticPlannerConstraints(c.persona as any);

    console.log(`\n[${i+1}/${cases.length}] ${c.caseId} | ${c.persona.toUpperCase()}`);
    console.log(`${'─'.repeat(55)}`);

    console.log(`\n  ── ARM I0 ──`);
    const armI0 = await runArm(c.topic, c.persona, 'I0', i0Constraints, c.caseId);

    console.log(`\n  ── ARM I1 ──`);
    const armI1 = await runArm(c.topic, c.persona, 'I1', i1Constraints, c.caseId);

    const result = {
      caseId: c.caseId, persona: c.persona, topic: c.topic,
      I0: armI0, I1: armI1,
      delta: {
        identity_delta: (armI1.cell_majority_identity_correct ? 1 : 0) - (armI0.cell_majority_identity_correct ? 1 : 0),
        contamination_delta: c.persona === 'intellectual'
          ? (armI1.is_contaminated ? 1 : 0) - (armI0.is_contaminated ? 1 : 0) : null,
        ir_purity_delta: armI1.ir_purity - armI0.ir_purity,
      },
    };

    console.log(`\n  ── DELTA ──`);
    console.log(`     Identity:    I0=${armI0.cell_majority_identity_correct?'✅':'❌'} (${armI0.render_identity_accuracy_pct.toFixed(0)}%) → I1=${armI1.cell_majority_identity_correct?'✅':'❌'} (${armI1.render_identity_accuracy_pct.toFixed(0)}%)`);
    console.log(`     IR Purity:   I0=${armI0.ir_purity} → I1=${armI1.ir_purity}`);
    console.log(`     Topology:    I0=${armI0.topology.compliant?'PASS':'FAIL'} | I1=${armI1.topology.compliant?'PASS':'FAIL'}`);
    if (c.persona === 'intellectual') {
      console.log(`     Contaminated:I0=${armI0.is_contaminated?'🔴':'🟢'} (${armI0.contamination_rate.toFixed(0)}%) → I1=${armI1.is_contaminated?'🔴':'🟢'} (${armI1.contamination_rate.toFixed(0)}%)`);
    }

    caseResults.push(result);

    // Save incrementally
    fs.writeFileSync(reportPath, JSON.stringify({
      summary: { experiment: 'EXP-015', status: 'IN_PROGRESS', total429s, totalAttempts, constraints: constraintManifest },
      cases: caseResults,
    }, null, 2));
  }

  // ─── Final Aggregation ────────────────────────────────────────────────────
  const n = caseResults.length;
  const intellectualCases = caseResults.filter(r => r.persona === 'intellectual');

  function aggregateArm(key: 'I0' | 'I1') {
    const arms = caseResults.map(r => r[key]);
    
    // Cell-majority identity accuracy
    const cell_majority_identity_accuracy_pct = (arms.filter(a => a.cell_majority_identity_correct).length / n) * 100;

    // Render-level identity accuracy
    let totalRenders = 0;
    let correctRenders = 0;
    for (const a of arms) {
      for (const r of a.renders) {
        totalRenders++;
        if (r.eval.identity_correct) correctRenders++;
      }
    }
    const render_level_identity_accuracy_pct = totalRenders > 0 ? (correctRenders / totalRenders) * 100 : 0;

    return {
      cell_majority_identity_accuracy_pct,
      render_level_identity_accuracy_pct,
      avg_ir_purity: getMean(arms.map(a => a.ir_purity)),
      topology_compliance_pct: (arms.filter(a => a.topology.compliant).length / n) * 100,
      cells_with_forbidden_nodes: arms.filter(a => a.topology.forbidden_nodes_found.length > 0).length,
      avg_node_coverage: getMean(arms.map(a => a.node_coverage_mean)),
      avg_identity_evaluator_disagreement: getMean(arms.map(a => a.identityEvaluatorDisagreementMean)),
      avg_contamination_evaluator_disagreement: getMean(arms.filter(a => a.persona === 'intellectual').map(a => a.contaminationEvaluatorDisagreementMean)),
      // Intellectual subset - majority-contaminated cell rate
      intellectual_cell_majority_contamination_rate: intellectualCases.length > 0
        ? (intellectualCases.filter(r => r[key].is_contaminated).length / intellectualCases.length) * 100 : 0,
    };
  }

  const aggI0 = aggregateArm('I0');
  const aggI1 = aggregateArm('I1');

  const gates = {
    cell_majority_identity_accuracy: aggI1.cell_majority_identity_accuracy_pct >= 85,
    cell_majority_contamination:     aggI1.intellectual_cell_majority_contamination_rate <= 10,
    ir_purity:                       aggI1.avg_ir_purity >= 90,
    forbidden_nodes:                 aggI1.cells_with_forbidden_nodes === 0,
    topology_compliance:             aggI1.topology_compliance_pct === 100,
  };
  const overallPass = Object.values(gates).every(Boolean);

  console.log(`\n\n${'═'.repeat(60)}`);
  console.log(`  EXP-015 RESULTS — FULL ${n}-CELL MATRIX`);
  console.log(`  Protocol: ${R_REPEATS}× renders, ${E_REPEATS}× evaluators (majority vote)`);
  console.log(`${'═'.repeat(60)}\n`);

  console.log(`  LAYER 1 — Planner Validity`);
  console.log(`  ${'Metric'.padEnd(32)} ${'I0'.padEnd(12)} ${'I1'.padEnd(12)} Gate`);
  console.log(`  ${'─'.repeat(70)}`);
  console.log(`  ${'IR Purity (mean)'.padEnd(32)} ${aggI0.avg_ir_purity.toFixed(1).padEnd(12)} ${aggI1.avg_ir_purity.toFixed(1).padEnd(12)} ≥90 → ${gates.ir_purity?'✅':'❌'}`);
  console.log(`  ${'Topology compliance'.padEnd(32)} ${(aggI0.topology_compliance_pct.toFixed(0)+'%').padEnd(12)} ${(aggI1.topology_compliance_pct.toFixed(0)+'%').padEnd(12)} 100% → ${gates.topology_compliance?'✅':'❌'}`);
  console.log(`  ${'Cells with forbidden nodes'.padEnd(32)} ${String(aggI0.cells_with_forbidden_nodes).padEnd(12)} ${String(aggI1.cells_with_forbidden_nodes).padEnd(12)} =0 → ${gates.forbidden_nodes?'✅':'❌'}`);

  console.log(`\n  LAYER 2 — Identity & Contamination`);
  console.log(`  ${'Metric'.padEnd(38)} ${'I0'.padEnd(12)} ${'I1'.padEnd(12)} Gate`);
  console.log(`  ${'─'.repeat(75)}`);
  console.log(`  ${'Cell-majority identity acc.'.padEnd(38)} ${(aggI0.cell_majority_identity_accuracy_pct.toFixed(1)+'%').padEnd(12)} ${(aggI1.cell_majority_identity_accuracy_pct.toFixed(1)+'%').padEnd(12)} ≥85% → ${gates.cell_majority_identity_accuracy?'✅':'❌'}`);
  console.log(`  ${'Cell-maj contamin. (6 cells=0)'.padEnd(38)} ${(aggI0.intellectual_cell_majority_contamination_rate.toFixed(1)+'%').padEnd(12)} ${(aggI1.intellectual_cell_majority_contamination_rate.toFixed(1)+'%').padEnd(12)} ≤10% → ${gates.cell_majority_contamination?'✅':'❌'}`);
  console.log(`  ${'Render-level identity acc.'.padEnd(38)} ${(aggI0.render_level_identity_accuracy_pct.toFixed(1)+'%').padEnd(12)} ${(aggI1.render_level_identity_accuracy_pct.toFixed(1)+'%').padEnd(12)} (diagnostic)`);
  console.log(`  ${'Node coverage (mean/5)'.padEnd(38)} ${aggI0.avg_node_coverage.toFixed(2).padEnd(12)} ${aggI1.avg_node_coverage.toFixed(2).padEnd(12)} (diagnostic)`);
  console.log(`  ${'Identity eval. disagreement'.padEnd(38)} ${(aggI0.avg_identity_evaluator_disagreement*100).toFixed(1)+'%'.padEnd(12)} ${(aggI1.avg_identity_evaluator_disagreement*100).toFixed(1)+'%'.padEnd(12)} (diagnostic)`);
  console.log(`  ${'Contamin. eval. disagreement'.padEnd(38)} ${(aggI0.avg_contamination_evaluator_disagreement*100).toFixed(1)+'%'.padEnd(12)} ${(aggI1.avg_contamination_evaluator_disagreement*100).toFixed(1)+'%'.padEnd(12)} (diagnostic)`);

  console.log(`\n  ${'─'.repeat(60)}`);
  console.log(`  EXP-015 PRODUCTION GATE: ${overallPass ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`  Gates: identity=${gates.cell_majority_identity_accuracy?'✅':'❌'} | contamination=${gates.cell_majority_contamination?'✅':'❌'} | purity=${gates.ir_purity?'✅':'❌'} | forbidden=${gates.forbidden_nodes?'✅':'❌'} | topology=${gates.topology_compliance?'✅':'❌'}`);
  console.log(`  API: ${totalAttempts} attempts, ${total429s} 429s`);

  if (overallPass) {
    console.log(`\n  ✅ I1 passes the production gate. Ready for integration.`);
  } else {
    const failedGates = Object.entries(gates).filter(([, v]) => !v).map(([k]) => k);
    console.log(`\n  ❌ Failed gates: ${failedGates.join(', ')}`);
    console.log(`  Investigate failed cells in the JSON report before proceeding.`);
  }

  const summary = {
    experiment: 'EXP-015',
    timestamp: new Date().toISOString(),
    protocol: { r_repeats: R_REPEATS, e_repeats: E_REPEATS, renderer_temp: 0, evaluator_temp: 0, planner_temp: 0 },
    n_cases: n,
    constraints: constraintManifest,
    aggregates: { I0: aggI0, I1: aggI1 },
    gates, overall_pass: overallPass,
    api_stats: { totalAttempts, total429s },
  };

  fs.writeFileSync(reportPath, JSON.stringify({ summary, cases: caseResults }, null, 2));
  console.log(`\n✅ Report saved → ${reportPath}\n`);
}

run().catch(console.error);
