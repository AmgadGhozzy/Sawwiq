import { Type } from "@google/genai";
import { TOPOLOGY_REQUIRED } from "../../lib/content/personas/topologyDefinitions";
import type { PersonaId } from "../../lib/evaluation/types";

/**
 * Dynamically builds a flat JSON Schema for the semantic planner based on
 * the persona's required topology.
 *
 * Instead of asking the LLM to reconstruct the graph nodes and edges,
 * we just ask it to populate an object where the keys are the exact
 * node types required by the topology.
 */
export function buildPlannerSchema(personaId: PersonaId) {
  const topo = TOPOLOGY_REQUIRED[personaId];
  if (!topo) {
    throw new Error(`No topology defined for persona: ${personaId}`);
  }

  // Schema for a single semantic node
  const nodeSchema = {
    type: Type.OBJECT,
    properties: {
      claim: { type: Type.STRING, description: "The core argument or statement for this component." },
      evidence: { type: Type.STRING, description: "The supporting reasoning, example, or proof." },
    },
    required: ["claim", "evidence"],
  };

  // Build the flat object schema where keys = required node types
  const properties: Record<string, any> = {};
  for (const nodeType of topo.nodes) {
    properties[nodeType] = nodeSchema;
  }

  return {
    type: Type.OBJECT,
    properties,
    required: topo.nodes,
  };
}
