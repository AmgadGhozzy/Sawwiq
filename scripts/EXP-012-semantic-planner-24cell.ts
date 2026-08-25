import fs from 'fs';
import path from 'path';
import { config } from 'dotenv';
config({ path: path.join(process.cwd(), '.env.local') });

import { Type } from '@google/genai';
import { callAI, MODEL } from './lib/aiClient';
import { evaluatePersona } from '../lib/evaluation/personaEvaluator';
import { buildSystemPrompt, buildUserPrompt } from '../lib/content/prompt/compiler';
import { GEMINI_RESPONSE_SCHEMA } from '../supabase/functions/generate/validation/schema';
import { getPersona } from '../lib/content/personas/registry';
import type { InputDTO } from '../supabase/functions/generate/validation/schema';
import { PERSONA_LETTER_MAP } from '../lib/evaluation/types';
import type { PersonaId } from '../lib/evaluation/types';
import { buildSemanticPlannerConstraints } from '../lib/content/personas/semanticConstraints';

const delay = (ms: number) => new Promise(res => setTimeout(res, ms));

const ALLOWED_NODES = [
  'observation', 'assumption', 'trigger', 'system', 'constraint', 
  'motive', 'behavior', 'reinforcement', 'contradiction', 'reframe', 
  'scene', 'association', 'tension', 'transformation', 'outcome',
  'bottleneck', 'mechanism', 'intervention', 'sensory_detail', 
  'return_to_scene', 'awareness_shift', 'why_fails', 'synthesis'
];

const ALLOWED_EDGES = [
  'causes', 'constrains', 'reinforces', 'contradicts', 'reframes', 
  'maps_to', 'transforms', 'results_in', 'leads_to', 'produces'
];

const TOPOLOGIES: Record<string, any> = {
  developer: {
    prompt: `CANONICAL EDGE PATTERN:\nsystem --constrains--> constraint\nconstraint --causes--> bottleneck\nbottleneck --causes--> mechanism\nmechanism --leads_to--> intervention\nintervention --results_in--> outcome\n\nRULES: \n- Must represent a structural system. \n- NO emotional motives. NO 'motive' or 'behavior' nodes.\n- Edges must strictly match the canonical pattern.`,
  },
  psychology: {
    prompt: `CANONICAL EDGE PATTERN:\ntrigger --causes--> motive\nmotive --causes--> behavior\nbehavior --produces--> reinforcement\nreinforcement --reinforces--> behavior\nbehavior --leads_to--> awareness_shift\n\nRULES:\n- Must have the feedback loop: 'reinforcement' --reinforces--> 'behavior'.\n- Focus on internal human drivers.`,
  },
  intellectual: {
    prompt: `CANONICAL EDGE PATTERN:\nassumption --contradicts--> contradiction\ncontradiction --causes--> why_fails\nwhy_fails --reframes--> reframe\nreframe --leads_to--> synthesis\n\nRULES:\n- NO 'intervention' or 'fix' nodes. You do not fix the system, you prove the question is wrong.\n- Must show a logical paradox or framing error.`,
  },
  creative: {
    prompt: `CANONICAL EDGE PATTERN:\nscene --maps_to--> sensory_detail\nsensory_detail --leads_to--> association\nassociation --causes--> tension\ntension --transforms--> transformation\ntransformation --leads_to--> return_to_scene\n\nRULES:\n- MUST contain 'scene' and 'sensory_detail'.\n- 'transformation' must be an emotional or perceptual shift, NOT a structural fix.`,
  }
};

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
          relation: { type: Type.STRING, enum: ALLOWED_EDGES }
        },
        required: ['from', 'to', 'relation']
      }
    }
  },
  required: ['nodes', 'edges']
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
  },
  required: ['identity_sufficiency','developer_likeness','required_signals','forbidden_patterns']
};

const CREATIVE_VAL_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    identity_sufficiency: { type: Type.NUMBER },
    developer_likeness: { type: Type.NUMBER },
    required_signals: {
      type: Type.OBJECT,
      properties: {
        concrete_scene: { type: Type.NUMBER },
        metaphorical_leap: { type: Type.NUMBER },
        aesthetic_tension: { type: Type.NUMBER },
        image_action_transformation: { type: Type.NUMBER },
        atmospheric_echo: { type: Type.NUMBER }
      },
      required: ['concrete_scene','metaphorical_leap','aesthetic_tension','image_action_transformation','atmospheric_echo']
    },
    forbidden_patterns: {
      type: Type.OBJECT,
      properties: {
        problem_statement: { type: Type.BOOLEAN },
        prescriptive_fix: { type: Type.BOOLEAN }
      },
      required: ['problem_statement','prescriptive_fix']
    },
  },
  required: ['identity_sufficiency','developer_likeness','required_signals','forbidden_patterns']
};

