import * as fs from "fs";
import * as path from "path";
import { config } from "dotenv";
config({ path: path.join(process.cwd(), ".env.local") });

import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({
  vertexai: true,
  apiKey: process.env.VERTEX_AI_API_KEY,
});

async function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ─── GRAPH TYPES & ENUMS ────────────────────────────────────────────────────
const ALLOWED_NODES = [
  "observation", "assumption", "trigger", "system", "constraint", 
  "motive", "behavior", "reinforcement", "contradiction", "reframe", 
  "scene", "association", "tension", "transformation", "outcome",
  "bottleneck", "mechanism", "intervention", "sensory_detail", 
  "return_to_scene", "awareness_shift", "why_fails", "synthesis"
];

const ALLOWED_EDGES = [
  "causes", "constrains", "reinforces", "contradicts", "reframes", 
  "maps_to", "transforms", "results_in", "leads_to", "produces"
];

const GRAPH_SCHEMA = {
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
        required: ["id", "type", "claim", "evidence"]
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
        required: ["from", "to", "relation"]
      }
    }
  },
  required: ["nodes", "edges"]
};

// ─── VALIDATOR SCHEMA ───────────────────────────────────────────────────────
const CONTRASTIVE_VALIDATOR_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    target_persona: { type: Type.STRING },
    target_topology_valid: { type: Type.BOOLEAN },
    forbidden_patterns: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          persona: { type: Type.STRING },
          detected: { type: Type.BOOLEAN },
          evidence: { type: Type.STRING }
        },
        required: ["persona", "detected", "evidence"]
      }
    },
    nearest_competing_persona: { type: Type.STRING },
    collision_probability: { type: Type.NUMBER }, // 0.0 to 1.0
    violations: { 
      type: Type.ARRAY, 
      items: { type: Type.STRING }
    }
  },
  required: [
    "target_persona", "target_topology_valid", "forbidden_patterns", 
    "nearest_competing_persona", "collision_probability", "violations"
  ]
};

// ─── CANONICAL TOPOLOGIES ───────────────────────────────────────────────────
const TOPOLOGIES: Record<string, any> = {
  developer: {
    prompt: `
CANONICAL EDGE PATTERN:
system --constrains--> constraint
constraint --causes--> bottleneck
bottleneck --causes--> mechanism
mechanism --leads_to--> intervention
intervention --results_in--> outcome

RULES: 
- Must represent a structural system. 
- NO emotional motives. NO 'motive' or 'behavior' nodes.
- Edges must strictly match the canonical pattern.
`,
    nodes: ["system", "constraint", "bottleneck", "mechanism", "intervention", "outcome"],
    forbidden: ["motive", "behavior", "trigger", "reinforcement", "scene"]
  },
  psychology: {
    prompt: `
CANONICAL EDGE PATTERN:
trigger --causes--> motive
motive --causes--> behavior
behavior --produces--> reinforcement
reinforcement --reinforces--> behavior
behavior --leads_to--> awareness_shift

RULES:
- Must have the feedback loop: 'reinforcement' --reinforces--> 'behavior'.
- Focus on internal human drivers.
`,
    nodes: ["trigger", "motive", "behavior", "reinforcement", "awareness_shift"],
    forbidden: ["system", "intervention", "bottleneck", "scene"]
  },
  intellectual: {
    prompt: `
CANONICAL EDGE PATTERN:
assumption --contradicts--> contradiction
contradiction --causes--> why_fails
why_fails --reframes--> reframe
reframe --leads_to--> synthesis

RULES:
- NO 'intervention' or 'fix' nodes. You do not fix the system, you prove the question is wrong.
- Must show a logical paradox or framing error.
`,
    nodes: ["assumption", "contradiction", "why_fails", "reframe", "synthesis"],
    forbidden: ["intervention", "motive", "trigger", "scene"]
  },
  creative: {
    prompt: `
CANONICAL EDGE PATTERN:
scene --maps_to--> sensory_detail
sensory_detail --leads_to--> association
association --causes--> tension
tension --transforms--> transformation
transformation --results_in--> return_to_scene

RULES:
- Must begin with a physical 'scene' and end with 'return_to_scene'.
- NO psychological abstraction at the start.
`,
    nodes: ["scene", "sensory_detail", "association", "tension", "transformation", "return_to_scene"],
    forbidden: ["system", "intervention", "assumption"]
  }
};

