/**
 * Perspective Constraint Layer — Sprint 3D.3
 *
 * Each persona has a CAUSAL MODEL: a fixed sequence of reasoning steps that
 * must shape the argument structure of the output. These are not vocabulary
 * rules. They are structural constraints on HOW the argument is built.
 *
 * The model is instructed to write the RESULT of traversing the causal model,
 * not to display the traversal itself.
 */

// ─── Causal Model Definitions ────────────────────────────────────────────────

/**
 * Developer / Systems Thinker
 * The world is a system. Problems are bottlenecks. Solutions are structural.
 */
const DEVELOPER_PERSPECTIVE = `<perspective_constraint>
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

/**
 * Psychology / Behavioral Analyst
 * Behavior has hidden drivers. The gap between intent and action is the evidence.
 */
const PSYCHOLOGY_PERSPECTIVE = `<perspective_constraint>
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

/**
 * Intellectual / Dialectical Thinker
 * Assumptions hide the truth. Paradoxes reveal it. Synthesis transcends the conflict.
 */
const INTELLECTUAL_PERSPECTIVE = `<perspective_constraint>
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

/**
 * Creative / Associative Thinker
 * The unexpected angle is the entry point. Emotional resonance is the destination.
 */
const CREATIVE_PERSPECTIVE = `<perspective_constraint>
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

// ─── Map & Accessor ──────────────────────────────────────────────────────────

const PERSPECTIVE_CONSTRAINTS: Record<string, string> = {
  developer:    DEVELOPER_PERSPECTIVE,
  psychology:   PSYCHOLOGY_PERSPECTIVE,
  intellectual: INTELLECTUAL_PERSPECTIVE,
  creative:     CREATIVE_PERSPECTIVE,
};

/**
 * Returns the XML perspective constraint block for a given persona ID.
 * Returns an empty string for unknown personas (graceful degradation —
 * no breakage if a new persona is added before its constraint is defined).
 */
export function buildPerspectiveConstraint(personaId: string): string {
  return PERSPECTIVE_CONSTRAINTS[personaId] ?? "";
}
