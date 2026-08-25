/**
 * EXP-015 Topology Validator — Unit Tests
 *
 * Tests every applicable persona/scenario combination.
 * Note: forbidden-node (F) is only enforced for the intellectual persona.
 * For all other personas no forbidden-node list is defined, and that is
 * verified explicitly.
 *
 * Scenarios covered per persona:
 *   A. Exact required relation             => PASS
 *   B. Semantically equivalent relation    => PASS (via equivalence map)
 *   C. Incorrect / unrelated relation      => FAIL
 *   D. Missing required edge               => FAIL
 *   E. Missing required node               => FAIL
 *   F. Intellectual forbidden node present => FAIL  (intellectual only)
 *   G. Reversed edge direction             => FAIL (directional safety)
 *
 * These tests are deterministic (no LLM, no API).
 * Run with: npx tsx --test __tests__/topologyValidator.test.ts
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { checkTopology } from '../scripts/lib/topologyValidator';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function node(id: string, type: string) {
  return { id, type, claim: '', evidence: '' };
}

function edge(from: string, to: string, relation: string) {
  return { from, to, relation };
}

// Build a minimal valid graph for a persona using exact required relations.
// Used as the "golden" base that each test mutates.

function validDeveloperGraph() {
  return {
    nodes: [
      node('sys1',  'system'),
      node('con1',  'constraint'),
      node('mec1',  'mechanism'),
      node('int1',  'intervention'),
      node('cns1',  'consequence'),
    ],
    edges: [
      edge('sys1', 'con1', 'causes'),
      edge('con1', 'mec1', 'causes'),
      edge('mec1', 'int1', 'leads_to'),
      edge('int1', 'cns1', 'results_in'),
    ],
  };
}

function validIntellectualGraph() {
  return {
    nodes: [
      node('ass1',  'assumption'),
      node('cnt1',  'contradiction'),
      node('wf1',   'why_fails'),
      node('ref1',  'reframe'),
      node('syn1',  'synthesis'),
    ],
    edges: [
      edge('ass1', 'cnt1', 'contradicts'),
      edge('cnt1', 'wf1',  'causes'),
      edge('wf1',  'ref1', 'reframes'),
      edge('ref1', 'syn1', 'leads_to'),
    ],
  };
}

function validPsychologyGraph() {
  return {
    nodes: [
      node('trg1', 'trigger'),
      node('mot1', 'motive'),
      node('beh1', 'behavior'),
      node('rei1', 'reinforcement'),
      node('shf1', 'shift'),
    ],
    edges: [
      edge('trg1', 'mot1', 'causes'),
      edge('mot1', 'beh1', 'causes'),
      edge('beh1', 'rei1', 'reinforces'),
      edge('rei1', 'shf1', 'leads_to'),
    ],
  };
}

function validCreativeGraph() {
  return {
    nodes: [
      node('scn1', 'scene'),
      node('asc1', 'association'),
      node('ten1', 'tension'),
      node('trn1', 'transformation'),
      node('rts1', 'return_to_scene'),
    ],
    edges: [
      edge('scn1', 'asc1', 'maps_to'),
      edge('asc1', 'ten1', 'causes'),
      edge('ten1', 'trn1', 'transforms'),
      edge('trn1', 'rts1', 'leads_to'),
    ],
  };
}

// ─── DEVELOPER ───────────────────────────────────────────────────────────────

describe('Developer persona', () => {

  test('A — exact required relations => PASS', () => {
    const g = validDeveloperGraph();
    const r = checkTopology(g, 'developer');
    assert.equal(r.compliant, true, 'Should be compliant with exact relations');
    assert.equal(r.missing_required_edges.length, 0);
    assert.equal(r.missing_required_nodes.length, 0);
    assert.equal(r.equivalence_match_count, 0, 'No equivalence needed for exact relations');
  });

  test('B — planner uses "constrains" (sys→con) + "produces" (con→mec) + "causes" (mec→int) => PASS via equivalence', () => {
    const g = {
      nodes: validDeveloperGraph().nodes,
      edges: [
        edge('sys1', 'con1', 'constrains'),   // exact label from EXP-015 data
        edge('con1', 'mec1', 'produces'),     // exact label from EXP-015 data
        edge('mec1', 'int1', 'causes'),       // exact label from EXP-015 data
        edge('int1', 'cns1', 'results_in'),
      ],
    };
    const r = checkTopology(g, 'developer');
    assert.equal(r.compliant, true, 'Should pass via semantic equivalence');
    assert.equal(r.missing_required_edges.length, 0);
    assert.ok(r.equivalence_match_count >= 3, `Expected ≥3 equivalence matches, got ${r.equivalence_match_count}`);

    // Verify specific edge matches
    const sysCon = r.edge_matches.find(m => m.required.startsWith('system --causes--> constraint'));
    assert.ok(sysCon, 'system→constraint match should be recorded');
    assert.equal(sysCon!.matched_via, 'constrains');
    assert.equal(sysCon!.is_equivalence, true);
  });

  test('C — system uses "contradicts" for sys→con => FAIL', () => {
    const g = {
      nodes: validDeveloperGraph().nodes,
      edges: [
        edge('sys1', 'con1', 'contradicts'),  // wrong relation
        edge('con1', 'mec1', 'causes'),
        edge('mec1', 'int1', 'leads_to'),
        edge('int1', 'cns1', 'results_in'),
      ],
    };
    const r = checkTopology(g, 'developer');
    assert.equal(r.compliant, false, 'contradicts is not a valid equivalent for causes here');
    assert.ok(r.missing_required_edges.some(e => e.includes('system --causes--> constraint')));
  });

  test('D — missing sys→con edge => FAIL', () => {
    const g = {
      nodes: validDeveloperGraph().nodes,
      edges: [
        // sys1→con1 edge omitted
        edge('con1', 'mec1', 'causes'),
        edge('mec1', 'int1', 'leads_to'),
        edge('int1', 'cns1', 'results_in'),
      ],
    };
    const r = checkTopology(g, 'developer');
    assert.equal(r.compliant, false);
    assert.ok(r.missing_required_edges.some(e => e.includes('system --causes--> constraint')));
  });

  test('E — missing "mechanism" node => FAIL', () => {
    const g = {
      nodes: validDeveloperGraph().nodes.filter(n => n.type !== 'mechanism'),
      edges: validDeveloperGraph().edges,
    };
    const r = checkTopology(g, 'developer');
    assert.equal(r.compliant, false);
    assert.ok(r.missing_required_nodes.includes('mechanism'));
  });

  test('F — forbidden node not applicable to developer', () => {
    // Developer persona has no forbidden nodes in the checker
    const g = { ...validDeveloperGraph() };
    g.nodes = [...g.nodes, node('out1', 'outcome')]; // outcome is only forbidden for intellectual
    const r = checkTopology(g, 'developer');
    assert.equal(r.forbidden_nodes_found.length, 0, 'outcome is not forbidden for developer');
  });
});

// ─── INTELLECTUAL ─────────────────────────────────────────────────────────────

describe('Intellectual persona', () => {

  test('A — exact required relations => PASS', () => {
    const r = checkTopology(validIntellectualGraph(), 'intellectual');
    assert.equal(r.compliant, true);
    assert.equal(r.equivalence_match_count, 0);
  });

  test('B1 — planner uses "causes" for why_fails→reframe and reframe→synthesis => PASS via equivalence', () => {
    const g = {
      nodes: validIntellectualGraph().nodes,
      edges: [
        edge('ass1', 'cnt1', 'contradicts'),
        edge('cnt1', 'wf1',  'causes'),
        edge('wf1',  'ref1', 'causes'),     // "causes" accepted for "reframes"
        edge('ref1', 'syn1', 'causes'),     // "causes" accepted for "leads_to"
      ],
    };
    const r = checkTopology(g, 'intellectual');
    assert.equal(r.compliant, true);
    assert.ok(r.equivalence_match_count >= 2);
  });

  test('B2 — planner uses "leads_to" for why_fails→reframe => PASS via equivalence', () => {
    const g = {
      nodes: validIntellectualGraph().nodes,
      edges: [
        edge('ass1', 'cnt1', 'contradicts'),
        edge('cnt1', 'wf1',  'causes'),
        edge('wf1',  'ref1', 'leads_to'),   // "leads_to" accepted for "reframes"
        edge('ref1', 'syn1', 'leads_to'),
      ],
    };
    const r = checkTopology(g, 'intellectual');
    assert.equal(r.compliant, true);
  });

  test('C — planner uses "reinforces" for assumption→contradiction => FAIL', () => {
    const g = {
      nodes: validIntellectualGraph().nodes,
      edges: [
        edge('ass1', 'cnt1', 'reinforces'), // wrong — contradicts has no equivalents
        edge('cnt1', 'wf1',  'causes'),
        edge('wf1',  'ref1', 'reframes'),
        edge('ref1', 'syn1', 'leads_to'),
      ],
    };
    const r = checkTopology(g, 'intellectual');
    assert.equal(r.compliant, false);
    assert.ok(r.missing_required_edges.some(e => e.includes('assumption --contradicts--> contradiction')));
  });

  test('D — missing why_fails → reframe edge => FAIL', () => {
    const g = {
      nodes: validIntellectualGraph().nodes,
      edges: [
        edge('ass1', 'cnt1', 'contradicts'),
        edge('cnt1', 'wf1',  'causes'),
        // wf1 → ref1 missing
        edge('ref1', 'syn1', 'leads_to'),
      ],
    };
    const r = checkTopology(g, 'intellectual');
    assert.equal(r.compliant, false);
    assert.ok(r.missing_required_edges.some(e => e.includes('why_fails --reframes--> reframe')));
  });

  test('E — missing "synthesis" node => FAIL', () => {
    const g = {
      nodes: validIntellectualGraph().nodes.filter(n => n.type !== 'synthesis'),
      edges: validIntellectualGraph().edges,
    };
    const r = checkTopology(g, 'intellectual');
    assert.equal(r.compliant, false);
    assert.ok(r.missing_required_nodes.includes('synthesis'));
  });

  test('F — forbidden node "intervention" present => FAIL', () => {
    const g = {
      nodes: [...validIntellectualGraph().nodes, node('int_bad', 'intervention')],
      edges: validIntellectualGraph().edges,
    };
    const r = checkTopology(g, 'intellectual');
    assert.equal(r.compliant, false);
    assert.ok(r.forbidden_nodes_found.includes('intervention'));
  });

  test('F2 — forbidden node "outcome" present => FAIL', () => {
    // This matches the actual EXP-015 C003-I0 failure
    const g = {
      nodes: [...validIntellectualGraph().nodes, node('out_bad', 'outcome')],
      edges: validIntellectualGraph().edges,
    };
    const r = checkTopology(g, 'intellectual');
    assert.equal(r.compliant, false);
    assert.ok(r.forbidden_nodes_found.includes('outcome'));
  });

  test('F3 — I1 clean intellectual graph has NO forbidden nodes', () => {
    // Matches C003-I1 from EXP-015 (the only completed intellectual cell)
    const g = {
      nodes: [
        node('assumption_1',    'assumption'),
        node('contradiction_1', 'contradiction'),
        node('why_fails_1',     'why_fails'),
        node('reframe_1',       'reframe'),
        node('synthesis_1',     'synthesis'),
      ],
      edges: [
        edge('assumption_1',    'contradiction_1', 'contradicts'),
        edge('contradiction_1', 'why_fails_1',     'causes'),
        edge('why_fails_1',     'reframe_1',       'causes'),   // equivalence
        edge('reframe_1',       'synthesis_1',     'causes'),   // equivalence
      ],
    };
    const r = checkTopology(g, 'intellectual');
    assert.equal(r.forbidden_nodes_found.length, 0, 'I1 intellectual graph must have no forbidden nodes');
    assert.equal(r.compliant, true);
  });
});

// ─── PSYCHOLOGY ──────────────────────────────────────────────────────────────

describe('Psychology persona', () => {

  test('A — exact required relations => PASS', () => {
    const r = checkTopology(validPsychologyGraph(), 'psychology');
    assert.equal(r.compliant, true);
    assert.equal(r.equivalence_match_count, 0);
  });

  test('B — planner uses "causes" for reinforcement→shift => PASS via equivalence', () => {
    // Matches actual EXP-015 C002/C006 failure pattern
    const g = {
      nodes: validPsychologyGraph().nodes,
      edges: [
        edge('trg1', 'mot1', 'causes'),
        edge('mot1', 'beh1', 'causes'),
        edge('beh1', 'rei1', 'reinforces'),
        edge('rei1', 'shf1', 'causes'),      // "causes" accepted for "leads_to"
      ],
    };
    const r = checkTopology(g, 'psychology');
    assert.equal(r.compliant, true);
    assert.equal(r.equivalence_match_count, 1);
    const reiShift = r.edge_matches.find(m => m.required.includes('reinforcement --leads_to--> shift'));
    assert.ok(reiShift);
    assert.equal(reiShift!.matched_via, 'causes');
    assert.equal(reiShift!.is_equivalence, true);
  });

  test('C — planner uses "maps_to" for behavior→reinforcement => FAIL', () => {
    const g = {
      nodes: validPsychologyGraph().nodes,
      edges: [
        edge('trg1', 'mot1', 'causes'),
        edge('mot1', 'beh1', 'causes'),
        edge('beh1', 'rei1', 'maps_to'),    // maps_to ≠ reinforces
        edge('rei1', 'shf1', 'leads_to'),
      ],
    };
    const r = checkTopology(g, 'psychology');
    assert.equal(r.compliant, false);
    assert.ok(r.missing_required_edges.some(e => e.includes('behavior --reinforces--> reinforcement')));
  });

  test('D — missing reinforcement→shift edge => FAIL', () => {
    const g = {
      nodes: validPsychologyGraph().nodes,
      edges: [
        edge('trg1', 'mot1', 'causes'),
        edge('mot1', 'beh1', 'causes'),
        edge('beh1', 'rei1', 'reinforces'),
        // rei1 → shf1 missing
      ],
    };
    const r = checkTopology(g, 'psychology');
    assert.equal(r.compliant, false);
    assert.ok(r.missing_required_edges.some(e => e.includes('reinforcement --leads_to--> shift')));
  });

  test('E — missing "shift" node => FAIL', () => {
    const g = {
      nodes: validPsychologyGraph().nodes.filter(n => n.type !== 'shift'),
      edges: validPsychologyGraph().edges,
    };
    const r = checkTopology(g, 'psychology');
    assert.equal(r.compliant, false);
    assert.ok(r.missing_required_nodes.includes('shift'));
  });
});

// ─── CREATIVE ────────────────────────────────────────────────────────────────

describe('Creative persona', () => {

  test('A — exact required relations => PASS', () => {
    const r = checkTopology(validCreativeGraph(), 'creative');
    assert.equal(r.compliant, true);
    assert.equal(r.equivalence_match_count, 0);
  });

  test('B — planner uses "results_in" for transformation→return_to_scene => PASS via equivalence', () => {
    // Matches actual EXP-015 C004 failure pattern
    const g = {
      nodes: validCreativeGraph().nodes,
      edges: [
        edge('scn1', 'asc1', 'maps_to'),
        edge('asc1', 'ten1', 'causes'),
        edge('ten1', 'trn1', 'transforms'),
        edge('trn1', 'rts1', 'results_in'),  // "results_in" accepted for "leads_to"
      ],
    };
    const r = checkTopology(g, 'creative');
    assert.equal(r.compliant, true);
    assert.ok(r.equivalence_match_count >= 1);
  });

  test('B3 — planner uses "produces" for association→tension => PASS via equivalence', () => {
    // Matches C008 failure pattern
    const g = {
      nodes: validCreativeGraph().nodes,
      edges: [
        edge('scn1', 'asc1', 'maps_to'),
        edge('asc1', 'ten1', 'produces'),  // "produces" accepted for "causes"
        edge('ten1', 'trn1', 'transforms'),
        edge('trn1', 'rts1', 'leads_to'),
      ],
    };
    const r = checkTopology(g, 'creative');
    assert.equal(r.compliant, true);
    assert.ok(r.equivalence_match_count >= 1);
  });

  test('B2 — planner uses "causes" for tension→transformation => PASS via equivalence', () => {
    const g = {
      nodes: validCreativeGraph().nodes,
      edges: [
        edge('scn1', 'asc1', 'maps_to'),
        edge('asc1', 'ten1', 'causes'),
        edge('ten1', 'trn1', 'leads_to'),    // "leads_to" accepted for "transforms"
        edge('trn1', 'rts1', 'leads_to'),
      ],
    };
    const r = checkTopology(g, 'creative');
    assert.equal(r.compliant, true);
  });

  test('C — planner uses "contradicts" for scene→association => FAIL', () => {
    const g = {
      nodes: validCreativeGraph().nodes,
      edges: [
        edge('scn1', 'asc1', 'contradicts'), // maps_to has no equivalents
        edge('asc1', 'ten1', 'causes'),
        edge('ten1', 'trn1', 'transforms'),
        edge('trn1', 'rts1', 'leads_to'),
      ],
    };
    const r = checkTopology(g, 'creative');
    assert.equal(r.compliant, false);
    assert.ok(r.missing_required_edges.some(e => e.includes('scene --maps_to--> association')));
  });

  test('D — missing scene→association edge => FAIL', () => {
    const g = {
      nodes: validCreativeGraph().nodes,
      edges: [
        // scn1 → asc1 missing
        edge('asc1', 'ten1', 'causes'),
        edge('ten1', 'trn1', 'transforms'),
        edge('trn1', 'rts1', 'leads_to'),
      ],
    };
    const r = checkTopology(g, 'creative');
    assert.equal(r.compliant, false);
    assert.ok(r.missing_required_edges.some(e => e.includes('scene --maps_to--> association')));
  });

  test('E — missing "return_to_scene" node => FAIL', () => {
    const g = {
      nodes: validCreativeGraph().nodes.filter(n => n.type !== 'return_to_scene'),
      edges: validCreativeGraph().edges,
    };
    const r = checkTopology(g, 'creative');
    assert.equal(r.compliant, false);
    assert.ok(r.missing_required_nodes.includes('return_to_scene'));
  });
});

// ─── UNKNOWN PERSONA ─────────────────────────────────────────────────────────

describe('Edge cases', () => {

  test('Unknown persona => compliant=true (no topology to enforce)', () => {
    const r = checkTopology({ nodes: [], edges: [] }, 'unknown_persona');
    assert.equal(r.compliant, true);
  });

  test('Empty graph for known persona => FAIL (all nodes and edges missing)', () => {
    const r = checkTopology({ nodes: [], edges: [] }, 'developer');
    assert.equal(r.compliant, false);
    assert.ok(r.missing_required_nodes.length > 0);
  });

  test('Equivalence does NOT accept wrong structural relations (contamination protection)', () => {
    // "contradicts" must not be accepted in place of "reinforces"
    const g = {
      nodes: validPsychologyGraph().nodes,
      edges: [
        edge('trg1', 'mot1', 'causes'),
        edge('mot1', 'beh1', 'causes'),
        edge('beh1', 'rei1', 'contradicts'), // contradicts ≠ reinforces
        edge('rei1', 'shf1', 'leads_to'),
      ],
    };
    const r = checkTopology(g, 'psychology');
    assert.equal(r.compliant, false);
    assert.ok(r.missing_required_edges.some(e => e.includes('reinforces')));
  });

  test('Equivalence diagnostic fields are populated correctly', () => {
    // Use an equivalence-matched graph and verify all fields
    const g = {
      nodes: validDeveloperGraph().nodes,
      edges: [
        edge('sys1', 'con1', 'constrains'),  // equivalence
        edge('con1', 'mec1', 'constrains'),  // equivalence (produces was removed)
        edge('mec1', 'int1', 'leads_to'),    // exact
        edge('int1', 'cns1', 'results_in'),  // exact
      ],
    };
    const r = checkTopology(g, 'developer');
    assert.equal(r.compliant, true);
    assert.equal(r.edge_matches.length, 4, 'Should have 4 edge match entries');
    assert.equal(r.equivalence_match_count, 2, 'sys→con and con→mec are equivalences');

    // Verify exact matches are not flagged as equivalence
    const mecInt = r.edge_matches.find(m => m.required.includes('mechanism --leads_to-->'));
    assert.ok(mecInt);
    assert.equal(mecInt!.is_equivalence, false);
    assert.equal(mecInt!.actual, 'leads_to');
    assert.equal(mecInt!.matched_via, 'leads_to');
  });

  // G — reversed direction tests
  test('G1 — reversed developer edge (constraint→system) is not accepted by equivalence', () => {
    // Equivalence must not relax direction — only the label.
    // Required: system --causes--> constraint
    // This supplies: constraint --constrains--> system (reversed)
    const g = {
      nodes: validDeveloperGraph().nodes,
      edges: [
        edge('con1', 'sys1', 'constrains'),  // reversed direction
        edge('con1', 'mec1', 'causes'),
        edge('mec1', 'int1', 'leads_to'),
        edge('int1', 'cns1', 'results_in'),
      ],
    };
    const r = checkTopology(g, 'developer');
    assert.equal(r.compliant, false, 'Reversed direction must not pass even via equivalence');
    assert.ok(
      r.missing_required_edges.some(e => e.includes('system --causes--> constraint')),
      'system→constraint must appear in missing edges'
    );
  });

  test('G2 — reversed intellectual edge (synthesis→reframe) is not accepted', () => {
    // Required: reframe --leads_to--> synthesis
    // This supplies: synthesis --leads_to--> reframe (reversed)
    const g = {
      nodes: validIntellectualGraph().nodes,
      edges: [
        edge('ass1', 'cnt1', 'contradicts'),
        edge('cnt1', 'wf1',  'causes'),
        edge('wf1',  'ref1', 'reframes'),
        edge('syn1', 'ref1', 'leads_to'),   // reversed: syn→ref instead of ref→syn
      ],
    };
    const r = checkTopology(g, 'intellectual');
    assert.equal(r.compliant, false, 'Reversed direction must be rejected');
    assert.ok(
      r.missing_required_edges.some(e => e.includes('reframe --leads_to--> synthesis')),
      'reframe→synthesis must appear in missing edges'
    );
  });
});

// ─── EDGE-SPECIFIC EQUIVALENCE MAP (User Requested Tests) ────────────────────

describe('Edge-Specific Equivalence Map', () => {
  test('accepts transforms only for reframe -> synthesis', () => {
    const g = validIntellectualGraph();
    g.edges[3] = edge('ref1', 'syn1', 'transforms');
    const r = checkTopology(g, 'intellectual');
    assert.equal(r.compliant, true);
  });

  test('rejects transforms for assumption -> contradiction', () => {
    const g = validIntellectualGraph();
    g.edges[0] = edge('ass1', 'cnt1', 'transforms');
    const r = checkTopology(g, 'intellectual');
    assert.equal(r.compliant, false);
    
    const match = r.edge_matches.find(m => m.required.includes('assumption --contradicts--> contradiction'));
    assert.ok(match);
    assert.equal(match!.actual, 'transforms');
    assert.equal(match!.matched_via, null);
  });

  test('accepts constrains for system -> constraint', () => {
    const g = validDeveloperGraph();
    g.edges[0] = edge('sys1', 'con1', 'constrains');
    const r = checkTopology(g, 'developer');
    assert.equal(r.compliant, true);
    
    const match = r.edge_matches.find(m => m.required.includes('system --causes--> constraint'));
    assert.ok(match);
    assert.equal(match!.actual, 'constrains');
    assert.equal(match!.matched_via, 'constrains');
  });

  test('rejects maps_to for causal edges', () => {
    const g = validDeveloperGraph();
    g.edges[0] = edge('sys1', 'con1', 'maps_to');
    const r = checkTopology(g, 'developer');
    assert.equal(r.compliant, false);
  });

  test('reports actual relation on equivalent match', () => {
    const g = validIntellectualGraph();
    g.edges[2] = edge('wf1', 'ref1', 'causes');
    const r = checkTopology(g, 'intellectual');
    const match = r.edge_matches.find(m => m.required.includes('why_fails --reframes--> reframe'));
    assert.ok(match);
    assert.equal(match!.actual, 'causes');
    assert.equal(match!.matched_via, 'causes');
    assert.equal(match!.is_equivalence, true);
  });

  test('does not allow transforms globally', () => {
    const g = validDeveloperGraph();
    g.edges[0] = edge('sys1', 'con1', 'transforms');
    const r = checkTopology(g, 'developer');
    assert.equal(r.compliant, false);
    
    const match = r.edge_matches.find(m => m.required.includes('system --causes--> constraint'));
    assert.ok(match);
    assert.equal(match!.actual, 'transforms');
    assert.equal(match!.matched_via, null);
  });
});

