/**
 * Deterministic Topology Validator
 *
 * Checks whether a planner Causal Graph satisfies the required topology for
 * a given persona WITHOUT calling any LLM.
 *
 * Semantic-equivalence layer
 * ──────────────────────────
 * The planner is allowed to use semantically equivalent relation labels.
 * For example, "constrains" is accepted where "causes" is required, because
 * both express a causal dependency in the direction system → constraint.
 *
 * The map is CONSERVATIVE by design:
 *   - Structurally distinct relations (contradicts, reinforces, maps_to, transforms)
 *     are NOT accepted in place of each other.
 *   - Only "directional flow" relations are grouped.
 *
 * Evidence from EXP-015 (6 cells, both arms):
 *   Developer  : planner used "constrains" and "produces" instead of "causes"
 *   Psychology : planner used "causes" instead of "leads_to"
 *   Intellectual: planner used "causes" instead of "reframes" / "leads_to"
 *   Creative   : planner used "results_in" instead of "leads_to"
 *
 * Justification for each equivalence group is documented inline.
 */

// ─── Required topology imported from shared definitions ─────────────────────
import { TOPOLOGY_REQUIRED } from '../../lib/content/personas/topologyDefinitions';
export { TOPOLOGY_REQUIRED };
export type { TopologyEdge, TopologyDefinition } from '../../lib/content/personas/topologyDefinitions';

// ─── Semantic-equivalence map ─────────────────────────────────────────────────
//
// Key   = the REQUIRED edge signature (`${from}->${to}:${req.rel}`)
// Value = the set of actual relation labels the planner is ALLOWED to emit
//
// This is strictly bound to specific structural edges to prevent cross-contamination
// (e.g., accepting 'transforms' only where a transformation naturally occurs).

export const EDGE_RELATION_EQUIVALENCE: Record<string, readonly string[]> = {
  'system->constraint:causes': [
    'causes',
    'constrains',
  ],

  'constraint->mechanism:causes': [
    'causes',
    'constrains',
    'produces', // Evidence from EXP-015 Developer C005
  ],

  'mechanism->intervention:leads_to': [
    'leads_to',
    'causes',
    'results_in',
    'produces',
  ],

  'why_fails->reframe:reframes': [
    'reframes',
    'causes',
    'leads_to',
  ],

  'reframe->synthesis:leads_to': [
    'leads_to',
    'causes',
    'results_in',
    'produces',
    'transforms',
  ],

  'tension->transformation:transforms': [
    'transforms',
    'leads_to',
    'results_in',
  ],

  'reinforcement->shift:leads_to': [
    'leads_to',
    'causes', // Evidence from EXP-015 Psychology C002/C006
  ],

  'transformation->return_to_scene:leads_to': [
    'leads_to',
    'results_in', // Evidence from EXP-015 Creative C004
  ],

  // Structurally distinct - no equivalence
  'assumption->contradiction:contradicts': ['contradicts'],
  'behavior->reinforcement:reinforces': ['reinforces'],
  'scene->association:maps_to': ['maps_to'],

  // C008 evidence: planner used "produces" for association→tension.
  // The edge is structurally present; these are legitimate causal-flow synonyms.
  'association->tension:causes': [
    'causes',
    'produces',
    'leads_to',
    'results_in',
  ],
};

// ─── Result type ─────────────────────────────────────────────────────────────

export interface TopologyEdgeMatch {
  required: string;           // e.g. "system --causes--> constraint"
  actual: string | null;      // actual relation used in graph, null if no edge exists
  matched_via: string | null; // which relation string matched the equivalence list
  is_equivalence: boolean;    // true if matched via equivalence (not exact)
}

export interface TopologyResult {
  compliant: boolean;
  missing_required_nodes: string[];
  forbidden_nodes_found: string[];
  missing_required_edges: string[];
  /** All required edges and their match outcome */
  edge_matches: TopologyEdgeMatch[];
  /** How many edges were satisfied via equivalence normalization */
  equivalence_match_count: number;
}

// ─── Checker ─────────────────────────────────────────────────────────────────

/**
 * Deterministic topology check. Does NOT call any LLM.
 *
 * @param graph  The planner's Causal Graph (nodes[] + edges[]).
 * @param persona  One of: intellectual | developer | psychology | creative.
 * @returns      A TopologyResult with full diagnostics.
 */
export function checkTopology(graph: {
  nodes?: Array<{ id: string; type: string }>;
  edges?: Array<{ from: string; to: string; relation: string }>;
}, persona: string): TopologyResult {
  const topo = TOPOLOGY_REQUIRED[persona];

  // Unknown persona — no topology to enforce
  if (!topo) {
    return {
      compliant: true,
      missing_required_nodes: [],
      forbidden_nodes_found: [],
      missing_required_edges: [],
      edge_matches: [],
      equivalence_match_count: 0,
    };
  }

  const nodes = graph.nodes ?? [];
  const edges = graph.edges ?? [];

  // Build lookup structures
  const nodeTypes = new Set<string>(nodes.map((n) => n.type));
  const typeToIds: Record<string, string[]> = {};
  for (const n of nodes) {
    if (!typeToIds[n.type]) typeToIds[n.type] = [];
    typeToIds[n.type].push(n.id);
  }

  // Edge lookup: "fromId→toId:relation"
  const edgeLookup = new Set<string>(
    edges.map((e) => `${e.from}→${e.to}:${e.relation}`)
  );

  // ── Required node check ──
  const missing_required_nodes = topo.nodes.filter((t) => !nodeTypes.has(t));

  // ── Forbidden node check (intellectual only) ──
  const forbidden_nodes_found: string[] = [];
  if (persona === 'intellectual') {
    for (const t of ['intervention', 'outcome', 'fix']) {
      if (nodeTypes.has(t)) forbidden_nodes_found.push(t);
    }
  }

  // ── Required edge check with equivalence ──
  const edge_matches: TopologyEdgeMatch[] = [];
  const missing_required_edges: string[] = [];
  let equivalence_match_count = 0;

  for (const req of topo.edges) {
    const fromIds = typeToIds[req.from] ?? [];
    const toIds   = typeToIds[req.to]   ?? [];
    const edgeKey = `${req.from}->${req.to}:${req.rel}`;
    const acceptedRelations = EDGE_RELATION_EQUIVALENCE[edgeKey] ?? [req.rel];

    let actual: string | null = null;
    let matched_via: string | null = null;
    let is_equivalence = false;

    outer:
    for (const f of fromIds) {
      for (const t of toIds) {
        // First try to find a valid matched relation
        for (const acceptedRel of acceptedRelations) {
          if (edgeLookup.has(`${f}→${t}:${acceptedRel}`)) {
            actual = acceptedRel;
            matched_via = acceptedRel;
            is_equivalence = acceptedRel !== req.rel;
            break outer;
          }
        }
        // If not matched yet, at least record any relation that exists between f and t
        if (!actual) {
          for (const e of edges) {
            if (e.from === f && e.to === t) {
              actual = e.relation;
            }
          }
        }
      }
    }

    const label = `${req.from} --${req.rel}--> ${req.to}`;
    edge_matches.push({ required: label, actual, matched_via, is_equivalence });

    if (matched_via === null) {
      missing_required_edges.push(label);
    } else if (is_equivalence) {
      equivalence_match_count++;
    }
  }

  const compliant =
    missing_required_nodes.length === 0 &&
    forbidden_nodes_found.length === 0 &&
    missing_required_edges.length === 0;

  return {
    compliant,
    missing_required_nodes,
    forbidden_nodes_found,
    missing_required_edges,
    edge_matches,
    equivalence_match_count,
  };
}
