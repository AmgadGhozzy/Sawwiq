import { PersonaId } from "../../evaluation/types";

// ─── EXP-015: Semantic Planner Constraints ────────────────────────────────────
//
// Option B refactor: the planner is no longer asked to generate graph edges.
// Edges are compiled deterministically from TOPOLOGY_REQUIRED.
// The planner only generates semantic content for each required node.
//
// This file focuses on:
//   1. Semantic contracts for each node (what does it *mean*)
//   2. Anti-contamination rules (especially Intellectual C003/C007)
//   3. Negative examples (observed failure modes)
// ─────────────────────────────────────────────────────────────────────────────

const NEGATIVE_EXAMPLES: Record<PersonaId, string> = {
  developer: `
AVOID THESE CONCEPTUAL FAILURES:

- Do not mistake the intervention for the mechanism. The mechanism is WHY the constraint causes the problem.
- Do not let the intervention target the consequence directly. It must target the mechanism.
- The consequence must be a direct result of the intervention, not an aspirational goal.`,

  intellectual: `
AVOID THESE CONCEPTUAL FAILURES:

- Do not skip the "why_fails" stage. You must explain why the contradiction breaks the original framing before introducing a reframe.
- The reframe must logically emerge from the failure of the old paradigm.`,

  psychology: `
AVOID THESE CONCEPTUAL FAILURES:

- Do not skip the hidden motive. The behavior is always driven by a hidden emotional need.
- The shift must be an internal realization about the reinforcement, not an external behavioral fix.`,

  creative: `
AVOID THESE CONCEPTUAL FAILURES:

- The association must be a metaphor derived from the scene, not just an abstract idea.
- The transformation must resolve the tension aesthetically, not practically.`,
};

const INTELLECTUAL_REFRAME_RULE = `
INTELLECTUAL REFRAME RULE

The reframe must change the conceptual interpretation of the problem.

It MUST NOT:
- ask how to solve the problem
- ask what the reader should do
- ask how to optimize an outcome
- ask how to improve performance
- ask how to manage emotions
- identify a best practice
- identify an optimal strategy
- imply an intervention

BAD reframe examples:
"كيف يمكن تحديد السعر المناسب؟"
"How can someone manage their emotions around pricing?"
"What should someone do to overcome procrastination?"

GOOD reframe examples:
"لماذا نفترض أصلاً أن التسويف يمثل نقصاً في الانضباط؟"
"What assumption about procrastination is challenged by treating it as an emotional response rather than a failure of discipline?"`;

const INTELLECTUAL_SYNTHESIS_RULE = `
SYNTHESIS RULE

The synthesis must answer: "What does this reframe reveal conceptually?"
It must NOT answer: "What should someone do?"

ALLOWED synthesis:
"The reframing reveals that procrastination can be interpreted through competing models of agency and emotional avoidance."

FORBIDDEN synthesis content:
- imperatives, recommendations, action steps, optimization advice
- behavioral prescriptions or therapeutic guidance
- "should", "must", "need to" statements directed at the reader
- "One should...", "The solution is...", "This requires..."`;

