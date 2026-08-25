import { TOPOLOGY_REQUIRED } from "../../lib/content/personas/topologyDefinitions";
import type { PersonaId } from "../../lib/evaluation/types";

export type ContentNode = {
  claim: string;
  evidence: string;
};

export type PlannerOutput = Record<string, ContentNode>;

export interface GraphIR {
  nodes: Array<{
    id: string;
    type: string;
    claim: string;
    evidence: string;
  }>;
  edges: Array<{
    from: string;
    to: string;
    relation: string;
  }>;
}

/**
 * Deterministically compiles a flat semantic planner output into the exact
 * Causal Graph structure required by the persona's topology.
 *
 * This completely isolates semantic generation (LLM) from structural graph
 * construction (Application), guaranteeing 100% topology compliance as long
 * as the required nodes are provided.
 */
export function compilePlannerOutputToGraph(
  output: PlannerOutput,
  personaId: PersonaId
): GraphIR {
  const topo = TOPOLOGY_REQUIRED[personaId];
  if (!topo) {
    throw new Error(`No topology defined for persona: ${personaId}`);
  }

  const nodes: GraphIR["nodes"] = [];
  
  // 1. Build canonical nodes
  for (const nodeType of topo.nodes) {
    const nodeContent = output[nodeType];
    if (!nodeContent || typeof nodeContent.claim !== 'string' || typeof nodeContent.evidence !== 'string') {
      throw new Error(`Missing or invalid semantic content for required node: ${nodeType}`);
    }
    
    nodes.push({
      id: `${nodeType}_1`, // deterministic ID
      type: nodeType,
      claim: nodeContent.claim,
      evidence: nodeContent.evidence,
    });
  }

  // 2. Build canonical edges
  const edges: GraphIR["edges"] = topo.edges.map(e => ({
    from: `${e.from}_1`,
    to: `${e.to}_1`,
    relation: e.rel,
  }));

  return { nodes, edges };
}
