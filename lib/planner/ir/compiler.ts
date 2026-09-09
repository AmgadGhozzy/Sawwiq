// ---------------------------------------------------------------------------
// Pipeline B — IR Compiler
//
// Pure, deterministic function that takes the raw output of the Planner LLM
// and compiles it into a valid IRGraph using the exact TOPOLOGY_REQUIRED.
// 
// Rules:
// 1. Single source of truth: TOPOLOGY_REQUIRED.
// 2. Edges are completely derived from topology; LLM cannot invent them.
// 3. Node ordering is deterministic (matches topology array).
// 4. Pure and immutable: input array is not mutated.
// ---------------------------------------------------------------------------

import { TOPOLOGY_REQUIRED, resolveTopology } from "../../content/personas/topologyDefinitions.ts";
import { IR_SCHEMA_VERSION, PLANNER_SUPPORTED_PERSONAS } from "../validation.ts";
import type { IRGraph, IRNode } from "../types.ts";
import type { PersonaId } from "../../evaluation/types.ts";
import type { IntellectualMode, IntellectualModeVariant } from "../../content/personas/topologyDefinitions.ts";

/**
 * The raw node output expected from the Planner LLM.
 */
export interface PlannerOutputNode {
  id: string;
  content: string;
  confidence?: number;
}

/**
 * Compiles a raw array of planner nodes into a strict IRGraph.
 * Throws an Error if the compilation fails (missing node, extra node, duplicate).
 * This error should be caught by the Edge Function and returned as a 502 PLANNER_FAILURE.
 */
export function compileIRGraph(
  plannerNodes: readonly PlannerOutputNode[],
  personaId: PersonaId,
  modeVariant: IntellectualModeVariant = "standard",
  forcedMode?: IntellectualMode
): IRGraph {
  // 1. Reject unsupported personas dynamically
  if (!PLANNER_SUPPORTED_PERSONAS.includes(personaId)) {
    throw new Error(`Compiler Error: Unsupported persona "${personaId}".`);
  }

  const topology = resolveTopology(personaId, modeVariant, forcedMode);

  // 2. Map input nodes and check for duplicates
  const nodeMap = new Map<string, PlannerOutputNode>();
  for (const node of plannerNodes) {
    if (nodeMap.has(node.id)) {
      throw new Error(`Compiler Error: Duplicate node id "${node.id}" from planner.`);
    }
    nodeMap.set(node.id, node);
  }

  const compiledNodes: IRNode[] = [];

  // 3. Ensure all required nodes are present, and order them deterministically
  for (const requiredId of topology.nodes) {
    const node = nodeMap.get(requiredId);
    if (!node) {
      throw new Error(`Compiler Error: Missing required node "${requiredId}" from planner.`);
    }
    
    compiledNodes.push({
      id: node.id,
      content: node.content,
      // Pass confidence if present and valid type (validation.ts will check the [0,1] range)
      ...(typeof node.confidence === "number" ? { confidence: node.confidence } : {})
    });

    nodeMap.delete(requiredId);
  }

  // 4. Reject any extra nodes that the planner invented
  if (nodeMap.size > 0) {
    const extraIds = Array.from(nodeMap.keys()).join(", ");
    throw new Error(`Compiler Error: Planner generated forbidden extra nodes: ${extraIds}`);
  }

  // 5. Derive edges entirely from topology (Planner has zero control over this)
  const compiledEdges = topology.edges.map((e) => ({
    from: e.from,
    to: e.to,
    rel: e.rel,
  }));

  // 6. Construct and return the final graph
  return {
    personaId,
    version: IR_SCHEMA_VERSION,
    nodes: compiledNodes,
    edges: compiledEdges,
  };
}
