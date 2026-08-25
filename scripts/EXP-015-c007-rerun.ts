/**
 * EXP-015: C007 Single-Cell Rerun
 *
 * Runs ONLY C007 (Intellectual × Procrastination) after:
 * 1. Domain-shift constraint fix in semanticConstraints.ts
 * 2. IR Purity Evaluator made persona-aware via PURITY_EVALUATOR_CONTEXT
 *
 * Purpose: verify that:
 * - The reframe node shifts to philosophy/epistemology rather than staying in psychological mechanisms
 * - The IR purity evaluator evaluates framing mode instead of penalizing domain vocabulary
 *
 * Expected outcome:
 *   topology     PASS
 *   contamination ≤10%
 *   identity     ≥85% (majority vote over 5 renders)
 *   purity       ≥90 (or diagnostic sub-score inspection)
 *   claim form   all full propositions
 *
 * I0 arm is included for delta reference. Do NOT edit I0_INTELLECTUAL.
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
const I0_INTELLECTUAL = `Intellectual Constraints:
- assumption: Starts from a widely held assumption.
- contradiction: Challenges/invalidates the assumption (NOT just discovering a problem).
- why_fails: Explains why the original framing is epistemologically insufficient.
- reframe: Redefines the question itself (FORBIDDEN: "the best solution is...").
- synthesis: A paradigm shift or philosophical redefinition (FORBIDDEN: recommendation).
- Global Forbidden: problem -> intervention -> measurable outcome.`;

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
 *
 * Uses a multi-layered approach instead of exhaustive verb enumeration:
 *   L1  Clause-structure markers (إن، أن، لأن…) → proposition by definition
 *   L2  Question words (ما هي، هل، لماذا…) → inherently propositional
 *   L3  Copula / existential (هو، هي، ليس…)
 *   L4  Morphological verb prefix patterns (Arabic Forms V/VI/VII/X + passive diacritics)
 *   L5  Explicit verb safety net (Form I–IV verbs lacking distinctive prefixes)
 */
function looksLikeNounPhrase(claim: string): boolean {
  const normalized = claim.trim().replace(/\s+/g, ' ');
  if (!normalized) return true;

  // English label-like capitalized phrases: "Task Difficulty Assessment."
  if (/^[A-Z][\w'-]*(\s+[A-Z][\w'-]*)*\.$/.test(normalized)) {
    return true;
  }

  // ── English verb detection ──
  const englishVerbPattern =
    /\b(is|are|was|were|be|being|been|causes?|creates?|increases?|reduces?|prevents?|enables?|requires?|leads?|produces?|constrains?|depends?|drives?|inhibits?|results?|prioritizes?|avoids?|determines?|forces?|shapes?|limits?|controls?|shifts?|triggers?|activates?|generates?|modifies?|sustains?)\b/i;

  if (englishVerbPattern.test(normalized)) return false;

  // ── Arabic proposition detection (morphology-first) ──

  // L1: Clause-structure markers (subordinators / connectives).
  //     Their presence implies multi-clause structure → proposition.
  if (/(?:^|\s)(?:إن|أن|لأن|حيث|مما|بينما|لكن|إذا|عندما|بحيث|لذلك|كلما|حين|رغم)(?:\s|$)/.test(normalized)) {
    return false;
  }

  // L2: Question words — questions are inherently propositional.
  if (/(?:^|\s)(?:ما هي|ما هو|ما الذي|هل|لماذا|كيف|أين|متى)\s/.test(normalized)) {
    return false;
  }

  // L3: Copula / existential verbs (bounded by whitespace or punctuation).
  if (/(?:^|\s)(?:هو|هي|ليس|ليست)(?:\s|[.،؟!]|$)/.test(normalized)) {
    return false;
  }

  // L4: Morphological verb detection (Arabic-aware).
  //
  // 4a – Augmented-form prefixes. These multi-char prefixes on present-
  //       tense verbs are almost exclusively verbal in Arabic:
  //         Form V/VI:  يت/تت/نت/أت + root letter  (يتفعّل / يتفاعل)
  //         Form X:     يست/تست/نست/أست + root letter (يستفعل)
  //       Range [\u0621-\u064A] = Arabic base letters (ء through ي),
  //       excluding combining marks and digits.
  //
  // 4b – Passive voice with explicit damma diacritic (U+064F) on the
  //       present-tense prefix letter (يُ / تُ / نُ / أُ + root letter).
  //       Catches يُفترض، تُبنى، يُعتبر, etc.
  const arabicMorphVerb =
    /(?:^|\s)(?:يست|تست|نست|أست|يت|تت|نت|أت)[\u0621-\u064A]|(?:^|\s)[يتنأ]\u064F[\u0621-\u064A]/;

  if (arabicMorphVerb.test(normalized)) return false;

  // L5: Explicit common verbs — safety net for Form I–IV verbs that
  //     lack distinctive multi-char prefixes in undiacriticized text.
  const arabicExplicitVerbs =
    /(يؤدي|تؤدي|يقود|تقود|يسبب|تسبب|ينتج|تنتج|يزيد|تزيد|يقلل|تقلل|يجعل|تجعل|يخلق|تخلق|يمنع|تمنع|يمكن|تمكن|يعتمد|تعتمد|يفضل|تفضل|يعزز|تعزز|يحسن|تحسن|يغير|تغير|يدفع|تدفع|يؤجل|تؤجل|يكون|تكون|كان|كانت|يمثل|تمثل|يشكل|تشكل|يحدث|تحدث|يحفز|تحفز|يرفع|ترفع|يخفض|تخفض|يفسر|تفسر|يكشف|تكشف|يعني|تعني|يفشل|تفشل|يؤثر|تؤثر|يحتاج|تحتاج|يبدأ|تبدأ|يصبح|تصبح|يظهر|تظهر|يبقى|تبقى|يعمل|تعمل|يوفر|توفر|يحقق|تحقق|يساعد|تساعد|يقدم|تقدم|يحدد|تحدد|يوجد|توجد|يعكس|تعكس|يبني|تبني)/;

  if (arabicExplicitVerbs.test(normalized)) return false;

  // No verb, clause marker, or copula detected → likely a noun phrase.
  return true;
}