export function buildSemanticPlannerConstraints(personaId: PersonaId): string {
  const negativeExamples = NEGATIVE_EXAMPLES[personaId] ?? '';

  switch (personaId) {
    case "intellectual":
      return `
[INTELLECTUAL SEMANTIC PLANNER — EXP-015 / I1]

INTELLECTUAL BOUNDARY — DO NOT:
- prescribe behavior or recommend interventions
- provide self-help instructions or tell the reader what they should do
- frame emotional regulation as a solution
- produce a problem -> intervention -> outcome chain

Node semantic contracts:

[assumption]
  MUST: Identify a widely held, domain-specific belief that is taken as self-evident
        but is in fact historically contingent or epistemically fragile.
  MUST: The assumption must be contestable — not merely "there are challenges in X",
        but something like "we assume that X is a symptom of Y, not a category error."

[contradiction]
  MUST: Demolish the assumption's epistemic foundation — not expose a flaw in its
        execution or application.
  MUST: The demolition must come from within the assumption's own logic (internal
        inconsistency) or from historical evidence that the assumption's premise
        was never true.

[why_fails]
  MUST: Explain why the cognitive *frame* — not the approach — is insufficient.
  MUST: Follow this causal chain:
          wrong epistemic frame → cannot explain observable phenomenon → confusion persists

[reframe]
  MUST: Redefine the QUESTION itself.
  MUST: Expose a limitation in the original framing.
  MUST NOT: Answer the newly reframed question with an intervention.

  PSYCHOLOGY-ADJACENT TOPICS — MANDATORY DOMAIN SHIFT:
  When the topic concerns motivation, procrastination, habits, emotions,
  behavior, relationships, self-control, or similar psychology-adjacent
  subjects, the reframe MUST NOT explain the topic through psychological
  mechanisms (e.g., emotional states, coping, avoidance, regulation).

  Instead, shift the question to a different conceptual domain:
  - Philosophy of agency: What conception of the self or agency does the
    concept presuppose?
  - Epistemology: What assumptions make this concept an acceptable explanation?
  - Sociology of knowledge: How did this phenomenon become categorized or
    understood in this particular way?
  - Philosophy of time or normativity: What assumptions about time,
    productivity, obligation, or value does the concept presuppose?

  BAD (stays in psychology):
  "How does emotional state affect procrastination?"
  "Why do people avoid difficult tasks?"
  "What psychological mechanism causes procrastination?"

  GOOD (shifts the conceptual domain):
  "What conception of human agency does the category 'procrastination' presuppose?"
  "What normative assumptions about productive use of time are embedded in the
   concept of procrastination?"
  "What model of the self is assumed when procrastination is described as personal failure?"

  The reframe MUST change the conceptual question, not merely replace one
  psychological explanation with another.

[synthesis]
  MUST: State the conceptual/paradigmatic implication of the reframe.
  MUST: Be descriptive or philosophical, never prescriptive.
  MUST NOT: End with advice, action steps, or "how to".

  FOR PSYCHOLOGY-ADJACENT TOPICS — PRESERVE THE DOMAIN SHIFT:
  The synthesis MUST remain in the conceptual domain established by the reframe.
  It must explain what the reframing reveals about agency, knowledge,
  normativity, categorization, or time — not about emotional states or
  psychological mechanisms.

  DO NOT return to: emotional states, coping mechanisms, behavioral causes,
  motivation, psychological intervention, or therapeutic insight.

TEST:
If the synthesis could naturally be preceded by "To solve this, you should..."
then it is probably contaminated.
${negativeExamples}
${INTELLECTUAL_REFRAME_RULE}
${INTELLECTUAL_SYNTHESIS_RULE}
`.trim();

    case "creative":
      return `
[CREATIVE SEMANTIC PLANNER]

Node semantic contracts:

[scene]           A specific, physical, sensory anchor. FORBIDDEN: abstract setups.
[association]     An unexpected metaphorical leap — not an analogy, a genuine collision.
[tension]         Aesthetic or emotional tension. FORBIDDEN: problem statements or complaints.
[transformation]  The insight delivered through image or action. FORBIDDEN: prescription/fix.
[return_to_scene] A true atmospheric echo of [scene]. FORBIDDEN: moralizing or summarizing.
${negativeExamples}
`.trim();

    case "developer":
      return `
[DEVELOPER SEMANTIC PLANNER]

CLAIM FORM:
Every claim MUST be a complete declarative proposition that expresses
a relationship, mechanism, condition, or consequence.

FORBIDDEN (noun phrases, labels):
- "Perceived task difficulty and uncertainty."
- "Task initiation."
- "The threat response."

REQUIRED (full causal assertion):
- "Perceived task difficulty and uncertainty increase the activation
  energy required to begin a task, creating a structural friction point."

Do NOT satisfy this requirement by adding filler words. Claims should remain
concise while expressing an actual proposition.

Node semantic contracts:

[system]       Identify a concrete system or process, not an abstract concept.
[constraint]   Locate the specific bottleneck or structural failure point.
[mechanism]    Explain the causal link: why this constraint produces this outcome.
[intervention] A structural change that targets the mechanism directly.
[consequence]  An observable, specific outcome of the intervention — not aspirational.

FORBIDDEN: Philosophical speculation. Emotional reasoning. Vague generalizations.
${negativeExamples}
`.trim();

    case "psychology":
      return `
[PSYCHOLOGY SEMANTIC PLANNER]

Node semantic contracts:

[trigger]       The external event or situation that activates the pattern.
[motive]        The hidden emotional need or defense mechanism driving the response.
[behavior]      The observable action or pattern that results.
[reinforcement] The payoff — why the pattern persists despite being suboptimal.
[shift]         An internal realization, NOT an external fix or behavioral prescription.

FORBIDDEN: Symptom-only analysis. Generic advice. "You should..." framing.
${negativeExamples}
`.trim();

    default:
      return "";
  }
}