async function runSemanticPlanner(topic: string, persona: string) {
  const semanticConstraints = buildSemanticPlannerConstraints(persona as any);
  let prompt = `You are the Causal Planner for the ${persona.toUpperCase()} persona.
Your task is to populate a machine-verifiable Causal Graph (nodes and edges) representing the argument based on the topic "${topic}".

REQUIRED TOPOLOGY FOR ${persona.toUpperCase()}:
${TOPOLOGIES[persona].prompt}
`;

  if (semanticConstraints) {
    prompt += `\n\nSEMANTIC CONSTRAINTS:\n${semanticConstraints}\n`;
  }

  const text = await callAI({ model: MODEL.GENERATION, contents: prompt,
    config: { responseMimeType: 'application/json', responseSchema: PLANNER_SCHEMA as any, temperature: 0.7 } });
  return JSON.parse(text);
}

async function validateSemantics(graph: any, persona: string): Promise<any> {
  if (persona !== 'intellectual' && persona !== 'creative') return { skipped: true };
  
  const schema = persona === 'intellectual' ? INTELLECTUAL_VAL_SCHEMA : CREATIVE_VAL_SCHEMA;
  const prompt = `You are a Claim-Level Semantic Validator. Evaluate if the Causal Graph genuinely embodies the ${persona.toUpperCase()} identity beyond just structure.
Graph:
${JSON.stringify(graph, null, 2)}
Score signals 0-100. Evaluate forbidden patterns strictly as boolean.`;

  const text = await callAI({ model: MODEL.EVALUATION, contents: prompt,
    config: { responseMimeType: 'application/json', responseSchema: schema as any, temperature: 0.1 } });
  return JSON.parse(text);
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
    '6. Language: Arabic. Style: professional and engaging.\n' +
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

async function generateContentArm(input: InputDTO, arm: 'A'|'B'): Promise<{text: string, promptLen: number}> {
  const systemInstruction = buildSystemPrompt(input);
  const userPrompt = buildUserPrompt();
  
  const text = await callAI({
    model: MODEL.GENERATION,
    contents: userPrompt,
    config: {
      systemInstruction,
      responseMimeType: 'application/json',
      responseSchema: GEMINI_RESPONSE_SCHEMA as any,
      temperature: 0.7,
    }
  });
  
  let parsed = text;
  try {
    const d = JSON.parse(text);
    parsed = [d.title, d.hook, typeof d.body === 'string' ? d.body : d.body?.map((p: any) => p.text).join('\n\n'), d.callToAction, d.hashtags?.join(' ')].filter(Boolean).join('\n\n');
  } catch {}
  return { text: parsed, promptLen: systemInstruction.length + userPrompt.length };
}

const retryEval = async <T>(fn: () => Promise<T>, label = "eval"): Promise<T> => {
  let retries = 10;
  while (retries > 0) {
    try { return await fn(); }
    catch (e: any) {
      if (retries > 1) {
        console.log(`     [Retry] ${label} failed. Waiting 5s...`);
        await delay(5000);
        retries--;
      } else throw e;
    }
  }
  throw new Error("Max retries exceeded");
};

async function run() {
  const datasetPath = path.join(__dirname, "datasets", "dataset-exp-005.json");
  const dataset = JSON.parse(fs.readFileSync(datasetPath, "utf-8"));
  const isSmokeTest = process.argv.includes('--smoke');
  
  let matrix: any[] = [];
  for (const topic of dataset.topics) {
    for (const platform of dataset.platforms) {
      for (const style of dataset.styles) {
        for (const persona of dataset.personas) {
          matrix.push({ topic, platform, style, persona });
        }
      }
    }
  }
  
  if (isSmokeTest) {
    matrix = matrix.slice(0, 2);
    console.log('   [SMOKE TEST MODE] Running 2 cases only.\n');
  } else {
    console.log(`   Running full ${matrix.length} cases.\n`);
  }

  const matrixWithIds = matrix.map((item, i) => ({
    ...item,
    caseId: `C${(i + 1).toString().padStart(3, "0")}-${item.persona}-${item.topic.id}`,
  }));

  const results: any[] = [];
  const rp = path.join(__dirname, 'benchmark-reports', `exp-012-semantic-planner-24cell-${Date.now()}.json`);

  for (let i = 0; i < matrixWithIds.length; i++) {
    const { topic, platform, style, persona, caseId } = matrixWithIds[i];
    console.log(`\n[${i + 1}/${matrixWithIds.length}] Running ${caseId}...`);

    const baseInput: any = {
      rawInput: topic.prompt,
      platform,
      contentType: "social_post",
      mode: "creator",
      arabicStyle: "white_arabic",
      metadata: { style, intent: "education", originality: "creative" }
    };
    const basePersona = getPersona(persona);

    // Arm A
    console.log(`   [Arm A] Baseline...`);
    const inputA = { ...baseInput, metadata: { ...baseInput.metadata, persona: { ...basePersona, usePerspectiveConstraint: false } } };
    const armA = await generateContentArm(inputA, 'A');

    // Arm B
    console.log(`   [Arm B] Legacy Perspective...`);
    const inputB = { ...baseInput, metadata: { ...baseInput.metadata, persona: { ...basePersona, usePerspectiveConstraint: true } } };
    const armB = await generateContentArm(inputB, 'B');

    // Arm C
    console.log(`   [Arm C] Semantic Planner...`);
    const promptBaseC = buildSystemPrompt(inputA as any); // Baseline system prompt to approximate growth
    const plannerStart = Date.now();
    const plannerIR = await runSemanticPlanner(topic.prompt, persona);
    const telemetry = await validateSemantics(plannerIR, persona);
    const textC = await blindRender(plannerIR);
    const armCLatency = Date.now() - plannerStart;
    
    // Evaluators
    const evalA = await retryEval(() => evaluatePersona(armA.text, "v2"), "evalA");
    const evalB = await retryEval(() => evaluatePersona(armB.text, "v2"), "evalB");
    const evalC = await retryEval(() => evaluatePersona(textC, "v2"), "evalC");
    
    const irpC = await evalIRPurity(plannerIR, persona);
    const fidC = await evalFidelity(plannerIR, textC);

    const expectedLetter = PERSONA_LETTER_MAP[persona as PersonaId];
    
    results.push({
      caseId, persona, topic: topic.id,
      textA: armA.text, textB: armB.text, textC,
      plannerIR, telemetry,
      evalA: { ...evalA, is_correct: evalA.predicted_persona === expectedLetter },
      evalB: { ...evalB, is_correct: evalB.predicted_persona === expectedLetter },
      evalC: { ...evalC, is_correct: evalC.predicted_persona === expectedLetter },
      irpC, fidC,
      promptGrowth: {
         A: armA.promptLen,
         B: armB.promptLen,
         C_planner_est: promptBaseC.length + 1000 // Approximate planner prompt overhead
      },
      latencyC: armCLatency
    });
    
    fs.writeFileSync(rp, JSON.stringify(results, null, 2));
  }
  
  // Aggregate stats
  let cPass = 0, cDevCollisions = 0, sumIrp = 0, sumFid = 0, forbidden = 0;
  let sumTokenDiff = 0;
  for (const r of results) {
    if (r.evalC.is_correct) cPass++;
    if (r.evalC.predicted_persona === 'developer' && r.persona !== 'developer') cDevCollisions++;
    sumIrp += r.irpC.overall_purity;
    sumFid += r.fidC.structural_fidelity;
    if (r.telemetry && r.telemetry.forbidden_patterns) {
      if (Object.values(r.telemetry.forbidden_patterns).some(v => v === true)) forbidden++;
    }
    const tokenDiff = ((r.promptGrowth.C_planner_est - r.promptGrowth.A) / r.promptGrowth.A) * 100;
    sumTokenDiff += tokenDiff;
  }
  const acc = (cPass / results.length) * 100;
  const devColl = (cDevCollisions / results.length) * 100;
  const avgIrp = sumIrp / results.length;
  const avgFid = sumFid / results.length;
  const avgTokenGrowth = sumTokenDiff / results.length;
  
  console.log(`\n✅ EXP-012 Complete -> ${rp}`);
  console.log(`   Arm C Identity Accuracy: ${acc.toFixed(1)}%`);
  console.log(`   Arm C Developer Collisions: ${devColl.toFixed(1)}%`);
  console.log(`   Arm C Avg IR Purity: ${avgIrp.toFixed(1)}`);
  console.log(`   Arm C Avg Fidelity: ${avgFid.toFixed(2)}`);
  console.log(`   Arm C Forbidden Patterns Hit: ${forbidden}`);
  console.log(`   Arm C Est. Prompt Growth vs A: +${avgTokenGrowth.toFixed(1)}%`);
}

run().catch(console.error);