function auditClaimForm(graph: any) {
  return (graph.nodes || []).map((node: any) => ({
    id: node.id,
    type: node.type,
    claim: node.claim ?? '',
    length: node.claim?.length ?? 0,
    noun_phrase_only: looksLikeNounPhrase(node.claim ?? ''),
  }));
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
  persona: PersonaId,
  label: string,
): Promise<PurityResult> {
  const personaContext = PURITY_EVALUATOR_CONTEXT[persona] ?? PURITY_EVALUATOR_FALLBACK;

  const prompt = `You are an IR Purity Auditor.

Assess this Causal Graph for cross-persona contamination.

Target persona: ${persona.toUpperCase()}

PERSONA CONTEXT:
${personaContext}

IMPORTANT:
- Topology is compiler-guaranteed. Do not treat graph topology as evidence of persona contamination.
- Evaluate semantic framing, reasoning mode, and explanatory logic.
- Domain vocabulary alone is NOT contamination.
- A topic may naturally belong to another discipline while still being analyzed through the target persona's reasoning mode.
- Distinguish what the graph is ABOUT from HOW the graph reasons about it.

Graph:
${JSON.stringify(graph, null, 2)}

Score:
- structural_purity: 0-100
- developer_leakage: 0-100, where 0 means no developer-style contamination
- psychology_leakage: 0-100, where 0 means no psychology-style contamination
- creative_leakage: 0-100, where 0 means no creative-style contamination
- overall_purity: 0-100, where 100 means fully pure target-persona reasoning

Return JSON only.`;

  const text = await limitedCall(() =>
    retry(
      () =>
        callAI({
          model: MODEL.EVALUATION,
          contents: prompt,
          config: {
            responseMimeType: 'application/json',
            responseSchema: IR_PURITY_SCHEMA as any,
            temperature: 0,
          },
        }),
      `purity-${label}`,
    ),
  );

  const r = JSON.parse(text);

  return {
    structural_purity: Number(r.structural_purity ?? 0),
    developer_leakage: Number(r.developer_leakage ?? 0),
    psychology_leakage: Number(r.psychology_leakage ?? 0),
    creative_leakage: Number(r.creative_leakage ?? 0),
    overall_purity: Number(r.overall_purity ?? 0),
  };
}