const retryEval = async <T>(fn: () => Promise<T>): Promise<T> => {
  let retries = 10;
  while (retries > 0) {
    try { return await fn(); }
    catch (e: any) {
      if (e?.status === 429 && retries > 1) {
        console.log(`     [Rate Limit] 429 hit. Waiting 20s...`);
        await delay(20000);
        retries--;
      } else throw e;
    }
  }
  throw new Error("Max retries exceeded");
};

// ─── 1. PLANNER ─────────────────────────────────────────────────────────────
async function generateGraph(topic: string, personaId: string, previousGraph?: any, violations?: string[]) {
  let prompt = `You are a Cognitive Graph Planner.
Topic: "${topic}"
Target Persona: ${personaId.toUpperCase()}

Your task is to build a machine-verifiable Causal Graph (nodes and edges) representing the argument.

REQUIRED TOPOLOGY FOR ${personaId.toUpperCase()}:
${TOPOLOGIES[personaId].prompt}

CRITICAL RULES:
- Nodes must strictly follow the allowed types in the topology.
- Edges must exactly match the canonical edge pattern and relation types.
- Do not leak patterns from other personas.
`;

  if (previousGraph && violations && violations.length > 0) {
    prompt += `\n\n[REPAIR REQUIRED]
The previous graph failed validation. 
Violations detected:
${violations.map(v => "- " + v).join("\n")}

Previous Graph:
${JSON.stringify(previousGraph, null, 2)}

ACTION: Do not regenerate the entire concept. ONLY fix the specific violating nodes/edges to comply with the topology.`;
  }

  const response = await retryEval(() => ai.models.generateContent({
    model: "gemini-3.1-flash-lite",
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: GRAPH_SCHEMA as any,
      temperature: previousGraph ? 0.2 : 0.4
    }
  }));

  return JSON.parse(response.text!);
}

// ─── 2. CONTRASTIVE VALIDATOR ───────────────────────────────────────────────
async function validateGraph(graph: any, targetPersona: string) {
  const prompt = `You are an Independent Contrastive Critic.
Evaluate this Causal Graph against the 4 Cognitive Topologies.

Target Persona: ${targetPersona.toUpperCase()}

Graph:
${JSON.stringify(graph, null, 2)}

Topologies:
1. DEVELOPER: system --constrains--> constraint ...
2. PSYCHOLOGY: trigger --causes--> motive ... (loop required)
3. INTELLECTUAL: assumption --contradicts--> contradiction ... (NO interventions)
4. CREATIVE: scene --maps_to--> sensory_detail ...

Tasks:
1. Does it strictly follow the target topology?
2. Did it leak forbidden patterns from other personas?
3. Identify the nearest competing persona.
4. If it violates structural rules or leaks, list specific 'violations' strings.
`;

  const response = await retryEval(() => ai.models.generateContent({
    model: "gemini-3.1-flash-lite",
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: CONTRASTIVE_VALIDATOR_SCHEMA as any,
      temperature: 0.1
    }
  }));

  return JSON.parse(response.text!);
}

// ─── 3. DETERMINISTIC VALIDATOR ─────────────────────────────────────────────
function deterministicValidation(graph: any, personaId: string) {
  const violations: string[] = [];
  const rules = TOPOLOGIES[personaId];

  // 1. Check for missing required nodes
  const graphNodeTypes = (graph.nodes || []).map((n: any) => n.type);
  for (const reqNode of rules.nodes) {
    if (!graphNodeTypes.includes(reqNode)) {
      violations.push(`Missing required node: ${reqNode}`);
    }
  }

  // 2. Check for forbidden nodes
  for (const fNode of rules.forbidden) {
    if (graphNodeTypes.includes(fNode)) {
      violations.push(`Contains forbidden node: ${fNode}`);
    }
  }

  // 3. Basic edge structure check (ensure they didn't just dump all nodes flatly)
  if (!graph.edges || graph.edges.length < rules.nodes.length - 1) {
    violations.push(`Graph appears disconnected. Expected at least ${rules.nodes.length - 1} edges.`);
  }

  return {
    valid: violations.length === 0,
    violations
  };
}

