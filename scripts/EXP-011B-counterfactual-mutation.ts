/**
 * EXP-011B - Constrained Counterfactual Mutation
 *
 * Applies counterfactual mutations from EXP-011A under strict structural constraints.
 * ALLOWED: modify claim/evidence only, max 2 nodes, same node IDs, same types, same edges.
 * FORBIDDEN: add/remove nodes or edges, change node.type or node.id.
 * Machine-diff gate: INVALID_MUTATION if constraints violated.
 *
 * Gate per case: DeltaAcc >= +25pp, Fidelity >= 0.95, IRPurity >= 85, DevLeak decreases.
 */

import * as fs from 'fs';
import * as path from 'path';
import { config } from 'dotenv';
config({ path: path.join(process.cwd(), '.env.local') });

import { Type } from '@google/genai';
import { callAI, MODEL } from './lib/aiClient';

const EXP_011A = path.join(__dirname, 'benchmark-reports', 'exp-011A-feature-sufficiency-1787545881869.json');
const EXP_010B = path.join(__dirname, 'benchmark-reports', 'exp-010B-rendering-1787542225904.json');

const CONTENT_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    title:   { type: Type.STRING },
    hook:    { type: Type.STRING },
    body:    { type: Type.STRING },
    closing: { type: Type.STRING },
  },
  required: ['title','hook','body','closing'],
};

const FIDELITY_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    structural_fidelity:     { type: Type.NUMBER },
    invented_mechanisms:     { type: Type.NUMBER },
    missing_nodes:           { type: Type.ARRAY, items: { type: Type.STRING } },
    renderer_drift_detected: { type: Type.BOOLEAN },
    evidence:                { type: Type.STRING },
  },
  required: ['structural_fidelity','invented_mechanisms','missing_nodes','renderer_drift_detected','evidence'],
};

const IR_PURITY_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    structural_purity:     { type: Type.NUMBER },
    psychology_leakage:    { type: Type.NUMBER },
    developer_leakage:     { type: Type.NUMBER },
    intellectual_leakage:  { type: Type.NUMBER },
    creative_leakage:      { type: Type.NUMBER },
    overall_purity:        { type: Type.NUMBER },
  },
  required: ['structural_purity','psychology_leakage','developer_leakage','intellectual_leakage','creative_leakage','overall_purity'],
};

const PERSONA_EVAL_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    predicted_persona: { type: Type.STRING, enum: ['developer','psychology','intellectual','creative'] },
    confidence:        { type: Type.NUMBER },
    persona_scores: {
      type: Type.OBJECT,
      properties: {
        developer:    { type: Type.NUMBER },
        psychology:   { type: Type.NUMBER },
        intellectual: { type: Type.NUMBER },
        creative:     { type: Type.NUMBER },
      },
      required: ['developer','psychology','intellectual','creative'],
    },
    reasoning: { type: Type.STRING },
  },
  required: ['predicted_persona','confidence','persona_scores','reasoning'],
};

// ─── Machine Diff ─────────────────────────────────────────────────────────────
interface DiffResult { valid: boolean; changed_node_ids: string[]; violations: string[]; }

function machineDiff(original: any, mutated: any): DiffResult {
  const violations: string[] = [];
  const changed: string[] = [];
  const orig: any[] = original.nodes || [];
  const mut:  any[] = mutated.nodes  || [];

  if (orig.length !== mut.length)
    violations.push('Node count changed: ' + orig.length + ' to ' + mut.length);

  const oMap = new Map(orig.map((n: any) => [n.id, n]));
  const mMap = new Map(mut.map( (n: any) => [n.id, n]));

  for (const [id] of mMap) if (!oMap.has(id)) violations.push('New node ID: ' + id);
  for (const [id] of oMap) if (!mMap.has(id)) violations.push('Removed node ID: ' + id);

  for (const [id, o] of oMap) {
    const m = mMap.get(id);
    if (!m) continue;
    if (o.type !== m.type) violations.push('Node ' + id + ': type changed');
    if (o.claim !== m.claim || o.evidence !== m.evidence) changed.push(id);
  }

  if (changed.length > 2) violations.push('Too many nodes modified: ' + changed.length + ' (max 2)');

  const sortE = (edges: any[]) =>
    JSON.stringify([...(edges || [])].sort((a,b) => (a.from+a.to).localeCompare(b.from+b.to)));
  if (sortE(original.edges) !== sortE(mutated.edges)) violations.push('Edges changed');

  return { valid: violations.length === 0, changed_node_ids: changed, violations };
}

