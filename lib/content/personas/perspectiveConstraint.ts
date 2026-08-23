import { PersonaId } from "../../evaluation/types";

export function buildPerspectiveConstraint(personaId: PersonaId): string {
  let primaryModel = "";
  let causalModel = "";
  let requiredReasoning = "";
  let antiSubstitution = "";

  switch (personaId) {
    case "developer":
      primaryModel = "Treat the topic as a system of interacting components.";
      causalModel = "SYSTEM → CONSTRAINT → BOTTLENECK → MECHANISM → INTERVENTION → CONSEQUENCE";
      requiredReasoning = `
    1. Identify a concrete system or process.
    2. Locate a constraint, bottleneck, or failure point.
    3. Explain the mechanism connecting that constraint to the outcome.
    4. Propose an intervention that changes the mechanism.
    5. Connect the intervention to an observable consequence.`;
      antiSubstitution = `
    A technical metaphor does NOT count as structural reasoning.
    Words such as "system", "input", "output", "bug", "pipeline", or "engineering" are insufficient evidence.
    The causal explanation itself must depend on a structural constraint or bottleneck.
    If these terms are removed, the underlying causal argument must still remain structurally different from a psychological explanation.
    Do not explain the problem primarily through motives, emotions, self-perception, or interpersonal psychology.`;
      break;

    case "psychology":
      primaryModel = "Treat the topic as a manifestation of internal human needs, defense mechanisms, and emotional payoffs.";
      causalModel = "TRIGGER → MOTIVE/NEED → BEHAVIOR → REINFORCEMENT → AWARENESS SHIFT";
      requiredReasoning = `
    1. Identify an external trigger or event.
    2. Uncover the hidden motive, defense mechanism, or emotional need driving the reaction.
    3. Explain the observable behavior resulting from this motive.
    4. Identify the immediate emotional payoff (reinforcement) that sustains the behavior.
    5. Produce a shift in internal self-awareness.`;
      antiSubstitution = `
    Emotional vocabulary (e.g., "fear", "anxiety", "dopamine", "trauma") does NOT count as structural reasoning.
    Naming an emotion is not the same as explaining the mechanism behind it.
    The causal explanation must depend on internal reinforcement loops and emotional payoffs.
    If these emotion words are removed, the underlying causal argument must still remain structurally different from a systemic/engineering explanation.
    Do not explain the problem primarily through mechanical systems or logical optimization rules.`;
      break;

    case "intellectual":
      primaryModel = "Treat the topic as a dialectic process resolving underlying paradoxes or flawed assumptions.";
      causalModel = "ASSUMPTION → TENSION/CONTRADICTION → CHALLENGE → REFRAMING → SYNTHESIS";
      requiredReasoning = `
    1. Identify a common assumption or premise.
    2. Reveal the inherent tension or contradiction within it.
    3. Challenge the premise causally.
    4. Reframe the problem from a fundamentally different angle.
    5. Synthesize a new, deeper understanding.`;
      antiSubstitution = `
    Academic jargon or complex vocabulary does NOT count as structural reasoning.
    The causal explanation must depend on resolving a genuine logical tension or contradiction.
    Do not just offer a contrarian opinion; you must expose the structural flaw in the original assumption.
    If the academic terms are removed, the underlying argument must still pivot on resolving a contradiction.`;
      break;

    case "creative":
      primaryModel = "Treat the topic as a canvas for unexpected associations that reframe the ordinary into the profound.";
      causalModel = "ORDINARY OBSERVATION → UNEXPECTED ASSOCIATION → TENSION → TRANSFORMATION → ECHO";
      requiredReasoning = `
    1. Start with an ordinary observation of the topic.
    2. Introduce an unexpected association or metaphor.
    3. Build tension between the literal and the metaphorical.
    4. Transform the reader's understanding of the topic through this associative leap.
    5. Leave a lingering conceptual or emotional echo.`;
      antiSubstitution = `
    Poetic words or flowery language do NOT count as structural reasoning.
    The metaphor must NOT be merely decorative; the associative leap itself must causally change the interpretation of the topic.
    If the metaphor is removed, the argument should collapse, proving the metaphor was the structural load-bearing pillar, not just a wrapper.`;
      break;
  }

  if (!primaryModel) return "";

  return `
<reasoning_contract>
  <primary_model>
    ${primaryModel.trim()}
  </primary_model>

  <causal_model>
    ${causalModel.trim()}
  </causal_model>

  <required_reasoning>
    ${requiredReasoning.trim()}
  </required_reasoning>

  <evidence_requirement>
    Each required reasoning component must contribute causally to the conclusion.
    Naming a component without using it in the argument does not satisfy the contract.
    The argument must instantiate the causal model. It does not need to expose or label every node explicitly.
    A node counts only when it materially changes the reasoning and contributes to the conclusion.
  </evidence_requirement>

  <anti_substitution>
    ${antiSubstitution.trim()}
  </anti_substitution>

  <execution_rules>
    The argument is considered invalid unless it satisfies this reasoning contract naturally.
    Do not expose the reasoning contract, node labels, or internal thinking steps in the final output.
    Satisfy the causal requirements seamlessly within the prose.
  </execution_rules>
</reasoning_contract>
`.trim();
}
