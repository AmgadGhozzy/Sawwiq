/**
 * EXP-015: C005 Single-Cell Rerun
 *
 * Runs ONLY C005 (Developer × Procrastination) after:
 * 1. DEVELOPER CLAIM FORM semantic constraint added to semanticConstraints.ts
 * 2. IR Purity Evaluator made persona-aware via PURITY_EVALUATOR_CONTEXT
 *
 * Purpose: verify that:
 * - The planner produces full causal propositions instead of noun phrases / labels
 * - The IR purity evaluator evaluates framing mode instead of penalizing domain vocabulary
 *
 * Expected outcome:
 *   topology     PASS
 *   forbidden    0
 *   ir_purity    ≥90
 *   identity     ≥85% (majority vote over 5 renders)
 *   claim form   all full propositions (no noun phrases)
 *
 * I0 arm is included for delta reference. Do NOT edit I0_DEVELOPER.
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

// ─── Protocol ─────────────────────────────────────────────────────────────────
const R_REPEATS = 5;
const E_REPEATS = 3;

// ─── I0 baseline (FROZEN) ─────────────────────────────────────────────────────
const I0_DEVELOPER = `Developer Constraints:
- system: Identify a concrete system or process.
- constraint: Locate the bottleneck or failure point.
- mechanism: Explain the causal link.
- intervention: A structural change targeting the mechanism.
- consequence: An observable, specific outcome.`;

// ─── I0 PLANNER_SCHEMA (old graph schema, frozen for I0 arm) ─────────────────
const ALLOWED_NODES_I0 = [
  'observation', 'assumption', 'trigger', 'system', 'constraint',
  'motive', 'behavior', 'reinforcement', 'contradiction', 'reframe',
  'scene', 'association', 'tension', 'transformation', 'outcome',
  'bottleneck', 'mechanism', 'intervention', 'sensory_detail',
  'return_to_scene', 'awareness_shift', 'why_fails', 'synthesis', 'shift',
  'consequence',
];
const ALLOWED_EDGES_I0 = [
  'causes', 'constrains', 'reinforces', 'contradicts', 'reframes',
  'maps_to', 'transforms', 'results_in', 'leads_to', 'produces',
];
const PLANNER_SCHEMA_I0 = {
  type: Type.OBJECT,
  properties: {
    nodes: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          id: { type: Type.STRING },
          type: { type: Type.STRING, enum: ALLOWED_NODES_I0 },
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
          relation: { type: Type.STRING, enum: ALLOWED_EDGES_I0 },
        },
        required: ['from', 'to', 'relation'],
      },
    },
  },
  required: ['nodes', 'edges'],
};

// ─── Schemas ──────────────────────────────────────────────────────────────────
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

const IR_PURITY_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    structural_purity: { type: Type.NUMBER },
    developer_leakage: { type: Type.NUMBER },
    psychology_leakage: { type: Type.NUMBER },
    creative_leakage: { type: Type.NUMBER },
    overall_purity: { type: Type.NUMBER },
  },
  required: [
    'structural_purity',
    'developer_leakage',
    'psychology_leakage',
    'creative_leakage',
    'overall_purity',
  ],
};

// ─── Utilities ────────────────────────────────────────────────────────────────
const delay = (ms: number) => new Promise(res => setTimeout(res, ms));
let total429s = 0;
let totalAttempts = 0;

function majorityVoteBoolean(arr: boolean[]): boolean {
  return arr.filter(Boolean).length > arr.length / 2;
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
  const sumSq = arr.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0);
  return Math.sqrt(sumSq / arr.length);
}

function hashText(text: string): string {
  return crypto.createHash('sha256').update(text).digest('hex').slice(0, 16);
}

// ─── Concurrency limiter ──────────────────────────────────────────────────────
const MAX_CONCURRENT = 3;
let _active = 0;
const _queue: Array<() => void> = [];
function acquireSemaphore(): Promise<void> {
  return new Promise(resolve => {
    if (_active < MAX_CONCURRENT) {
      _active++;
      resolve();
    } else {
      _queue.push(() => {
        _active++;
        resolve();
      });
    }
  });
}
function releaseSemaphore() {
  _active--;
  if (_queue.length > 0) {
    const next = _queue.shift()!;
    next();
  }
}
async function limitedCall<T>(fn: () => Promise<T>): Promise<T> {
  await acquireSemaphore();
  try {
    return await fn();
  } finally {
    releaseSemaphore();
  }
}

async function retry<T>(fn: () => Promise<T>, label = 'op'): Promise<T> {
  const MAX_ATTEMPTS = 8;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    totalAttempts++;
    try {
      return await fn();
    } catch (e: any) {
      if (attempt >= MAX_ATTEMPTS) {
        console.error(`     [Fatal] ${label} failed:`, e?.message ?? e);
        throw e;
      }
      const is429 =
        e?.status === 429 ||
        e?.error?.code === 429 ||
        (e?.message ?? '').includes('429') ||
        (e?.message ?? '').includes('RESOURCE_EXHAUSTED') ||
        (e?.message ?? '').includes('API_KEY_SERVICE_BLOCKED');
      if (is429) total429s++;
      const baseMs = is429 ? 15_000 : 3_000;
      const waitMs = Math.min(
        baseMs * Math.pow(1.8, attempt - 1) + Math.random() * 2_000,
        60_000,
      );
      const remaining = MAX_ATTEMPTS - attempt;
      console.error(
        `     [Retry] ${label} (${is429 ? '429' : e?.status ?? 'ERR'}) → ${(waitMs / 1000).toFixed(1)}s (${remaining} left)`,
      );
      await delay(waitMs);
    }
  }
  throw new Error('Max retries exceeded');
}

/**
 * Diagnostic heuristic to identify label-like / noun-phrase claims.
 * Used for claim form auditing in C005 rerun.
 */