// ─── Apply Mutations ──────────────────────────────────────────────────────────
function applyMutations(graph: any, mutations: any[]): { mutated: any; applied: string[] } {
  const mutated = JSON.parse(JSON.stringify(graph));
  const applied: string[] = [];
  for (const m of mutations.slice(0, 2)) {
    const node = (mutated.nodes || []).find((n: any) => n.id === m.node_id);
    if (!node || (m.field !== 'claim' && m.field !== 'evidence')) continue;
    node[m.field] = m.proposed_value;
    applied.push(m.node_id + '.' + m.field);
  }
  return { mutated, applied };
}

// ─── Blind Renderer (NO persona name) ────────────────────────────────────────
async function blindRender(graph: any): Promise<string> {
  const prompt = 'You are an Arabic Content Renderer.\n' +
    'Your ONLY job is to faithfully translate the provided Causal Graph into a well-written Arabic social media post.\n\n' +
    'STRICT RULES:\n' +
    '1. Follow the causal sequence in the graph exactly.\n' +
    '2. DO NOT add causal claims not in the graph.\n' +
    '3. DO NOT remove causal claims from the graph.\n' +
    '4. DO NOT reinterpret or add a worldview not in the graph.\n' +
    '5. DO NOT introduce new mechanisms or motives.\n' +
    '6. Language: Arabic (الفصحى البيضاء). Style: professional and engaging.\n' +
    '7. The closing MUST reflect the final node claim.\n\n' +
    'Causal Graph:\n' + JSON.stringify(graph, null, 2);
  const text = await callAI({ model: MODEL.GENERATION, contents: prompt,
    config: { responseMimeType: 'application/json', responseSchema: CONTENT_SCHEMA as any, temperature: 0.6 } });
  const d = JSON.parse(text);
  return d.title + '\n\n' + d.hook + '\n\n' + d.body + '\n\n' + d.closing;
}

async function evalIRPurity(graph: any, persona: string): Promise<any> {
  const prompt = 'You are an IR Purity Auditor.\n' +
    'Assess the Causal Graph for cross-persona contamination.\n' +
    'Target persona: ' + persona.toUpperCase() + '\n' +
    'Graph:\n' + JSON.stringify(graph, null, 2) + '\n' +
    'Score each leakage 0-100 (0=none). Score overall_purity 0-100.';
  const text = await callAI({ model: MODEL.EVALUATION, contents: prompt,
    config: { responseMimeType: 'application/json', responseSchema: IR_PURITY_SCHEMA as any, temperature: 0.1 } });
  return JSON.parse(text);
}

async function evalFidelity(graph: any, rendered: string): Promise<any> {
  const prompt = 'You are a Surface Fidelity Auditor.\n' +
    'Source Graph:\n' + JSON.stringify(graph, null, 2) + '\n' +
    'Generated Text:\n' + rendered + '\n' +
    'Score structural_fidelity 0.0-1.0. Count invented_mechanisms. List missing_nodes. Set renderer_drift_detected.';
  const text = await callAI({ model: MODEL.EVALUATION, contents: prompt,
    config: { responseMimeType: 'application/json', responseSchema: FIDELITY_SCHEMA as any, temperature: 0.1 } });
  return JSON.parse(text);
}

async function evalPersona(rendered: string): Promise<any> {
  const prompt = 'You are a Persona Identity Evaluator — BLIND (you do not know the intended persona).\n\n' +
    'Personas:\n' +
    '- developer: Systems, inputs/outputs, bottlenecks, root causes, structural fixes.\n' +
    '- psychology: Emotions, behavior, mental states, therapeutic framing.\n' +
    '- intellectual: Assumption challenged, question redefined, paradigm shift, no fix proposed.\n' +
    '- creative: Physical scene, sensory detail, unexpected association, perceptual transformation, return to scene.\n\n' +
    'Rate each persona 0.0-1.0 (sum ~1.0).\n\nText:\n' + rendered;
  const text = await callAI({ model: MODEL.EVALUATION, contents: prompt,
    config: { responseMimeType: 'application/json', responseSchema: PERSONA_EVAL_SCHEMA as any, temperature: 0.1 } });
  return JSON.parse(text);
}

function checkGate(before: any, after: any, persona: string) {
  const devB = before.devScore;
  const devA = after.pe.persona_scores?.developer ?? 0;
  const accB = before.isMatch ? 100 : 0;
  const accA = after.pe.predicted_persona === persona ? 100 : 0;
  const dAcc = accA - accB;
  return {
    delta_accuracy_pp:        dAcc,
    fidelity_after:           after.fid.structural_fidelity,
    ir_purity_after:          after.irp.overall_purity,
    developer_score_before:   devB,
    developer_score_after:    devA,
    developer_leak_decreased: devA < devB,
    gate_accuracy:     dAcc >= 25,
    gate_fidelity:     after.fid.structural_fidelity >= 0.95,
    gate_ir_purity:    after.irp.overall_purity >= 85,
    gate_developer_leak: devA < devB,
    gate_all_passed:
      dAcc >= 25 && after.fid.structural_fidelity >= 0.95 &&
      after.irp.overall_purity >= 85 && devA < devB,
  };
}

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

