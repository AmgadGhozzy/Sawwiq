/**
 * Shared persona context for the IR Purity Evaluator.
 *
 * Purpose: Teach the evaluator that contamination is a framing/reasoning-mode
 * signal, NOT a vocabulary signal. Domain terminology that legitimately appears
 * in another discipline is not evidence of persona leakage.
 *
 * Used by evalIRPurity() in EXP-015-production-gate.ts,
 * EXP-015-targeted.ts, EXP-015-c005-rerun.ts, and EXP-015-c007-rerun.ts.
 */

export const PURITY_EVALUATOR_CONTEXT: Record<string, string> = {
  intellectual: `INTELLECTUAL persona: Epistemological, philosophical, assumption-challenging.
Node types: assumption -> contradiction -> why_fails -> reframe -> synthesis.
Topology is compiler-guaranteed. Evaluate semantic framing only.

INTELLECTUAL may legitimately use cognitive concepts, social systems,
economic mechanisms, behavioral examples, and psychological phenomena
as objects of philosophical or epistemological analysis.

CONTAMINATION means the reasoning becomes:
- prescriptive or recommendation-oriented
- self-help or optimization guidance
- primarily behavioral intervention
- emotionally therapeutic rather than conceptually analytical
- systems engineering rather than philosophical analysis

Do NOT classify psychological subject matter as contamination merely because
the topic concerns behavior, emotion, motivation, or procrastination.

The critical distinction is FRAMING MODE, not DOMAIN VOCABULARY.
A psychological phenomenon can be analyzed intellectually when the reasoning
questions its assumptions, categories, normative foundations, concept of agency,
or epistemological status.`,

  developer: `DEVELOPER persona: Systems-oriented, mechanistic, causal.
Canonical node types: system -> constraint -> mechanism -> intervention -> consequence.
Topology is compiler-guaranteed. Evaluate semantic framing only.

Legitimate vocabulary may include cognitive load, task initiation,
threat response, uncertainty, friction, behavioral mechanisms,
feedback loops, and other domain-specific terminology when used
to explain systems causally.

IMPORTANT:
Domain vocabulary is NOT evidence of contamination.

Contamination means adopting another persona's characteristic
reasoning mode:
- Psychology: hidden emotional motives, subconscious drives,
  therapeutic realization, or primarily emotional interpretation.
- Creative: metaphorical imagery, aesthetic tension, sensory scene-setting.
- Intellectual: epistemological deconstruction, assumption-challenging,
  paradigm reframing.

Judge framing and causal logic, not isolated words.`,

  psychology: `PSYCHOLOGY persona: Motivational, behavioral, emotionally-driven.
Canonical node types: trigger -> motive -> behavior -> reinforcement -> shift.
Topology is compiler-guaranteed. Evaluate semantic framing only.

Legitimate vocabulary may include systems language, cognitive terminology,
and social context when these explain behavioral or emotional patterns.

Contamination means the reasoning becomes purely philosophical/intellectual,
systematic engineering without an internal behavioral/emotional driver,
or metaphorical/creative without psychological framing.`,

  creative: `CREATIVE persona: Sensory, metaphorical, aesthetically-driven.
Canonical node types: scene -> association -> tension -> transformation -> return_to_scene.
Topology is compiler-guaranteed. Evaluate semantic framing only.

Legitimate vocabulary may include emotional language, psychological tension,
and abstract concepts when grounded in sensory or metaphorical framing.

Contamination means the reasoning becomes primarily systematic/engineering,
prescriptive/behavioral, or purely philosophical.`,
};

/** Fallback for unknown personas - conservative, non-blocking. */
export const PURITY_EVALUATOR_FALLBACK =
  `No persona-specific context available. Evaluate framing conservatively.\n` +
  `Domain vocabulary is NOT evidence of contamination.\n` +
  `Judge reasoning mode and causal logic.`;

/**
 * Shared PurityResult type matching IR_PURITY_SCHEMA.
 * Preserves the existing 4-leakage-field schema used across EXP-011 through EXP-015.
 */
export type PurityResult = {
  structural_purity: number;
  developer_leakage: number;
  psychology_leakage: number;
  creative_leakage: number;
  overall_purity: number;
};
