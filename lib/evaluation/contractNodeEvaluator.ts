import { GoogleGenAI, Type } from "@google/genai";
import { nextEvalModel } from "./modelPool";
import type { PersonaId } from "./types";
import path from "path";
import { config } from "dotenv";
config({ path: path.join(process.cwd(), ".env.local") });

const ai = new GoogleGenAI({
  vertexai: true,
  apiKey: process.env.VERTEX_AI_API_KEY,
});

const NODE_COVERAGE_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    nodes_found: { type: Type.NUMBER, description: "Number of required nodes found in the text (0 to 5)." },
    details: { type: Type.STRING, description: "Brief justification for which nodes were found and which were missing." }
  },
  required: ["nodes_found", "details"]
};

const PERSONA_NODES: Record<PersonaId, string[]> = {
  developer: [
    "Identify a concrete system or process.",
    "Locate a constraint, bottleneck, or failure point.",
    "Explain the mechanism connecting that constraint to the outcome.",
    "Propose an intervention that changes the mechanism.",
    "Connect the intervention to an observable consequence."
  ],
  psychology: [
    "Identify an external trigger or event.",
    "Uncover the hidden motive, defense mechanism, or emotional need driving the reaction.",
    "Explain the observable behavior resulting from this motive.",
    "Identify the immediate emotional payoff (reinforcement) that sustains the behavior.",
    "Produce a shift in internal self-awareness."
  ],
  // EXP-014 I1: Nodes test *semantic function*, not mere structural presence.
  // A node is ONLY fulfilled if it performs its epistemic role, not if it
  // contains vocabulary that hints at it.
  intellectual: [
    // Node 1 — assumption: Must identify a belief that is widely held AND contestable.
    // FAIL: 'There are challenges in decision-making.' PASS: 'We assume good decisions minimize uncertainty.'
    "Identify a specific, widely-held premise that is presented as self-evident but is historically contingent or internally inconsistent.",
    // Node 2 — contradiction: Must demolish the epistemic frame, not find an execution flaw.
    // FAIL: 'The approach has drawbacks.' PASS: 'This belief collapses when we observe X, which it was supposed to explain.'
    "Expose an internal inconsistency or historical counter-evidence that invalidates the premise at the level of its foundational logic — not just its application.",
    // Node 3 — why_fails: Must indict the frame, not the approach.
    // FAIL: 'A better method would be...' PASS: 'The frame cannot explain phenomenon Y because it presupposes Z, which Y contradicts.'
    "Explain why the original cognitive frame is epistemically insufficient: it cannot account for observable phenomena because it presupposes the very thing it claims to explain.",
    // Node 4 — reframe: Must answer 'what is the right question?' not 'what is the better solution?'
    // FAIL: 'We should focus on X instead of Y.' PASS: 'The question is not X but rather whether Y is a coherent concept at all.'
    "Reformulate the original question as a category error or linguistic trap, revealing that the question itself could not have had a satisfying answer within the original frame.",
    // Node 5 — synthesis: Must redefine the concept, not recommend action.
    // FAIL: 'Therefore, the key is to adopt a more systematic approach.'
    // PASS: 'The phenomenon is not a failure of execution but a structural property of the system that makes failure inevitable.'
    "Produce a redefinition of the original concept or phenomenon that makes the original question obsolete — NOT a recommendation, call to action, or behavioral prescription.",
  ],
  creative: [
    "Start with an ordinary observation of the topic.",
    "Introduce an unexpected association or metaphor.",
    "Build tension between the literal and the metaphorical.",
    "Transform the reader's understanding of the topic through this associative leap.",
    "Leave a lingering conceptual or emotional echo."
  ]
};

export async function evaluateContractNodeCoverage(text: string, personaId: PersonaId, configOverrides?: Record<string, any>): Promise<{ nodes_found: number, details: string }> {
  const nodes = PERSONA_NODES[personaId];
  if (!nodes) return { nodes_found: 0, details: "Unknown persona" };

  const systemPrompt = `
You are a structural reasoning evaluator. Your task is to determine how many of the required causal nodes are present in the given text.

REQUIRED NODES FOR THIS PERSONA:
${nodes.map((n, i) => `${i + 1}. ${n}`).join("\n")}

Rule: A node is only considered present if it structurally drives the argument, not if it's merely hinted at via a single word.
Count how many of the 5 nodes are fulfilled (0 to 5). Provide a brief detail.
  `.trim();

  const userPrompt = `
<text>
${text}
</text>
  `.trim();

  const response = await ai.models.generateContent({
    model: nextEvalModel(),
    contents: userPrompt,
    config: {
      systemInstruction: systemPrompt,
      responseMimeType: "application/json",
      responseSchema: NODE_COVERAGE_SCHEMA,
      temperature: configOverrides?.temperature ?? 0.1,
    },
  });

  return JSON.parse(response.text!);
}
