import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { compilePlannerOutputToGraph } from '../scripts/lib/plannerCompiler';
import { checkTopology } from '../scripts/lib/topologyValidator';
import type { PersonaId } from '../lib/evaluation/types';

describe('Planner Compiler Invariants', () => {
  const personas: PersonaId[] = ['intellectual', 'developer', 'psychology', 'creative'];

  for (const persona of personas) {
    test(`Compiles ${persona} output and passes topology validation exactly`, () => {
      // 1. Mock a valid flat planner output for this persona
      const mockOutput: Record<string, any> = {};
      
      // Determine required nodes by calling the compiler with empty output
      // and catching the error, or just by importing TOPOLOGY_REQUIRED.
      // We'll import TOPOLOGY_REQUIRED for the test.
      const { TOPOLOGY_REQUIRED } = require('../lib/content/personas/topologyDefinitions');
      const topo = TOPOLOGY_REQUIRED[persona];
      
      for (const nodeType of topo.nodes) {
        mockOutput[nodeType] = { claim: `Claim for ${nodeType}`, evidence: `Evidence for ${nodeType}` };
      }

      // 2. Compile it
      const graph = compilePlannerOutputToGraph(mockOutput, persona);

      // 3. Verify graph structure
      assert.equal(graph.nodes.length, topo.nodes.length, 'Node count should match');
      assert.equal(graph.edges.length, topo.edges.length, 'Edge count should match');

      // 4. Validate using the deterministic topology validator
      const validation = checkTopology(graph, persona);
      assert.equal(validation.compliant, true, `Compiled graph for ${persona} must pass topology validator`);
      assert.equal(validation.missing_required_nodes.length, 0);
      assert.equal(validation.missing_required_edges.length, 0);
      assert.equal(validation.forbidden_nodes_found.length, 0);
      // Because the compiler generates the *exact* relation labels, equivalence shouldn't even be needed
      assert.equal(validation.equivalence_match_count, 0, 'Compiled graph should use exact relation labels');
    });
  }

  test('Compiler throws clear error if required semantic node is missing', () => {
    const mockOutput = {
      system: { claim: 'C', evidence: 'E' },
      constraint: { claim: 'C', evidence: 'E' },
      mechanism: { claim: 'C', evidence: 'E' },
      // intervention is missing
      consequence: { claim: 'C', evidence: 'E' },
    };

    assert.throws(
      () => compilePlannerOutputToGraph(mockOutput, 'developer'),
      /Missing or invalid semantic content for required node: intervention/
    );
  });
  
  test('Compiler throws clear error if claim is not a string', () => {
    const mockOutput = {
      system: { claim: 'C', evidence: 'E' },
      constraint: { claim: 'C', evidence: 'E' },
      mechanism: { claim: 'C', evidence: 'E' },
      intervention: { claim: null as any, evidence: 'E' },
      consequence: { claim: 'C', evidence: 'E' },
    };

    assert.throws(
      () => compilePlannerOutputToGraph(mockOutput, 'developer'),
      /Missing or invalid semantic content for required node: intervention/
    );
  });
});