function looksLikeNounPhrase(claim: string): boolean {
  const normalized = claim.trim().replace(/\s+/g, ' ');
  if (!normalized) return true;

  // Common English label-like patterns.
  if (/^[A-Z][\w'-]*(\s+[A-Z][\w'-]*)*\.$/.test(normalized)) {
    return true;
  }

  // English finite/relational verbs and common predicative verbs
  const englishVerbPattern =
    /\b(is|are|was|were|be|being|been|causes?|creates?|increases?|reduces?|prevents?|enables?|requires?|leads?|produces?|constrains?|depends?|drives?|inhibits?|results?|prioritizes?|avoids?|determines?|forces?|shapes?|limits?|controls?|shifts?|triggers?|activates?|generates?|modifies?|sustains?)\b/i;

  // Arabic relational/finite verbs and common verbal patterns
  const arabicVerbPattern =
    /(يؤدي|تقود|يقود|تؤدي|يسبب|تسبب|ينتج|تنتج|يزيد|تزيد|يقلل|تقلل|يتطلب|تتطلب|يجعل|تجعل|يخلق|تخلق|يمنع|تمنع|يمكن|تمكن|يعتمد|تعتمد|يفضل|تفضل|يعزز|تعزز|يحسن|تحسن|يغير|تغير|يدفع|تدفع|يؤجل|تؤجل|يكون|تكون|كان|كانت|يمثل|تمثل|يشكل|تشكل|يرتبط|ترتبط|ينشأ|تنشأ|يحدث|تحدث|يحفز|تحفز|يرفع|ترفع|يخفض|تخفض)/;

  const hasVerb = englishVerbPattern.test(normalized) || arabicVerbPattern.test(normalized);
  return !hasVerb;
}

// ─── LLM Calls ────────────────────────────────────────────────────────────────
async function runPlannerI1(topic: string, persona: PersonaId, constraints: string): Promise<any> {
  const prompt = `You are the Causal Planner for the ${persona.toUpperCase()} persona.
Your task is to populate the required semantic components representing
the argument based on the topic: "${topic}"

SEMANTIC CONSTRAINTS (enforce strictly):
${constraints}

Generate the semantic components now.`;

  const schema = buildPlannerSchema(persona);
  const text = await limitedCall(() =>
    retry(
      () =>
        callAI({
          model: MODEL.GENERATION,
          contents: prompt,
          config: { responseMimeType: 'application/json', responseSchema: schema as any, temperature: 0 },
        }),
      'planner-I1',
    ),
  );
  const plannerOutput = JSON.parse(text);
  return compilePlannerOutputToGraph(plannerOutput, persona);
}

