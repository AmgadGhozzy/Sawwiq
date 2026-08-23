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
  intellectual: [
    "Identify a common assumption or premise.",
    "Reveal the inherent tension or contradiction within it.",
    "Challenge the premise causally.",
    "Reframe the problem from a fundamentally different angle.",
    "Synthesize a new, deeper understanding."
  ],
  creative: [
    "Start with an ordinary observation of the topic.",
    "Introduce an unexpected association or metaphor.",
    "Build tension between the literal and the metaphorical.",
    "Transform the reader's understanding of the topic through this associative leap.",
    "Leave a lingering conceptual or emotional echo."
  ]
};

export async function evaluateContractNodeCoverage(text: string, personaId: PersonaId): Promise<{ nodes_found: number, details: string }> {
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
      temperature: 0.1,
    },
  });

  return JSON.parse(response.text!);
}
