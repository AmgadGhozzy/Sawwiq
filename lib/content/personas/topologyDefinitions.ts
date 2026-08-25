/**
 * Canonical Topology Definitions — Single Source of Truth
 *
 * Defines the required node types and directed edges for each persona's
 * Causal Graph. Consumed by:
 *   - semanticConstraints.ts  (planner prompt contract)
 *   - topologyValidator.ts    (deterministic post-planner check)
 *
 * If you add a persona or change a topology, both the planner contract
 * and the validator will automatically stay in sync.
 */

import type { PersonaId } from "../../evaluation/types";

// ─── Required topology per persona ───────────────────────────────────────────

export interface TopologyEdge {
  from: string;
  to: string;
  rel: string;
}

export interface TopologyDefinition {
  nodes: string[];
  edges: TopologyEdge[];
}

export const TOPOLOGY_REQUIRED: Record<PersonaId, TopologyDefinition> = {
  intellectual: {
    nodes: ['assumption', 'contradiction', 'why_fails', 'reframe', 'synthesis'],
    edges: [
      { from: 'assumption',    to: 'contradiction', rel: 'contradicts' },
      { from: 'contradiction', to: 'why_fails',     rel: 'causes'     },
      { from: 'why_fails',     to: 'reframe',       rel: 'reframes'   },
      { from: 'reframe',       to: 'synthesis',     rel: 'leads_to'   },
    ],
  },
  developer: {
    nodes: ['system', 'constraint', 'mechanism', 'intervention', 'consequence'],
    edges: [
      { from: 'system',       to: 'constraint',   rel: 'causes'     },
      { from: 'constraint',   to: 'mechanism',    rel: 'causes'     },
      { from: 'mechanism',    to: 'intervention', rel: 'leads_to'   },
      { from: 'intervention', to: 'consequence',  rel: 'results_in' },
    ],
  },
  psychology: {
    nodes: ['trigger', 'motive', 'behavior', 'reinforcement', 'shift'],
    edges: [
      { from: 'trigger',       to: 'motive',        rel: 'causes'     },
      { from: 'motive',        to: 'behavior',      rel: 'causes'     },
      { from: 'behavior',      to: 'reinforcement', rel: 'reinforces' },
      { from: 'reinforcement', to: 'shift',         rel: 'leads_to'   },
    ],
  },
  creative: {
    nodes: ['scene', 'association', 'tension', 'transformation', 'return_to_scene'],
    edges: [
      { from: 'scene',          to: 'association',     rel: 'maps_to'    },
      { from: 'association',    to: 'tension',         rel: 'causes'     },
      { from: 'tension',        to: 'transformation',  rel: 'transforms' },
      { from: 'transformation', to: 'return_to_scene', rel: 'leads_to'  },
    ],
  },
};
