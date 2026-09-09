import { resolveTopology } from "../../content/personas/topologyDefinitions.ts";
import { buildSemanticPlannerConstraints } from "../../content/personas/semanticConstraints.ts";
import type { NormalizedPlannerRequest } from "../types.ts";
import type { PersonaId } from "../../evaluation/types.ts";

// ---------------------------------------------------------------------------
// Platform defaults — mirrored from rendererPrompt so the planner knows
// the effective character budget before it writes node content.
// ---------------------------------------------------------------------------
const PLATFORM_MAX_LENGTHS: Record<string, number> = {
  x: 280,
  instagram: 2200,
  facebook: 1500,
  linkedin: 2800,
};

// ---------------------------------------------------------------------------
// Objective → Message strategy — shapes WHAT goes into the content,
// not just the CTA. This is the top of the hierarchy.
// ---------------------------------------------------------------------------
const OBJECTIVE_MESSAGE_STRATEGY: Record<string, string> = {
  awareness: `MESSAGE STRATEGY — Awareness:
- Primary goal: make the audience aware something exists or shift their perspective.
- The message must plant a clear idea, not sell a product.
- Do NOT write a sales pitch. Do NOT list product features.
- End with curiosity or an open question.`,

  engagement: `MESSAGE STRATEGY — Engagement:
- Primary goal: provoke a reaction, opinion, or personal story from the reader.
- The message must contain a genuine tension or relatable situation.
- Do NOT end with a generic "share your thoughts". Ask something specific.
- The content should make the reader feel seen or challenged.`,

  leads: `MESSAGE STRATEGY — Lead Generation:
- Primary goal: give enough value that the reader wants to take one low-risk step.
- Highlight ONE clear problem and ONE credible solution.
- Do NOT oversell. Build trust first, then invite action.`,

  sales: `MESSAGE STRATEGY — Sales:
- Primary goal: convince the reader to buy or commit now.
- Lead with the benefit, not the feature. Show the transformation, not the tool.
- Address the main objection proactively.
- The CTA must be specific and immediate.`,

  traffic: `MESSAGE STRATEGY — Traffic:
- Primary goal: give a clear, specific reason to click.
- The content teases value without fully delivering it.
- The CTA must answer: "What will I find when I click?"`,

  community: `MESSAGE STRATEGY — Community Building:
- Primary goal: build belonging and shared identity.
- Write as an insider talking to insiders, not a brand talking to customers.
- The CTA invites participation, not consumption.`,

  education: `MESSAGE STRATEGY — Education:
- Primary goal: teach one concrete, actionable insight.
- Structure: Problem or misconception → Why it matters → The correct understanding.
- Do NOT oversimplify. The reader should learn something genuinely useful.`,

  messages: `MESSAGE STRATEGY — Direct Messages:
- Primary goal: make the reader feel comfortable reaching out.
- Warm, low-pressure tone. No urgency tactics.
- The CTA is an open door, not a hard push.`,

  retention: `MESSAGE STRATEGY — Retention:
- Primary goal: reinforce the reader's existing decision and deepen loyalty.
- Acknowledge their experience. Celebrate their progress.
- Offer exclusive value, not generic promotions.`,

  app_installs: `MESSAGE STRATEGY — App Installs:
- Primary goal: remove friction from the download decision.
- State the one core value proposition clearly.
- Address the biggest hesitation. Make "try it" feel risk-free.`,
};

export function buildPlannerPrompt(request: NormalizedPlannerRequest): string {
  const { topic, platform, objective, language, audience, constraints } = request;
  const persona = request.persona as PersonaId;

  // Resolve effective max length so the planner writes nodes
  // proportionally to the available budget.
  const platformKey = platform.toLowerCase();
  const effectiveMaxLength = constraints?.maxLength ?? PLATFORM_MAX_LENGTHS[platformKey];

  // Resolve mode variant: compact only for intellectual persona on tight-budget platforms.
  const forcedMode = constraints?.forcedIntellectualMode;
  const forcedVariant = constraints?.forcedIntellectualModeVariant;
  const modeVariant: "standard" | "compact" =
    forcedVariant ??
    (persona === "intellectual" && effectiveMaxLength && effectiveMaxLength <= 280
      ? "compact"
      : "standard");

  // Resolve topology: uses compact 2-node version for intellectual/compact/forced mode,
  // falls back to standard 5-node topology for everything else.
  const resolvedTopology = resolveTopology(persona, modeVariant, forcedMode);
  const topologyNodes = resolvedTopology.nodes;
  const semanticConstraints = buildSemanticPlannerConstraints(persona, topic, modeVariant, forcedMode);

  const messageStrategy = OBJECTIVE_MESSAGE_STRATEGY[objective]
    ? `\n[OBJECTIVE MESSAGE STRATEGY — READ BEFORE WRITING]\n${OBJECTIVE_MESSAGE_STRATEGY[objective]}\n`
    : "";

  const basePrompt = `
You are a master Causal Planner. Your ONLY job is to generate the semantic content for a strict graph topology.
You MUST output valid JSON only. NO markdown blocks, NO explanations.

[SYSTEM RULES — CRITICAL]
1. DO NOT INVENT EDGES. The topology is fixed. You are only generating the content for the nodes.
2. DO NOT ADD EXTRA NODES. You must generate exactly the nodes listed below, and nothing else.
3. OUTPUT FORMAT:
{
  "nodes": [
    { "id": "node_id_1", "content": "..." },
    { "id": "node_id_2", "content": "..." }
  ]
}
${messageStrategy}
[INPUT CONTEXT]
Topic: ${topic}
Platform: ${platform}
Objective: ${objective}
Language: ${language}
${audience ? `Audience: ${audience}` : ""}

[EFFECTIVE LENGTH BUDGET]
${effectiveMaxLength
  ? `The final rendered output (all fields combined) must not exceed ${effectiveMaxLength} characters. Write node content proportionally — keep each node tight. The renderer will combine all nodes into a single post.`
  : "No length constraint. Write for platform-appropriate depth."}

[USER CONSTRAINTS]
${constraints?.forbiddenTerms?.length ? `- Forbidden terms: ${constraints.forbiddenTerms.join(", ")}` : ""}
${constraints?.requiredTerms?.length ? `- Required terms: ${constraints.requiredTerms.join(", ")}` : ""}
${constraints?.customInstructions ? `- Custom instructions: ${constraints.customInstructions}` : ""}

[REQUIRED TOPOLOGY NODES]
You must generate exactly these node IDs:
${topologyNodes.map((node: string) => `- ${node}`).join("\n")}

[PERSONA CONSTRAINTS & NODE CONTRACTS]
${semanticConstraints}
`;

  return basePrompt.trim();
}