function buildSummary(res: any[], gP: number, inv: number, iP: number, iT: number, cP: number, cT: number, dA: number, dD: number) {
  const valid = res.filter(r => r.status === 'OK');
  return {
    total_cases: res.length, invalid_mutations: inv, valid_cases: valid.length,
    gate_all_passed: gP,
    gate_pass_rate: valid.length ? ((gP/valid.length)*100).toFixed(1)+'%' : '0%',
    avg_delta_accuracy_pp: valid.length ? (dA/valid.length).toFixed(1) : null,
    avg_delta_developer_score_pp: valid.length ? ((dD/valid.length)*100).toFixed(1) : null,
    intellectual: { after_accuracy: iT ? ((iP/iT)*100).toFixed(1)+'%' : '0%', pass: iP, total: iT },
    creative:     { after_accuracy: cT ? ((cP/cT)*100).toFixed(1)+'%' : '0%', pass: cP, total: cT },
    gate_thresholds: { delta_accuracy_pp: '>=25', fidelity: '>=0.95', ir_purity: '>=85', developer_leak: 'decreases' },
  };
}

async function run() {
  const a11 = JSON.parse(fs.readFileSync(EXP_011A, 'utf-8'));
  const b10 = JSON.parse(fs.readFileSync(EXP_010B, 'utf-8'));

  const base = new Map<string, any>();
  for (const c of b10.cases) base.set(c.topic_id + '-' + c.persona, c);

  // ─── Resume Logic ──────────────────────────────────────────────────────────
  const reportsDir = path.join(__dirname, 'benchmark-reports');
  const existing = fs.readdirSync(reportsDir)
    .filter(f => f.startsWith('exp-011B-counterfactual-') && f.endsWith('.json'))
    .sort()
    .reverse();

  let rp: string;
  let res: any[];
  let done: Set<string>;
  let gP=0, inv=0, dA=0, dD=0, iP=0, iT=0, cP=0, cT=0;

  if (existing.length > 0) {
    rp = path.join(reportsDir, existing[0]);
    const loaded = JSON.parse(fs.readFileSync(rp, 'utf-8'));
    res = loaded.cases || [];
    done = new Set(res.map((r: any) => r.topic_id + '-' + r.persona));

    // Restore accumulators from already-completed cases
    for (const r of res) {
      if (r.status === 'INVALID_MUTATION') { inv++; continue; }
      if (r.status !== 'OK') continue;
      if (r.gate?.gate_all_passed) gP++;
      dA += r.delta?.accuracy_pp ?? 0;
      dD += r.delta?.developer_score ?? 0;
      if (r.persona === 'intellectual') { iT++; if (r.after?.is_match) iP++; }
      if (r.persona === 'creative')     { cT++; if (r.after?.is_match) cP++; }
    }

    console.log('🔄 Resuming: ' + existing[0]);
    console.log('   Already done: ' + done.size + ' / ' + a11.cases.length + '\n');
  } else {
    rp = path.join(reportsDir, 'exp-011B-counterfactual-' + Date.now() + '.json');
    res = [];
    done = new Set<string>();
    console.log('\n🧬 EXP-011B: Constrained Counterfactual Mutation');
    console.log('   Cases: ' + a11.cases.length + ' | Gate: ΔAcc>=25pp, Fidelity>=0.95, IRPurity>=85, Dev↓\n');
  }

  for (const c of a11.cases) {
    const { topic_id, persona, analysis } = c;
    const b = base.get(topic_id + '-' + persona);

    // Skip already-processed cases
    if (done.has(topic_id + '-' + persona)) {
      console.log('   [' + topic_id + '] ' + persona + ' ✅ (skipped — already done)');
      continue;
    }

    if (!b || !b.final_ir?.nodes) {
      console.log('   [' + topic_id + '] ' + persona + ' skipped (no base)');
      continue;
    }

    process.stdout.write('   [' + topic_id + '] ' + persona + '... ');

    const { mutated, applied } = applyMutations(b.final_ir, analysis.counterfactual_mutations || []);
    const diff = machineDiff(b.final_ir, mutated);

    if (!diff.valid) {
      console.log('INVALID_MUTATION: ' + diff.violations.join('; '));
      res.push({ topic_id, persona, status: 'INVALID_MUTATION', violations: diff.violations });
      inv++;
      continue;
    }

    await sleep(500);
    const irpA = await evalIRPurity(mutated, persona);
    await sleep(500);
    const rendered = await blindRender(mutated);
    await sleep(500);
    const fidA = await evalFidelity(mutated, rendered);
    await sleep(500);
    const peA = await evalPersona(rendered);

    const afterMatch = peA.predicted_persona === persona;
    const devA = peA.persona_scores?.developer ?? 0;
    const devB = analysis.persona_scores?.developer ?? 0;
    const tgtA = peA.persona_scores?.[persona] ?? 0;
    const compMax = Math.max(...Object.entries(peA.persona_scores || {}).filter(([k]) => k !== persona).map(([,v]) => v as number));
    const marginA = tgtA - compMax;

    const gate = checkGate(
      { isMatch: b.persona_evaluation?.is_match ?? false, devScore: devB },
      { pe: peA, fid: fidA, irp: irpA },
      persona
    );

    if (gate.gate_all_passed) gP++;
    dA += gate.delta_accuracy_pp;
    dD += devA - devB;
    if (persona === 'intellectual') { iT++; if (afterMatch) iP++; }
    if (persona === 'creative')     { cT++; if (afterMatch) cP++; }

    const icon = afterMatch ? '✅' : '❌';
    console.log(icon + ' ' + peA.predicted_persona +
      ' | Dev: ' + (devB*100).toFixed(0) + '%→' + (devA*100).toFixed(0) + '%' +
      ' | Fid: ' + fidA.structural_fidelity.toFixed(2) +
      ' | IRP: ' + irpA.overall_purity +
      ' | Gate: ' + (gate.gate_all_passed ? '✅PASS' : '❌FAIL'));

    res.push({
      topic_id, persona, status: 'OK',
      structural_diff: { valid: true, changed_nodes: diff.changed_node_ids },
      mutations_applied: applied,
      mutations_detail: analysis.counterfactual_mutations,
      before: {
        is_match: b.persona_evaluation?.is_match ?? false,
        predicted: b.persona_evaluation?.predicted ?? 'unknown',
        persona_scores: analysis.persona_scores,
        identity_margin: analysis.identity_margin,
        developer_score: devB,
        ir_purity: b.ir_purity?.overall_purity ?? 0,
        fidelity: b.renderer?.fidelity_to_ir ?? 0,
      },
      after: {
        is_match: afterMatch, predicted: peA.predicted_persona,
        persona_scores: peA.persona_scores, identity_margin: marginA,
        developer_score: devA, ir_purity: irpA.overall_purity,
        fidelity: fidA.structural_fidelity, rendered_text: rendered, ir_purity_full: irpA,
      },
      delta: {
        accuracy_pp: gate.delta_accuracy_pp,
        developer_score: devA - devB,
        identity_margin: marginA - analysis.identity_margin,
        ir_purity: irpA.overall_purity - (b.ir_purity?.overall_purity ?? 0),
        fidelity: fidA.structural_fidelity - (b.renderer?.fidelity_to_ir ?? 0),
      },
      gate,
    });

    fs.writeFileSync(rp, JSON.stringify({ summary: buildSummary(res,gP,inv,iP,iT,cP,cT,dA,dD), cases: res }, null, 2));
    await sleep(800);
  }

  const summary = buildSummary(res,gP,inv,iP,iT,cP,cT,dA,dD);
  fs.writeFileSync(rp, JSON.stringify({ summary, cases: res }, null, 2));

  const valid = res.filter(r => r.status === 'OK');
  console.log('\n✅ EXP-011B Complete -> ' + rp);
  console.log('─'.repeat(70));
  console.log('   Total: ' + res.length + ' | Invalid: ' + inv + ' | Valid: ' + valid.length);
  console.log('   Gate ALL passed: ' + gP + ' / ' + valid.length + ' (' + summary.gate_pass_rate + ')');
  console.log('   Avg ΔAccuracy:   ' + summary.avg_delta_accuracy_pp + ' pp');
  console.log('   Avg ΔDev Score:  ' + summary.avg_delta_developer_score_pp + ' pp');
  console.log('\n🔬 After mutation accuracy:');
  console.log('   Intellectual: ' + summary.intellectual.after_accuracy + ' (' + iP + '/' + iT + ')');
  console.log('   Creative:     ' + summary.creative.after_accuracy     + ' (' + cP + '/' + cT + ')');

  if (gP / Math.max(valid.length, 1) >= 0.5) {
    console.log('\n💡 VERDICT: IR identity semantics IS the bottleneck.');
    console.log('   Targeted claim/evidence edits shifted identity without topology changes.');
  } else {
    console.log('\n💡 VERDICT: IR alone insufficient -> consider Identity Anchor Layer.');
  }
}

run().catch(console.error);
