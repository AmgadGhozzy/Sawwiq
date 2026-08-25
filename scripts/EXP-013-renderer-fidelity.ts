import fs from 'fs';
import path from 'path';
import { config } from 'dotenv';
config({ path: path.join(process.cwd(), '.env.local') });

import { Type } from '@google/genai';
import { callAI, MODEL } from './lib/aiClient';
import { evaluatePersona } from '../lib/evaluation/personaEvaluator';
import { PERSONA_LETTER_MAP } from '../lib/evaluation/types';
import type { PersonaId } from '../lib/evaluation/types';

const delay = (ms: number) => new Promise(res => setTimeout(res, ms));

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

const NODE_COVERAGE_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    nodes: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          node_type: { type: Type.STRING },
          status: { type: Type.STRING, enum: ['preserved', 'weakened', 'dropped'] },
          identity_preservation_score: { type: Type.NUMBER },
          reasoning: { type: Type.STRING }
        },
        required: ['node_type', 'status', 'identity_preservation_score', 'reasoning']
      }
    }
  },
  required: ['nodes']
};

async function renderArm(graph: any, arm: 'R1' | 'R2' | 'R3'): Promise<{text: string, latency: number, promptTokens: number}> {
  let prompt = '';
  if (arm === 'R1') {
    prompt = 'You are an Arabic Content Renderer.\n' +
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
  } else if (arm === 'R2') {
    prompt = 'You are a Deterministic Graph-to-Text Mapper.\n' +
      'Your task is to convert each node of the Causal Graph into Arabic surface text, maintaining the exact claim, evidence, and function.\n\n' +
      'STRICT RULES:\n' +
      '1. Do NOT add any persona style, persona names, or stylistic embellishments.\n' +
      '2. Do NOT invent claims that are not explicitly in the IR.\n' +
      '3. Do NOT delete or skip any identity-bearing nodes.\n' +
      '4. Do NOT reinterpret the topology or add missing links.\n' +
      '5. Do NOT add recommendations or solutions unless they exist in the graph.\n' +
      '6. Map the exact causal sequence as provided. Output format must be clean Arabic text without mentioning the graph itself.\n\n' +
      'Causal Graph:\n' + JSON.stringify(graph, null, 2);
  } else if (arm === 'R3') {
    prompt = 'You are an Arabic Content Renderer.\n' +
      'Your ONLY job is to faithfully translate the provided Causal Graph into a well-written Arabic social media post.\n\n' +
      'STRICT RULES:\n' +
      '1. Follow the causal sequence in the graph exactly.\n' +
      '2. DO NOT add causal claims not in the graph.\n' +
      '3. DO NOT remove causal claims from the graph.\n' +
      '4. DO NOT reinterpret or add a worldview not in the graph.\n' +
      '5. DO NOT introduce new mechanisms or motives.\n' +
      '6. Language: Arabic. Style: professional and engaging.\n' +
      '7. The closing MUST reflect the final node claim.\n\n' +
      'IR COVERAGE CONTRACT - Before finalizing your output, you MUST silently verify:\n' +
      '- Every required IR node must be represented.\n' +
      '- Every claim must remain semantically equivalent.\n' +
      '- Identity-bearing nodes must preserve their function.\n' +
      '- Do not introduce new claims.\n' +
      '- Do not remove or merge required distinctions.\n\n' +
      'Causal Graph:\n' + JSON.stringify(graph, null, 2);
  }

  const start = Date.now();
  const text = await callAI({ model: MODEL.GENERATION, contents: prompt,
    config: { responseMimeType: 'application/json', responseSchema: CONTENT_SCHEMA as any, temperature: 0.6 } });
  const latency = Date.now() - start;
  
  let parsed = text;
  try {
    const d = JSON.parse(text);
    parsed = [d.title, d.hook, typeof d.body === 'string' ? d.body : d.body?.map((p: any) => p.text).join('\n\n'), d.callToAction, d.hashtags?.join(' ')].filter(Boolean).join('\n\n');
  } catch {}
  
  return { text: parsed, latency, promptTokens: prompt.length };
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

async function evalNodeCoverage(graph: any, rendered: string): Promise<any> {
  const prompt = 'You are a Node-Level Semantic Auditor.\n' +
    'Source Graph:\n' + JSON.stringify(graph, null, 2) + '\n' +
    'Generated Text:\n' + rendered + '\n' +
    'For EACH node in the graph, evaluate if its core concept, claim, and identity-bearing semantics survived the rendering process into the text.\n' +
    '- "preserved": meaning and function remained intact.\n' +
    '- "weakened": node exists but lost its distinctive identity-bearing signal.\n' +
    '- "dropped": node disappeared.\n' +
    'Also provide an identity_preservation_score (0.0-1.0) for each node.';
    
  const text = await callAI({ model: MODEL.EVALUATION, contents: prompt,
    config: { responseMimeType: 'application/json', responseSchema: NODE_COVERAGE_SCHEMA as any, temperature: 0.1 } });
  return JSON.parse(text);
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
  const sourcePath = path.join(__dirname, "benchmark-reports", "exp-012-semantic-planner-24cell-1787552346041.json");
  const exp012 = JSON.parse(fs.readFileSync(sourcePath, "utf-8"));
  const isSmokeTest = process.argv.includes('--smoke');
  
  let casesToRun = exp012;
  if (isSmokeTest) {
    casesToRun = casesToRun.slice(0, 2);
    console.log('   [SMOKE TEST MODE] Running 2 cases only.\n');
  } else {
    console.log(`   Running full ${casesToRun.length} cases.\n`);
  }

  const results: any[] = [];
  const rp = path.join(__dirname, 'benchmark-reports', `exp-013-renderer-fidelity-${Date.now()}.json`);

  for (let i = 0; i < casesToRun.length; i++) {
    const c = casesToRun[i];
    const { caseId, persona, plannerIR } = c;
    console.log(`\n[${i + 1}/${casesToRun.length}] Running ${caseId}...`);

    if (!plannerIR) {
       console.log(`   Skipping (No plannerIR found)`);
       continue;
    }

    // Render Arms
    console.log(`   [Arm R1] Blind Renderer...`);
    const r1 = await renderArm(plannerIR, 'R1');
    console.log(`   [Arm R2] Constrained Mapper...`);
    const r2 = await renderArm(plannerIR, 'R2');
    console.log(`   [Arm R3] Contract-driven...`);
    const r3 = await renderArm(plannerIR, 'R3');
    
    // Evaluate Persona Accuracy
    const evalR1_p = await retryEval(() => evaluatePersona(r1.text, "v2"), "evalR1_p");
    const evalR2_p = await retryEval(() => evaluatePersona(r2.text, "v2"), "evalR2_p");
    const evalR3_p = await retryEval(() => evaluatePersona(r3.text, "v2"), "evalR3_p");

    // Evaluate Fidelity
    const fidR1 = await evalFidelity(plannerIR, r1.text);
    const fidR2 = await evalFidelity(plannerIR, r2.text);
    const fidR3 = await evalFidelity(plannerIR, r3.text);

    // Evaluate Node Coverage
    const covR1 = await evalNodeCoverage(plannerIR, r1.text);
    const covR2 = await evalNodeCoverage(plannerIR, r2.text);
    const covR3 = await evalNodeCoverage(plannerIR, r3.text);

    const expectedLetter = PERSONA_LETTER_MAP[persona as PersonaId];
    
    results.push({
      caseId, persona,
      plannerIR,
      R1: { 
        text: r1.text, latency: r1.latency, promptTokens: r1.promptTokens,
        eval_p: { ...evalR1_p, is_correct: evalR1_p.predicted_persona === expectedLetter },
        fidelity: fidR1, node_coverage: covR1
      },
      R2: { 
        text: r2.text, latency: r2.latency, promptTokens: r2.promptTokens,
        eval_p: { ...evalR2_p, is_correct: evalR2_p.predicted_persona === expectedLetter },
        fidelity: fidR2, node_coverage: covR2
      },
      R3: { 
        text: r3.text, latency: r3.latency, promptTokens: r3.promptTokens,
        eval_p: { ...evalR3_p, is_correct: evalR3_p.predicted_persona === expectedLetter },
        fidelity: fidR3, node_coverage: covR3
      }
    });
    
    fs.writeFileSync(rp, JSON.stringify(results, null, 2));
  }
  
  // Aggregate Stats Helper
  const agg = (armKey: string) => {
     let cPass = 0, sumFid = 0, sumPreservation = 0, totalNodes = 0;
     let personaPreservation: Record<string, {sum:number, count:number}> = {};

     for (const r of results) {
       const arm = r[armKey];
       if (arm.eval_p.is_correct) cPass++;
       sumFid += arm.fidelity.structural_fidelity;
       
       if (!personaPreservation[r.persona]) personaPreservation[r.persona] = {sum:0, count:0};
       
       const nodes = arm.node_coverage?.nodes || [];
       for (const n of nodes) {
          sumPreservation += n.identity_preservation_score || 0;
          totalNodes++;
          personaPreservation[r.persona].sum += n.identity_preservation_score || 0;
          personaPreservation[r.persona].count++;
       }
     }
     
     const acc = (cPass / results.length) * 100;
     const avgFid = sumFid / results.length;
     const avgPres = totalNodes > 0 ? (sumPreservation / totalNodes) * 100 : 0;
     
     const perPersonaPres = Object.keys(personaPreservation).map(p => {
       const d = personaPreservation[p];
       return `${p}: ${d.count > 0 ? ((d.sum/d.count)*100).toFixed(1) : 0}%`;
     }).join(' | ');

     return { acc, avgFid, avgPres, perPersonaPres };
  };

  const statR1 = agg('R1');
  const statR2 = agg('R2');
  const statR3 = agg('R3');
  
  console.log(`\n✅ EXP-013 Complete -> ${rp}`);
  console.log(`[R1 - Blind Baseline]`);
  console.log(`   Identity: ${statR1.acc.toFixed(1)}% | Fidelity: ${statR1.avgFid.toFixed(2)} | Node Pres: ${statR1.avgPres.toFixed(1)}%`);
  console.log(`   Preservation by Persona: ${statR1.perPersonaPres}`);
  
  console.log(`\n[R2 - Constrained Mapper]`);
  console.log(`   Identity: ${statR2.acc.toFixed(1)}% | Fidelity: ${statR2.avgFid.toFixed(2)} | Node Pres: ${statR2.avgPres.toFixed(1)}%`);
  console.log(`   Preservation by Persona: ${statR2.perPersonaPres}`);

  console.log(`\n[R3 - Contract-driven]`);
  console.log(`   Identity: ${statR3.acc.toFixed(1)}% | Fidelity: ${statR3.avgFid.toFixed(2)} | Node Pres: ${statR3.avgPres.toFixed(1)}%`);
  console.log(`   Preservation by Persona: ${statR3.perPersonaPres}`);
}

run().catch(console.error);
