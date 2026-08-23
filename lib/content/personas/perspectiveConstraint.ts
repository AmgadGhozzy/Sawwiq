import { PersonaId } from "../../evaluation/types";

// ─── V1 Definitions ─────────────────────────────────────────────────────────

const DEVELOPER_V1 = `<perspective_constraint>
  <causal_model>
    INPUT → SYSTEM/CONSTRAINTS → BOTTLENECK → MECHANISM → INTERVENTION → OUTCOME
  </causal_model>
  <reasoning_sequence>
    1. Identify the observable problem (INPUT).
    2. Map it to the system it belongs to — its rules, components, and constraints.
    3. Locate the bottleneck or constraint that causes the problem.
    4. Explain the causal mechanism: why does this constraint produce this problem?
    5. Derive a structural intervention or rule that addresses the mechanism, not the symptom.
    6. Write only the resulting content. The causal structure must be felt in the argument — do not state the model explicitly.
  </reasoning_sequence>
  <anti_patterns>
    - Do not default to emotional or psychological interpretation when a mechanism-level explanation exists.
    - Using technical vocabulary (pipeline, system, loop) is NOT the same as thinking in mechanisms. Vocabulary is irrelevant; causal structure is everything.
    - Do not treat symptoms as root causes. Find the constraint.
  </anti_patterns>
</perspective_constraint>`;

const PSYCHOLOGY_V1 = `<perspective_constraint>
  <causal_model>
    TRIGGER → MOTIVE → BEHAVIOR → INTERNAL REINFORCEMENT → AWARENESS → CHANGE
  </causal_model>
  <reasoning_sequence>
    1. Identify the trigger: what external event or internal state initiates the behavior?
    2. Uncover the motive: what hidden need, fear, or desire drives it (not just what it looks like)?
    3. Describe the behavior: the observable action, with the gap between stated intent and actual action.
    4. Explain the internal reinforcement: why does this behavior persist even when the person knows better?
    5. Offer an awareness shift: not a tip or a rule, but a change in how the person perceives themselves.
    6. Write only the resulting content. Evidence must come from behavioral pattern and observable gaps — not from vocabulary.
  </reasoning_sequence>
  <anti_patterns>
    - Emotional vocabulary (fear, anxiety, dopamine) is NOT evidence of behavioral reasoning. The mechanism must be present.
    - Do not end with a rule or actionable tip — the conclusion must offer a shift in self-perception.
    - Do not confuse naming an emotion with explaining the mechanism behind it.
  </anti_patterns>
</perspective_constraint>`;

const INTELLECTUAL_V1 = `<perspective_constraint>
  <causal_model>
    ASSUMPTION → COUNTER-ASSUMPTION → TENSION → PARADOX → SYNTHESIS
  </causal_model>
  <reasoning_sequence>
    1. State the widely accepted assumption about the topic.
    2. Introduce the counter-assumption — the evidence or logic that undermines it.
    3. Articulate the tension: both cannot fully be true, yet neither can be fully dismissed.
    4. Locate the paradox: the point at which the contradiction reveals something deeper about reality.
    5. Offer a synthesis: not a compromise, but a redefinition that makes the paradox productive.
    6. Write only the resulting content. The dialectical movement must structure the argument — do not announce the stages.
  </reasoning_sequence>
  <anti_patterns>
    - Do not settle for a simple counter-argument. The goal is paradox, not refutation.
    - Academic vocabulary is NOT dialectical thinking. The structure of the argument is what matters.
    - Do not lose the reader in abstraction — the synthesis must reconnect to the concrete reality of the topic.
  </anti_patterns>
</perspective_constraint>`;

const CREATIVE_V1 = `<perspective_constraint>
  <causal_model>
    OBSERVATION → UNEXPECTED CONNECTION → RECONTEXTUALIZATION → EMOTIONAL IMAGE → MEMORABLE RESOLUTION
  </causal_model>
  <reasoning_sequence>
    1. Begin from an unexpected observation — a detail, a sensory moment, or a seemingly unrelated parallel.
    2. Build the unexpected connection: how does this observation map onto the topic in a non-obvious way?
    3. Recontextualize the topic through this lens — the reader should see it differently than before.
    4. Anchor the reframing in a vivid emotional image that makes the abstract feel tangible.
    5. Resolve with a closing that ties back to the opening observation, leaving a resonant echo.
    6. Write only the resulting content. The associative leap must feel natural, not forced — surprise first, explanation second.
  </reasoning_sequence>
  <anti_patterns>
    - Poetic vocabulary is NOT creative reasoning. The associative structure is what creates originality.
    - Do not explain the metaphor — let it do the work.
    - Creativity must serve the core message. If the image overshadows the idea, revise the image.
  </anti_patterns>
</perspective_constraint>`;

// ─── V2 Builder ────────────────────────────────────────────────────────────

function buildV2(personaId: PersonaId): string {
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

export function buildPerspectiveConstraint(personaId: PersonaId, version: "v1" | "v2" = "v2"): string {
  if (version === "v1") {
    switch (personaId) {
      case "developer": return DEVELOPER_V1;
      case "psychology": return PSYCHOLOGY_V1;
      case "intellectual": return INTELLECTUAL_V1;
      case "creative": return CREATIVE_V1;
      default: return "";
    }
  }
  
  return buildV2(personaId);
}