async function runPlannerI0(topic: string, persona: string, constraints: string): Promise<any> {
  const prompt = `You are the Causal Planner for the ${persona.toUpperCase()} persona.
Your task is to populate a machine-verifiable Causal Graph (nodes and edges) representing
the argument based on the topic: "${topic}"

SEMANTIC CONSTRAINTS (enforce strictly):
${constraints}

Generate the Causal Graph now.`;

  const text = await limitedCall(() =>
    retry(
      () =>
        callAI({
          model: MODEL.GENERATION,
          contents: prompt,
          config: { responseMimeType: 'application/json', responseSchema: PLANNER_SCHEMA_I0 as any, temperature: 0 },
        }),
      'planner-I0',
    ),
  );
  return JSON.parse(text);
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

  const text = await limitedCall(() =>
    retry(
      () =>
        callAI({
          model: MODEL.GENERATION,
          contents: prompt,
          config: { responseMimeType: 'application/json', responseSchema: CONTENT_SCHEMA as any, temperature: 0 },
        }),
      'render',
    ),
  );
  const d = JSON.parse(text);
  return [d.title, d.hook, d.body, d.closing].filter(Boolean).join('\n\n');
}

async function evalIRPurity(
  graph: any,
  targetPersona: string,
  label: string,
): Promise<PurityResult> {
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

  const text = await limitedCall(() =>
    retry(
      () =>
        callAI({
          model: MODEL.EVALUATION,
          contents: prompt,
          config: { responseMimeType: 'application/json', responseSchema: IR_PURITY_SCHEMA as any, temperature: 0 },
        }),
      `purity-${label}`,
    ),
  );
  return JSON.parse(text);
}