// ─── EXP-010A RUNNER ────────────────────────────────────────────────────────
async function runExp010A() {
  const datasetPath = path.join(__dirname, "datasets", "dataset-exp-010.json");
  const dataset = JSON.parse(fs.readFileSync(datasetPath, "utf-8"));
  const reportPath = path.join(__dirname, "benchmark-reports", `exp-010A-topology-${Date.now()}.json`);

  console.log(`🚀 Starting EXP-010A: Topology Validation & Repair Loop`);
  
  const results: any = { 
    summary: { 
      total: 0, 
      passed_initial: 0, 
      passed_repaired: 0, 
      failed: 0,
      total_repair_attempts: 0,
      repairs_needed: 0,
      failure_by_persona: { developer: 0, psychology: 0, intellectual: 0, creative: 0 },
      failure_by_category: { Human: 0, Business: 0, Technical: 0, Adversarial: 0 },
      topology_valid_but_contrastive_failed: 0
    }, 
    cases: [] 
  };

  for (const topic of dataset.topics) {
    console.log(`\n📌 Topic: ${topic.prompt} [${topic.category}]`);

    for (const personaId of dataset.personas) {
      process.stdout.write(`   Generate -> ${personaId}... `);
      results.summary.total++;
      
      let graph = await generateGraph(topic.prompt, personaId);
      
      // Deterministic check
      let detCheck = deterministicValidation(graph, personaId);
      // LLM check
      let llmCheck = await validateGraph(graph, personaId);
      
      const noForbiddenLeak = llmCheck.forbidden_patterns.every((p: any) => !p.detected);
      
      let passed = detCheck.valid && llmCheck.target_topology_valid && noForbiddenLeak;
      
      if (detCheck.valid && (!llmCheck.target_topology_valid || !noForbiddenLeak)) {
         results.summary.topology_valid_but_contrastive_failed++;
      }

      if (passed) {
        console.log(`✅ Passed (Initial)`);
        results.summary.passed_initial++;
      } else {
        console.log(`❌ Failed (Initial).`);
        results.summary.repairs_needed++;
        
        let attempts = 0;
        while (attempts < 3 && !passed) {
          attempts++;
          results.summary.total_repair_attempts++;
          
          const combinedViolations = [...detCheck.violations, ...(llmCheck.violations || [])];
          if (!noForbiddenLeak) combinedViolations.push("Forbidden persona patterns leaked.");
          
          process.stdout.write(`     [Repair ${attempts}/3] Fixing violations... `);
          graph = await generateGraph(topic.prompt, personaId, graph, combinedViolations);
          
          detCheck = deterministicValidation(graph, personaId);
          llmCheck = await validateGraph(graph, personaId);
          
          const noForbiddenLeakRetry = llmCheck.forbidden_patterns.every((p: any) => !p.detected);
          passed = detCheck.valid && llmCheck.target_topology_valid && noForbiddenLeakRetry;
          
          if (passed) console.log(`✅ Passed!`);
          else console.log(`❌ Failed.`);
        }
        
        if (passed) {
          results.summary.passed_repaired++;
        } else {
          results.summary.failed++;
          results.summary.failure_by_persona[personaId]++;
          results.summary.failure_by_category[topic.category]++;
        }
      }

      results.cases.push({
        topic_id: topic.id,
        category: topic.category,
        persona: personaId,
        adversarial_targets: topic.adversarial_targets || [],
        final_graph: graph,
        deterministic_check: detCheck,
        llm_check: llmCheck,
        repair_attempts: passed ? 0 : 3, // Roughly
        status: passed ? "PASS" : "FAIL"
      });
      
      fs.writeFileSync(reportPath, JSON.stringify(results, null, 2));
    }
  }

  // Final summary stats
  const total = results.summary.total;
  results.summary.initial_pass_rate = ((results.summary.passed_initial / total) * 100).toFixed(1) + "%";
  results.summary.final_pass_rate = (((results.summary.passed_initial + results.summary.passed_repaired) / total) * 100).toFixed(1) + "%";
  results.summary.repair_success_rate = results.summary.repairs_needed > 0 ? 
    ((results.summary.passed_repaired / results.summary.repairs_needed) * 100).toFixed(1) + "%" : "N/A";
  results.summary.avg_repair_attempts = results.summary.repairs_needed > 0 ? 
    (results.summary.total_repair_attempts / results.summary.repairs_needed).toFixed(2) : "0";

  fs.writeFileSync(reportPath, JSON.stringify(results, null, 2));
  console.log(`\n✅ EXP-010A Complete. Report saved to: ${reportPath}`);
  console.log(JSON.stringify(results.summary, null, 2));
}

if (require.main === module) {
  runExp010A().catch(console.error);
}
