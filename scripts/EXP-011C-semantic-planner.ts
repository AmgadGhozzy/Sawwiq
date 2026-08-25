/** 
 * EXP-011C — Semantic Planner Validation 
 * 
 * Tests whether injecting strict, identity-bearing semantic constraints into the 
 * Planner can resolve Developer collision without a post-hoc mutator or a new Layer. 
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
    title: { type: Type.STRING },
    hook: { type: Type.STRING },
    body: { type: Type.STRING },
    closing: { type: Type.STRING },
  },
  required: ['title','hook','body','closing'],
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
  required: ['structural_fidelity','invented_mechanisms','missing_nodes','renderer_drift_detected','evidence'],
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
  required: ['structural_purity','psychology_leakage','developer_leakage','intellectual_leakage','creative_leakage','overall_purity'],
};

const PERSONA_EVAL_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    predicted_persona: { type: Type.STRING, enum: ['developer','psychology','intellectual','creative'] },
    confidence: { type: Type.NUMBER },
    persona_scores: {
      type: Type.OBJECT,
      properties: {
        developer: { type: Type.NUMBER },
        psychology: { type: Type.NUMBER },
        intellectual: { type: Type.NUMBER },
        creative: { type: Type.NUMBER },
      },
      required: ['developer','psychology','intellectual','creative'],
    },
    reasoning: { type: Type.STRING },
  },
  required: ['predicted_persona','confidence','persona_scores','reasoning'],
};

const INTELLECTUAL_VAL_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    identity_sufficiency: { type: Type.NUMBER },
    developer_likeness: { type: Type.NUMBER },
    required_signals: {
      type: Type.OBJECT,
      properties: {
        starts_with_assumption: { type: Type.NUMBER },
        contradicts_assumption: { type: Type.NUMBER },
        explains_why_framing_fails: { type: Type.NUMBER },
        reframe_is_question_shift: { type: Type.NUMBER },
        synthesis_is_paradigm_shift: { type: Type.NUMBER }
      },
      required: ['starts_with_assumption','contradicts_assumption','explains_why_framing_fails','reframe_is_question_shift','synthesis_is_paradigm_shift']
    },
    forbidden_patterns: {
      type: Type.OBJECT,
      properties: {
        problem_intervention_outcome: { type: Type.BOOLEAN },
        prescriptive_recommendation: { type: Type.BOOLEAN }
      },
      required: ['problem_intervention_outcome','prescriptive_recommendation']
    },
    feedback_for_planner: { type: Type.STRING }
  },
  required: ['identity_sufficiency','developer_likeness','required_signals','forbidden_patterns','feedback_for_planner']
};

const CREATIVE_VAL_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    identity_sufficiency: { type: Type.NUMBER },
    developer_likeness: { type: Type.NUMBER },
    required_signals: {
      type: Type.OBJECT,
      properties: {
        physical_sensory_anchor: { type: Type.NUMBER },
        unexpected_metaphorical_leap: { type: Type.NUMBER },
        aesthetic_emotional_tension: { type: Type.NUMBER },
        image_action_transformation: { type: Type.NUMBER },
        echoes_opening_scene: { type: Type.NUMBER }
      },
      required: ['physical_sensory_anchor','unexpected_metaphorical_leap','aesthetic_emotional_tension','image_action_transformation','echoes_opening_scene']
    },
    forbidden_patterns: {
      type: Type.OBJECT,
      properties: {
        problem_statement_framing: { type: Type.BOOLEAN },
        prescriptive_fix: { type: Type.BOOLEAN }
      },
      required: ['problem_statement_framing','prescriptive_fix']
    },
    feedback_for_planner: { type: Type.STRING }
  },
  required: ['identity_sufficiency','developer_likeness','required_signals','forbidden_patterns','feedback_for_planner']
};

const PLANNER_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    nodes: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          id: { type: Type.STRING },
          type: { type: Type.STRING },
          claim: { type: Type.STRING },
          evidence: { type: Type.STRING }
        },
        required: ['id', 'type', 'claim', 'evidence']
      }
    },
    edges: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          from: { type: Type.STRING },
          to: { type: Type.STRING },
          relation: { type: Type.STRING }
        },
        required: ['from', 'to', 'relation']
      }
    }
  },
  required: ['nodes', 'edges']
};

async function runSemanticPlanner(topic: string, category: string, persona: string, baseTopology: any, previousFeedback: string = '') {
  const constraints = persona === 'intellectual' 
    ? `Intellectual Constraints:\n- assumption: Starts from a widely held assumption.\n- contradiction: Challenges/invalidates the assumption (NOT just discovering a problem).\n- why_fails: Explains why the original framing is epistemologically insufficient.\n- reframe: Redefines the question itself (FORBIDDEN: "the best solution is...").\n- synthesis: A paradigm shift or philosophical redefinition (FORBIDDEN: recommendation).\n- Global Forbidden: problem -> intervention -> measurable outcome.`
    : `Creative Constraints:\n- scene: A physical, sensory anchor.\n- association: An unexpected metaphorical leap.\n- tension: Aesthetic/emotional tension (FORBIDDEN: problem statements).\n- transformation: Described through image/action (FORBIDDEN: prescription/fix).\n- return_to_scene: A true atmospheric echo of the opening scene.`;

  const safeTopology = {
    nodes: baseTopology.nodes.map((n:any)=>({id: n.id, type: n.type, claim: "", evidence: ""})),
    edges: baseTopology.edges
  };

  const prompt = `You are the Causal Planner for the ${persona.toUpperCase()} persona.
Your task is to populate the claims and evidence for the EXACT topology provided below, based on the topic "${topic}" (${category}).
You MUST keep the nodes array and edges array structurally identical (same node ids, same node types, same edges).

${constraints}

${previousFeedback ? `\nPREVIOUS ATTEMPT FAILED VALIDATION:\n${previousFeedback}\nFix the claims and evidence to resolve this feedback.` : ''}

TARGET TOPOLOGY (Populate claim and evidence for each node):\n${JSON.stringify(safeTopology, null, 2)}`;

  const text = await callAI({ model: MODEL.GENERATION, contents: prompt,
    config: { responseMimeType: 'application/json', responseSchema: PLANNER_SCHEMA as any, temperature: 0.7 } });
  return JSON.parse(text);
}

async function validateSemantics(graph: any, persona: string) {
  const prompt = `You are the Semantic Claim Validator. Judge ONLY. DO NOT rewrite the IR.
Evaluate if this Causal Graph adheres to the ${persona.toUpperCase()} semantic rules.

Graph:\n${JSON.stringify(graph, null, 2)}

Score signals 0-100. Evaluate forbidden patterns strictly as boolean. Provide constructive feedback for the planner if it fails.`;

  const schema = persona === 'intellectual' ? INTELLECTUAL_VAL_SCHEMA : CREATIVE_VAL_SCHEMA;
  const text = await callAI({ model: MODEL.EVALUATION, contents: prompt,
    config: { responseMimeType: 'application/json', responseSchema: schema as any, temperature: 0.1 } });
  return JSON.parse(text);
}

function isValidatorPass(validation: any): boolean {
  if (validation.identity_sufficiency < 75) return false;
  if (validation.developer_likeness > 30) return false;
  const sigs = Object.values(validation.required_signals) as number[];
  if (sigs.some(s => s < 60)) return false;
  const forbs = Object.values(validation.forbidden_patterns) as boolean[];
  if (forbs.some(f => f === true)) return false;
  return true;
}

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

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

function buildSummary(res: any[], iT: number, cT: number) {
  let iP=0, cP=0, sumAcc=0, sumDev=0;
  const ok = res.filter(r => r.status === 'OK');
  for (const r of ok) {
    sumAcc += r.delta.accuracy_pp;
    sumDev += r.delta.developer_score;
    if (r.persona === 'intellectual' && r.after.is_match) iP++;
    if (r.persona === 'creative' && r.after.is_match) cP++;
  }
  return {
    total_cases: res.length,
    valid_cases: ok.length,
    semantic_pass_cases: res.filter(r => !r.PLANNER_SEMANTIC_FAILURE).length,
    semantic_failure_cases: res.filter(r => r.PLANNER_SEMANTIC_FAILURE).length,
    avg_delta_accuracy_pp: ok.length ? (sumAcc/ok.length).toFixed(1) : '0',
    avg_delta_developer_score_pp: ok.length ? (sumDev/ok.length).toFixed(1) : '0',
    intellectual: { pass: iP, total: iT, accuracy: iT ? ((iP/iT)*100).toFixed(1)+'%' : '0%' },
    creative: { pass: cP, total: cT, accuracy: cT ? ((cP/cT)*100).toFixed(1)+'%' : '0%' },
  };
}

async function run() {
  const a11 = JSON.parse(fs.readFileSync(EXP_011A, 'utf-8'));
  const b10 = JSON.parse(fs.readFileSync(EXP_010B, 'utf-8'));
  const base = new Map<string, any>();
  for (const c of b10.cases) base.set(c.topic_id + '-' + c.persona, c);

  const rp = path.join(__dirname, 'benchmark-reports', 'exp-011C-semantic-planner-' + Date.now() + '.json');
  console.log('\n🧠 EXP-011C: Semantic Planner Validation');

  const isSmokeTest = process.argv.includes('--smoke');
  const casesToRun = isSmokeTest ? a11.cases.slice(0, 2) : a11.cases;
  if (isSmokeTest) console.log('   [SMOKE TEST MODE] Running 2 cases only.\n');
  else console.log(`   Running full ${casesToRun.length} cases.\n`);

  const results: any[] = [];
  let iT = 0, cT = 0;

  for (const c of casesToRun) {
    const { topic_id, persona, category } = c;
    const b = base.get(topic_id + '-' + persona);
    if (!b) continue;

    process.stdout.write(`   [${topic_id}] ${persona}... `);

    if (persona === 'intellectual') iT++;
    if (persona === 'creative') cT++;

    let plannerIR = null;
    let valResult = null;
    let attempts = 0;
    let passed = false;
    let feedback = '';

    while (attempts < 3 && !passed) {
      attempts++;
      plannerIR = await runSemanticPlanner(topic_id, category, persona, b.final_ir, feedback);
      await sleep(1000);
      valResult = await validateSemantics(plannerIR, persona);
      passed = isValidatorPass(valResult);
      if (!passed) feedback = valResult.feedback_for_planner;
      await sleep(1000);
    }

    const semanticFailure = !passed;
    if (semanticFailure) process.stdout.write('[Sem-FAIL] ');
    else process.stdout.write('[Sem-PASS] ');

    const irpA = await evalIRPurity(plannerIR, persona);
    await sleep(1000);
    const rendered = await blindRender(plannerIR);
    await sleep(1000);
    const fidA = await evalFidelity(plannerIR, rendered);
    await sleep(1000);
    const peA = await evalPersona(rendered);

    const afterMatch = peA.predicted_persona === persona;
    const devB = c.analysis?.persona_scores?.developer ?? 0;
    const devA = peA.persona_scores?.developer ?? 0;
    const accB = b.persona_evaluation?.is_match ? 100 : 0;
    const accA = afterMatch ? 100 : 0;

    console.log(`${afterMatch ? '✅' : '❌'} ${peA.predicted_persona} | Dev: ${(devB*100).toFixed(0)}%→${(devA*100).toFixed(0)}% | Fid: ${fidA.structural_fidelity.toFixed(2)} | IRP: ${irpA.overall_purity}`);

    results.push({
      topic_id, persona, status: 'OK',
      PLANNER_SEMANTIC_FAILURE: semanticFailure,
      semantic_retry_count: attempts,
      validator_final_result: valResult,
      before: {
        is_match: b.persona_evaluation?.is_match ?? false,
        developer_score: devB,
        ir_purity: b.ir_purity?.overall_purity ?? 0,
        fidelity: b.renderer?.fidelity_to_ir ?? 0,
      },
      after: {
        is_match: afterMatch,
        developer_score: devA,
        ir_purity: irpA.overall_purity,
        fidelity: fidA.structural_fidelity,
      },
      delta: {
        accuracy_pp: accA - accB,
        developer_score: (devA - devB) * 100,
      }
    });

    fs.writeFileSync(rp, JSON.stringify({ summary: buildSummary(results, iT, cT), cases: results }, null, 2));
  }

  const sum = buildSummary(results, iT, cT);
  console.log(`\n✅ EXP-011C Complete -> ${rp}`);
  console.log(`   Total: ${sum.total_cases} | Sem Pass: ${sum.semantic_pass_cases} | Sem Fail: ${sum.semantic_failure_cases}`);
  console.log(`   Avg ΔAccuracy:  ${sum.avg_delta_accuracy_pp} pp`);
  console.log(`   Avg ΔDev Score: ${sum.avg_delta_developer_score_pp} pp`);
  console.log(`   Intellectual: ${sum.intellectual.accuracy} | Creative: ${sum.creative.accuracy}`);
}

run().catch(console.error);