// ─── Main ─────────────────────────────────────────────────────────────────────
async function run() {
  const topic = 'اكتب عن لماذا يؤجل معظم الناس المهام الصعبة وما هي الطريقة الحقيقية للتغلب على التسويف.';
  const persona: PersonaId = 'developer';
  const expectedPersonaLetter = PERSONA_LETTER_MAP['developer']; // 'A'
  const caseId = 'C005-developer-T-P02';

  const i1Constraints = buildSemanticPlannerConstraints(persona);
  const i1Sha = crypto.createHash('sha256').update(i1Constraints).digest('hex');

  console.log(`\n${'═'.repeat(60)}`);
  console.log(`  EXP-015: C005 Single-Cell Rerun`);
  console.log(`  Topic: ${topic}`);
  console.log(`  Persona: ${persona.toUpperCase()} (Target letter: ${expectedPersonaLetter})`);
  console.log(`  Fix: Developer CLAIM FORM contract + Persona-aware IR Purity`);
  console.log(`  I1 sha256: ${i1Sha.slice(0, 16)}...`);
  console.log(`${'═'.repeat(60)}\n`);

  const arms: Record<string, any> = {};

  for (const arm of ['I0', 'I1'] as const) {
    console.log(`\n  ── ARM ${arm} ──\n`);

    let plannerIR: any;
    console.log(`     [Planner ${arm}] Generating IR...`);
    if (arm === 'I0') {
      plannerIR = await runPlannerI0(topic, persona, I0_DEVELOPER);
    } else {
      plannerIR = await runPlannerI1(topic, persona, i1Constraints);
    }

    const topology = checkTopology(plannerIR, persona);

    // ── Claim Form Audit ──
    console.log(`\n     [CLAIM FORM AUDIT - ${arm}]`);
    const claimAudit: Array<{
      id: string;
      type: string;
      claim: string;
      length: number;
      isNounPhrase: boolean;
    }> = [];

    let nounPhraseCount = 0;
    for (const node of plannerIR.nodes || []) {
      const claim = node.claim || '';
      const isNounPhrase = looksLikeNounPhrase(claim);
      if (isNounPhrase) nounPhraseCount++;
      claimAudit.push({
        id: node.id,
        type: node.type,
        claim,
        length: claim.length,
        isNounPhrase,
      });
      const flag = isNounPhrase ? '⚠ noun-phrase' : '✓ proposition';
      console.log(`       ${node.id.padEnd(14)} (${node.type.padEnd(12)}) len=${String(claim.length).padEnd(3)} ${flag}`);
      console.log(`         "${claim}"`);
    }

    console.log(`\n     [L1] IR Purity Evaluator...`);
    const purityDetail = await evalIRPurity(plannerIR, persona, `${arm}-${caseId}`);
    const ir_purity = purityDetail.overall_purity;

    console.log(`       overall_purity:    ${purityDetail.overall_purity}`);
    console.log(`       structural_purity: ${purityDetail.structural_purity}`);
    console.log(`       psychology_leakage:${purityDetail.psychology_leakage}`);
    console.log(`       developer_leakage: ${purityDetail.developer_leakage}`);
    console.log(`       creative_leakage:  ${purityDetail.creative_leakage}`);

    const renders: any[] = [];

    for (let r = 1; r <= R_REPEATS; r++) {
      process.stdout.write(`     [R${r}/${R_REPEATS}] Render+Eval×${E_REPEATS}... `);

      const renderedText = await renderR2(plannerIR);

      const personaVotePromises = Array.from({ length: E_REPEATS }, (_, i) =>
        limitedCall(() =>
          retry(
            () => evaluatePersona(renderedText, 'v2', { temperature: 0 }),
            `persona-${arm}-r${r}-e${i}`,
          ),
        ),
      );

      const coverageVotePromises = Array.from({ length: E_REPEATS }, (_, i) =>
        limitedCall(() =>
          retry(
            () => evaluateContractNodeCoverage(renderedText, persona, { temperature: 0 }),
            `coverage-${arm}-r${r}-e${i}`,
          ),
        ),
      );

      const [personaResults, coverageResults] = await Promise.all([
        Promise.all(personaVotePromises),
        Promise.all(coverageVotePromises),
      ]);

      const personaVotes = personaResults.map(res => res.predicted_persona);
      const identityCorrectVotes = personaVotes.map(p => p === expectedPersonaLetter);
      const coverageVotes = coverageResults.map(res => res.nodes_found ?? 0);

      const identityCorrect = majorityVoteBoolean(identityCorrectVotes);
      const predictedPersona = majorityVoteString(personaVotes);
      const identityDisagreementRate = identityCorrectVotes.filter(v => v !== identityCorrect).length / E_REPEATS;

      process.stdout.write(`${identityCorrect ? '✅' : '❌'} (${predictedPersona})\n`);

      renders.push({
        render_idx: r,
        renderedText,
        renderedTextHash: hashText(renderedText),
        eval: {
          predicted_persona_votes: personaVotes,
          predicted_persona: predictedPersona,
          identity_correct: identityCorrect,
          identity_disagreement_rate: identityDisagreementRate,
          node_coverage_votes: coverageVotes,
          node_coverage: getMean(coverageVotes),
          node_coverage_stddev: getStdDev(coverageVotes),
        },
      });

      // Small pacing delay between renders to preserve token quotas
      await delay(1000);
    }

    const identityCorrectRenders = renders.filter(r => r.eval.identity_correct).length;
    const cell_majority_identity_correct = identityCorrectRenders >= Math.ceil(R_REPEATS / 2);
    const render_identity_accuracy_pct = (identityCorrectRenders / R_REPEATS) * 100;
    const node_coverage_mean = getMean(renders.map(r => r.eval.node_coverage));
    const identityEvaluatorDisagreementMean = getMean(renders.map(r => r.eval.identity_disagreement_rate));

    arms[arm] = {
      arm,
      persona,
      plannerIR,
      topology,
      claimAudit,
      nounPhraseCount,
      ir_purity,
      ir_purity_detail: purityDetail,
      renders,
      cell_majority_identity_correct,
      render_identity_accuracy_pct,
      node_coverage_mean,
      identityEvaluatorDisagreementMean,
    };
  }

  // ─── Delta Comparison ────────────────────────────────────────────────────
  console.log(`\n  ── DELTA COMPARISON ──`);
  const I0 = arms['I0'], I1 = arms['I1'];
  console.log(`     Identity:            I0=${I0.cell_majority_identity_correct ? '✅' : '❌'} (${I0.render_identity_accuracy_pct.toFixed(0)}%) → I1=${I1.cell_majority_identity_correct ? '✅' : '❌'} (${I1.render_identity_accuracy_pct.toFixed(0)}%)`);
  console.log(`     IR Purity (overall): I0=${I0.ir_purity} → I1=${I1.ir_purity}`);
  console.log(`     Structural Purity:   I0=${I0.ir_purity_detail.structural_purity} → I1=${I1.ir_purity_detail.structural_purity}`);
  console.log(`     Psychology Leakage:  I0=${I0.ir_purity_detail.psychology_leakage} → I1=${I1.ir_purity_detail.psychology_leakage}`);
  console.log(`     Developer Leakage:   I0=${I0.ir_purity_detail.developer_leakage} → I1=${I1.ir_purity_detail.developer_leakage}`);
  console.log(`     Creative Leakage:    I0=${I0.ir_purity_detail.creative_leakage} → I1=${I1.ir_purity_detail.creative_leakage}`);
  console.log(`     Topology:            I0=${I0.topology.compliant ? 'PASS' : 'FAIL'} | I1=${I1.topology.compliant ? 'PASS' : 'FAIL'}`);
  console.log(`     Noun-Phrase Claims:  I0=${I0.nounPhraseCount}/${I0.claimAudit.length} → I1=${I1.nounPhraseCount}/${I1.claimAudit.length}`);

  // ─── Gate Summary ────────────────────────────────────────────────────────
  const identityGate = I1.cell_majority_identity_correct;
  const purityGate = I1.ir_purity >= 90;
  const topoGate = I1.topology.compliant;
  const claimGate = I1.nounPhraseCount === 0;

  console.log(`\n${'═'.repeat(60)}`);
  console.log(`  C005 RERUN RESULT`);
  console.log(`  identity (≥85%):    ${identityGate ? '✅ PASS' : '❌ FAIL'} (${I1.render_identity_accuracy_pct.toFixed(0)}%)`);
  console.log(`  topology (100%):    ${topoGate ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`  ir_purity (≥90):    ${purityGate ? '✅ PASS' : '❌ FAIL'} (${I1.ir_purity})`);
  console.log(`  claim form (props): ${claimGate ? '✅ PASS' : '⚠ NOUN PHRASES DETECTED'} (${I1.claimAudit.length - I1.nounPhraseCount}/${I1.claimAudit.length} propositions)`);
  console.log(`${'═'.repeat(60)}\n`);

  // ─── Save Report ─────────────────────────────────────────────────────────
  const reportsDir = path.join(__dirname, 'benchmark-reports');
  if (!fs.existsSync(reportsDir)) {
    fs.mkdirSync(reportsDir, { recursive: true });
  }

  const reportPath = path.join(reportsDir, `exp-015-c005-rerun-${Date.now()}.json`);
  fs.writeFileSync(
    reportPath,
    JSON.stringify(
      {
        experiment: 'EXP-015-C005-rerun',
        timestamp: new Date().toISOString(),
        fix: 'developer-claim-form-and-persona-aware-purity',
        i1_sha256: i1Sha,
        caseId,
        persona,
        topic,
        gates: {
          identity: identityGate,
          topology: topoGate,
          ir_purity: purityGate,
          claim_form: claimGate,
        },
        I0,
        I1,
        api_stats: { totalAttempts, total429s },
      },
      null,
      2,
    ),
  );
  console.log(`✅ Report saved → ${reportPath}\n`);
}

run().catch(console.error);
