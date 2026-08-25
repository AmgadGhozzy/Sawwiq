import fs from 'fs';
import path from 'path';
import { callAI, MODEL } from './lib/aiClient';
import { buildSemanticPlannerConstraints } from '../lib/content/personas/semanticConstraints';
import { checkTopology } from './lib/topologyValidator';
import { buildPlannerSchema } from './lib/plannerSchema';
import { compilePlannerOutputToGraph } from './lib/plannerCompiler';
import type { PersonaId } from '../lib/evaluation/types';

// ─── LLM Call ────────────────────────────────────────────────────────────────
async function runPlanner(topic: string, persona: PersonaId, constraints: string): Promise<any> {
  const prompt = `You are the Causal Planner for the ${persona.toUpperCase()} persona.
Your task is to populate the required semantic components representing
the argument based on the topic: "${topic}"

SEMANTIC CONSTRAINTS (enforce strictly):
${constraints}

Generate the components now.`;

  const schema = buildPlannerSchema(persona);

  const text = await callAI({
    model: MODEL.GENERATION,
    contents: prompt,
    config: { responseMimeType: 'application/json', responseSchema: schema as any, temperature: 0 },
  });
  return JSON.parse(text);
}

// ─── Main ────────────────────────────────────────────────────────────────────
async function run() {
  const datasetPath = path.join(__dirname, 'datasets', 'dataset-exp-005.json');
  const dataset = JSON.parse(fs.readFileSync(datasetPath, 'utf-8'));

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

  const TARGET_CASES = ['C003', 'C005', 'C007', 'C008', 'C009'];
  const targetedCases = cases.filter(c => TARGET_CASES.some(t => c.caseId.startsWith(t)));

  console.log(`\n${'═'.repeat(60)}`);
  console.log(`  EXP-015: Planner Preflight Diagnostic (Compiler Mode)`);
  console.log(`  Running Planner (temp=0) -> Compiler -> Validator`);
  console.log(`${'═'.repeat(60)}\n`);

  let allCanonicalPassed = true;
  let totalCanonical = 0;
  let passedCanonical = 0;

  for (const c of targetedCases) {
    console.log(`[${c.caseId}] | ${c.persona.toUpperCase()}`);
    console.log(`${'─'.repeat(55)}`);
    
    const constraints = buildSemanticPlannerConstraints(c.persona as PersonaId);
    
    let plannerOutput;
    try {
      plannerOutput = await runPlanner(c.topic, c.persona as PersonaId, constraints);
    } catch (e: any) {
      console.error(`  ❌ Planner failed: ${e.message}`);
      allCanonicalPassed = false;
      continue;
    }

    let graph;
    try {
      graph = compilePlannerOutputToGraph(plannerOutput, c.persona as PersonaId);
    } catch (e: any) {
      console.error(`  ❌ Compiler failed: ${e.message}`);
      allCanonicalPassed = false;
      continue;
    }

    const topoResult = checkTopology(graph, c.persona);
    
    let caseCanonicalPass = true;

    for (const match of topoResult.edge_matches) {
      totalCanonical++;
      let status = '';
      if (match.actual === null) {
        status = '❌ MISSING';
        caseCanonicalPass = false;
        allCanonicalPassed = false;
      } else if (match.matched_via !== null) {
        if (match.is_equivalence) {
           status = `✅ EQUIVALENCE (${match.actual})`;
           passedCanonical++;
        } else {
           status = `✅ EXACT (${match.actual})`;
           passedCanonical++;
        }
      } else {
        status = `❌ WRONG_RELATION (Actual: ${match.actual})`;
        caseCanonicalPass = false;
        allCanonicalPassed = false;
      }
      console.log(`  Required: ${match.required}`);
      console.log(`    Actual: ${status}`);
    }
    
    console.log(`  Missing Required Nodes: ${topoResult.missing_required_nodes.length === 0 ? 'None' : topoResult.missing_required_nodes.join(', ')}`);
    console.log(`  Forbidden Nodes Found: ${topoResult.forbidden_nodes_found.length === 0 ? 'None' : topoResult.forbidden_nodes_found.join(', ')}`);
    
    if (topoResult.missing_required_nodes.length > 0 || topoResult.forbidden_nodes_found.length > 0) {
        caseCanonicalPass = false;
        allCanonicalPassed = false;
    }

    console.log(`  Case Status: Compliant=${topoResult.compliant ? 'PASS' : 'FAIL'}`);
    console.log();
  }

  console.log(`${'═'.repeat(60)}`);
  console.log(`  PREFLIGHT DIAGNOSTIC RESULTS`);
  console.log(`  Canonical required edges: ${passedCanonical}/${totalCanonical}`);
  console.log(`  Compiler invariant maintained: ${allCanonicalPassed ? 'PASS' : 'FAIL'}`);
  console.log(`${'═'.repeat(60)}\n`);
}

run().catch(console.error);