// ─── Main ─────────────────────────────────────────────────────────────────────
async function run() {
  const topic = "اكتب عن لماذا يؤجل معظم الناس المهام الصعبة وما هي الطريقة الحقيقية للتغلب على التسويف.";
  const persona: PersonaId = 'intellectual';
  const expectedPersonaLetter = PERSONA_LETTER_MAP['intellectual'];
  const caseId = 'C007-intellectual-T-P02';

  const i1Constraints = buildSemanticPlannerConstraints(persona);
  const i1Sha = crypto.createHash('sha256').update(i1Constraints).digest('hex');

  console.log(`\n${'═'.repeat(60)}`);
  console.log(`  EXP-015: C007 Single-Cell Rerun`);
  console.log(`  Fix: psychology-adjacent domain-shift rule + persona-aware IR purity`);
  console.log(`  I1 sha256: ${i1Sha.slice(0, 16)}...`);
  console.log(`${'═'.repeat(60)}\n`);

  const arms: Record<string, any> = {};

  for (const arm of ['I0', 'I1'] as const) {
    console.log(`\n  ── ARM ${arm} ──\n`);

    let plannerIR: any;
    console.log(`     [Planner ${arm}] Generating IR...`);
    if (arm === 'I0') {
      plannerIR = await runPlannerI0(topic, persona, I0_INTELLECTUAL);
    } else {
      plannerIR = await runPlannerI1(topic, persona, i1Constraints);
    }

    const topology = checkTopology(plannerIR, persona);

    // ── Claim Form Audit ──
    const claim_form = auditClaimForm(plannerIR);
    for (const c of claim_form) {
      console.log(
        `       [Claim] ${c.id.padEnd(16)} (${c.type.padEnd(14)}) len=${String(c.length).padEnd(3)} ${c.noun_phrase_only ? '⚠️ noun-phrase' : '✅ proposition'}`,
      );
    }

    console.log(`     [L1] IR Purity...`);
    const ir_purity = await evalIRPurity(plannerIR, persona, `${arm}-${caseId}`);
    console.log(
      `     Purity: overall=${ir_purity.overall_purity} structural=${ir_purity.structural_purity} devLeak=${ir_purity.developer_leakage} psychLeak=${ir_purity.psychology_leakage} creativeLeak=${ir_purity.creative_leakage}`,
    );

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

      const contamVotePromises = Array.from({ length: E_REPEATS }, (_, i) =>
        limitedCall(() =>
          retry(
            () => evaluateIntellectualContamination(renderedText, { temperature: 0 }),
            `contamination-${arm}-r${r}-e${i}`,
          ),
        ),
      );

      const [personaResults, coverageResults, contamResults] = await Promise.all([
        Promise.all(personaVotePromises),
        Promise.all(coverageVotePromises),
        Promise.all(contamVotePromises),
      ]);

      const personaVotes = personaResults.map(res => res.predicted_persona);
      const identityCorrectVotes = personaVotes.map(p => p === expectedPersonaLetter);
      const contaminationVotes = contamResults.map(res => res.is_developer_contaminated);
      const contaminationTypes = contamResults.map(res => res.contamination_type ?? 'none');
      const coverageVotes = coverageResults.map(res => res.nodes_found ?? 0);

      const identityCorrect = majorityVoteBoolean(identityCorrectVotes);
      const isContaminated = majorityVoteBoolean(contaminationVotes);
      const predictedPersona = majorityVoteString(personaVotes);
      const identityDisagreementRate = identityCorrectVotes.filter(v => v !== identityCorrect).length / E_REPEATS;
      const contaminationDisagreementRate = contaminationVotes.filter(v => v !== isContaminated).length / E_REPEATS;

      process.stdout.write(`${identityCorrect ? '✅' : '❌'} ${isContaminated ? '🔴' : '🟢'}\n`);

      renders.push({
        render_idx: r,
        renderedText,
        renderedTextHash: hashText(renderedText),
        eval: {
          predicted_persona_votes: personaVotes,
          predicted_persona: predictedPersona,
          identity_correct: identityCorrect,
          identity_disagreement_rate: identityDisagreementRate,
          is_contaminated_votes: contaminationVotes,
          is_contaminated: isContaminated,
          contamination_disagreement_rate: contaminationDisagreementRate,
          contamination_types: contaminationTypes,
          node_coverage_votes: coverageVotes,
          node_coverage: getMean(coverageVotes),
          node_coverage_stddev: getStdDev(coverageVotes),
        },
      });

      await delay(1000);
    }

    const identityCorrectRenders = renders.filter(r => r.eval.identity_correct).length;
    const cell_majority_identity_correct = identityCorrectRenders >= Math.ceil(R_REPEATS / 2);
    const contamRenders = renders.filter(r => r.eval.is_contaminated).length;
    const contamination_rate = (contamRenders / R_REPEATS) * 100;

    arms[arm] = {
      arm,
      persona,
      plannerIR,
      topology,
      ir_purity,
      claim_form,
      renders,
      cell_majority_identity_correct,
      render_identity_accuracy_pct: (identityCorrectRenders / R_REPEATS) * 100,
      contamination_rate,
      is_contaminated: contamRenders > 0,
    };
  }

  // ─── Delta ───────────────────────────────────────────────────────────────
  console.log(`\n  ── DELTA ──`);
  const I0 = arms['I0'], I1 = arms['I1'];
  console.log(`     Identity:     I0=${I0.cell_majority_identity_correct ? '✅' : '❌'} (${I0.render_identity_accuracy_pct.toFixed(0)}%) → I1=${I1.cell_majority_identity_correct ? '✅' : '❌'} (${I1.render_identity_accuracy_pct.toFixed(0)}%)`);
  console.log(`     IR Purity:    I0=${I0.ir_purity.overall_purity} → I1=${I1.ir_purity.overall_purity}`);
  console.log(`     Structural:   I0=${I0.ir_purity.structural_purity} → I1=${I1.ir_purity.structural_purity}`);
  console.log(`     Dev Leakage:  I0=${I0.ir_purity.developer_leakage} → I1=${I1.ir_purity.developer_leakage}`);
  console.log(`     Psych Leak:   I0=${I0.ir_purity.psychology_leakage} → I1=${I1.ir_purity.psychology_leakage}`);
  console.log(`     Topology:     I0=${I0.topology.compliant ? 'PASS' : 'FAIL'} | I1=${I1.topology.compliant ? 'PASS' : 'FAIL'}`);
  console.log(`     Contaminated: I0=${I0.contamination_rate.toFixed(0)}% → I1=${I1.contamination_rate.toFixed(0)}%`);

  // ─── Gate summary ────────────────────────────────────────────────────────
  const identityGate = I1.cell_majority_identity_correct;
  const contamGate = I1.contamination_rate <= 10;
  const topoGate = I1.topology.compliant;
  const purityGate = I1.ir_purity.overall_purity >= 90;
  const claimFormGate = I1.claim_form.every((c: any) => !c.noun_phrase_only);

  console.log(`\n${'═'.repeat(60)}`);
  console.log(`  C007 RERUN RESULT`);
  console.log(`  identity=${identityGate ? '✅' : '❌'}`);
  console.log(`  contamination=${contamGate ? '✅' : '❌'}`);
  console.log(`  topology=${topoGate ? '✅' : '❌'}`);
  console.log(`  purity=${purityGate ? '✅' : '⚠️'} (score: ${I1.ir_purity.overall_purity})`);
  console.log(`  claim-form=${claimFormGate ? '✅' : '❌'}`);
  console.log(`${'═'.repeat(60)}\n`);

  // ─── Save report ─────────────────────────────────────────────────────────
  const reportsDir = path.join(__dirname, 'benchmark-reports');
  if (!fs.existsSync(reportsDir)) {
    fs.mkdirSync(reportsDir, { recursive: true });
  }

  const reportPath = path.join(reportsDir, `exp-015-c007-rerun-${Date.now()}.json`);
  fs.writeFileSync(
    reportPath,
    JSON.stringify(
      {
        experiment: 'EXP-015-C007-rerun',
        timestamp: new Date().toISOString(),
        fix: 'psychology-adjacent-domain-shift-and-persona-aware-purity',
        i1_sha256: i1Sha,
        caseId,
        persona,
        topic,
        gates: {
          identity: identityGate,
          contamination: contamGate,
          topology: topoGate,
          purity: purityGate,
          claim_form: claimFormGate,
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
