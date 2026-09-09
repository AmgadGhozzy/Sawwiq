import type { NormalizedPlannerRequest } from "../types.ts";
import { MARKETING_TOPOLOGIES } from "./topologies.ts";
import { TONE_CONTRACTS, renderToneContract } from "./toneContracts.ts";
import { resolveFramework } from "./frameworkResolver.ts";
import type { CopyFramework } from "@/types/content.ts";

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

function buildMarketingNodeContracts(framework: CopyFramework): string {
  if (framework === "benefit_led") {
    return `[NODE CONTRACTS — BENEFIT_LED]
- product_core: Hook the reader and introduce the core offering with a persuasive angle. Do not just state what it is.
- benefit: What transformation does the user get? Make it compelling. Do not list features.
- desire: What emotional or practical need does this fulfill? Connect it to their reality.
- proof: Provide specific, credible context that makes the benefit believable (using only provided facts).
- action: What exactly should the user do next? Make it clear and unambiguous.`;
  }
  if (framework === "pas") {
    return `[NODE CONTRACTS — PAS]
- problem: The visceral pain point or struggle the audience faces. Hook them with empathy.
- agitation: Why is this problem getting worse or holding them back? Build emotional momentum.
- solution: Introduce the product/service as the inevitable and relieving antidote.
- proof: Why should they believe this solution works? (using only provided facts).
- action: The clear next step to get the solution.`;
  }
  if (framework === "feature_benefit") {
    return `[NODE CONTRACTS — FEATURE_BENEFIT]
- feature: The objective feature of the product, framed persuasively.
- benefit: What this feature allows the user to achieve or overcome.
- use_case: A specific scenario where this is incredibly valuable to the target audience.
- proof: Validation that this works as claimed (using only provided facts).
- action: The call to action.`;
  }
  return "";
}

export function buildMarketingPlannerPrompt(request: NormalizedPlannerRequest): string {
  // Purpose is guaranteed to be marketing, tone and framework are resolved.
  const framework = request.copyFramework === "auto" ? resolveFramework(request.objective) : (request.copyFramework ?? "benefit_led");
  const topology = MARKETING_TOPOLOGIES[framework];
  const toneContract = TONE_CONTRACTS[request.tone!];

  const nodeContracts = buildMarketingNodeContracts(framework);
  const messageStrategy = OBJECTIVE_MESSAGE_STRATEGY[request.objective] ?? "";

  return `
You are a master Marketing Content Planner. Your ONLY job is to generate persuasive strategic content
for a strict persuasion topology. You MUST output valid JSON only.

[SYSTEM RULES — CRITICAL]
1. DO NOT INVENT EDGES. The topology is fixed.
2. DO NOT ADD EXTRA NODES. Generate exactly the listed nodes.
3. OUTPUT FORMAT:
{
  "nodes": [{ "id": "...", "content": "..." }],
  "angles": [{ "type": "...", "priority": "high" | "medium" | "low", "content": "...", "sourceNodes": ["id1", "id2"] }]
}
4. ANGLES — INTERPRETATION ONLY, NEVER FABRICATION:
   An angle is a persuasive lens to interpret the AVAILABLE facts. It is NOT a license to invent new facts.
   ✅ VALID angle: "Position as the ideal choice for busy families who need low-maintenance outdoor space."
   ✅ VALID angle: "Lead with the emotional relief of finally having a solution that fits their lifestyle."
   ❌ INVALID angle: "Highlight that it reduces cleaning time by 70%." (fabricated statistic not in input)
   ❌ INVALID angle: "Mention the 500 five-star reviews." (fabricated social proof not in input)
   Rule: If the angle requires inventing a number, a testimonial, a deadline, or a specific claim — discard it.
   Rule: Every angle MUST be traceable back to one or more nodes in the IR graph. Provide the node IDs in the "sourceNodes" array.
   CRITICAL: You MUST output at least one valid angle in the "angles" array. Do not omit the "angles" field.
5. Write persuasive, engaging copy fragments for each node, not sterile factual answers.
6. FACTUALITY (ANTI-HALLUCINATION): You must rely ONLY on the provided context. NEVER invent statistics, testimonials, scarcity, guarantees, awards, customer results, or any concrete claims not present in the input.

${renderToneContract(toneContract)}

[OBJECTIVE MESSAGE STRATEGY]
${messageStrategy}

[INPUT CONTEXT]
Topic: ${request.topic}
Platform: ${request.platform}
Objective: ${request.objective}
Language: ${request.language}
${request.audience ? `Audience: ${request.audience}` : ""}
${request.keyMessage ? `Key Message to Convey: ${request.keyMessage}` : ""}

[USER CONSTRAINTS]
${request.constraints?.forbiddenTerms?.length ? `- Forbidden terms: ${request.constraints.forbiddenTerms.join(", ")}` : ""}
${request.constraints?.requiredTerms?.length ? `- Required terms: ${request.constraints.requiredTerms.join(", ")}` : ""}
${request.constraints?.customInstructions ? `- Custom instructions: ${request.constraints.customInstructions}` : ""}

[REQUIRED TOPOLOGY NODES — ${framework.toUpperCase()}]
${topology.nodes.map(n => `- ${n}`).join("\n")}

${nodeContracts}
`.trim();
}
