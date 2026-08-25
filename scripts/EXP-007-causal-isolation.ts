import * as fs from "fs";
import * as path from "path";
import { config } from "dotenv";
config({ path: path.join(process.cwd(), ".env.local") });

import { evaluatePersona } from "../lib/evaluation/personaEvaluator";
import { evaluateReasoningSeparation } from "../lib/evaluation/reasoningSeparationEvaluator";
import { evaluateAblationWeighted } from "../lib/evaluation/ablationEvaluator";
import { buildSystemPrompt, buildUserPrompt } from "../lib/content/prompt/compiler";
import { GEMINI_RESPONSE_SCHEMA, InputDTO } from "../supabase/functions/generate/validation/schema";
import { getPersona } from "../lib/content/personas/registry";
import { GoogleGenAI } from "@google/genai";
import { PersonaId } from "../lib/evaluation/types";

const ai = new GoogleGenAI({
  vertexai: true,
  apiKey: process.env.VERTEX_AI_API_KEY,
});

async function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function extractFullText(jsonString: string): string {
  try {
    const parsed = JSON.parse(jsonString);
    return `${parsed.title}\n\n${parsed.hook}\n\n${parsed.body}\n\n${parsed.callToAction}`;
  } catch {
    return jsonString;
  }
}

async function generateContent(input: InputDTO): Promise<string> {
  const systemInstruction = buildSystemPrompt(input as any);
  const userPrompt = buildUserPrompt();

  let retries = 10;
  while (retries > 0) {
    try {
      const response = await ai.models.generateContent({
        model: "gemini-3.1-flash-lite",
        contents: userPrompt,
        config: {
          systemInstruction,
          responseMimeType: "application/json",
          responseSchema: GEMINI_RESPONSE_SCHEMA,
          temperature: 0.7,
        },
      });
      return response.text!;
    } catch (e: any) {
      if (e?.status === 429 && retries > 1) {
        console.log(`     [Rate Limit] 429 hit. Waiting 20s...`);
        await delay(20000);
        retries--;
      } else {
        throw e;
      }
    }
  }
  throw new Error("Max retries exceeded in generation");
}

const retryEval = async <T>(fn: () => Promise<T>): Promise<T> => {
  let retries = 10;
  while (retries > 0) {
    try { return await fn(); }
    catch (e: any) {
      if (e?.status === 429 && retries > 1) {
        console.log(`     [Rate Limit in Eval] 429 hit. Waiting 20 seconds before retry (${retries} left)...`);
        await delay(20000);
        retries--;
      } else throw e;
    }
  }
  throw new Error("Max retries exceeded in eval");
};

const NODE_COVERAGE_SCHEMA = {
  type: "OBJECT",
  properties: {
    nodes_found: { type: "NUMBER", description: "Number of required nodes found in the text (0 to 5)." },
    details: { type: "STRING", description: "Brief justification for which nodes were found and which were missing." }
  },
  required: ["nodes_found", "details"]
};

async function evaluateCustomNodeCoverage(text: string, personaId: PersonaId, variantId: string) {
  let requiredNodes = [];

  if (personaId === "developer") {
    requiredNodes = [
      "Identify a concrete system or process.",
      "Locate a constraint, bottleneck, or failure point.",
      "Explain the mechanism connecting that constraint to the outcome.",
      "Propose an intervention that changes the mechanism.",
      "Connect the intervention to an observable consequence."
    ];
  } else if (personaId === "psychology") {
    requiredNodes = [
      "Identify an external trigger or event.",
      "Uncover the hidden motive, defense mechanism, or emotional need driving the reaction.",
      "Explain the observable behavior resulting from this motive.",
      "Identify the immediate emotional payoff (reinforcement) that sustains the behavior.",
      "Produce a shift in internal self-awareness."
    ];
  } else if (personaId === "intellectual") {
    if (variantId === "B" || variantId === "C") {
      requiredNodes = [
        "Start from a widely accepted assumption about the topic.",
        "Expose the hidden flaw or hidden assumption beneath it.",
        "Challenge the framing of the question itself.",
        "Propose an alternative framing.",
        "End with an unresolved or reframed synthesis."
      ];
    } else {
      requiredNodes = [
        "Identify a common assumption or premise.",
        "Reveal the inherent tension or contradiction within it.",
        "Challenge the premise causally.",
        "Reframe the problem from a fundamentally different angle.",
        "Synthesize a new, deeper understanding."
      ];
    }
  } else if (personaId === "creative") {
    if (variantId === "B" || variantId === "C") {
      requiredNodes = [
        "Start with a concrete sensory or external scene.",
        "Find an unexpected relation or association based on that external scene.",
        "Create tension between the literal scene and the metaphorical meaning.",
        "Transform the reader's understanding of the concept.",
        "Leave a lingering echo related to the opening scene."
      ];
    } else {
      requiredNodes = [
        "Start with an ordinary observation of the topic.",
        "Introduce an unexpected association or metaphor.",
        "Build tension between the literal and the metaphorical.",
        "Transform the reader's understanding of the topic through this associative leap.",
        "Leave a lingering conceptual or emotional echo."
      ];
    }
  }

  const systemPrompt = `
You are a structural reasoning evaluator. Your task is to determine how many of the required causal nodes are present in the given text.

REQUIRED NODES FOR THIS PERSONA:
${requiredNodes.map((n, i) => `${i + 1}. ${n}`).join("\n")}

EVALUATION RULES:
1. Count how many of these exactly 5 required nodes are clearly present and actively used in the argument.
2. The nodes must appear in a logical sequence that fulfills the reasoning contract.
3. Be strict. If the node is vague or just implied but not explicitly playing a structural role, do NOT count it.
4. Output 'nodes_found' as an integer between 0 and 5.
`;

  const response = await ai.models.generateContent({
    model: "gemini-3.1-flash-lite",
    contents: `TEXT TO EVALUATE:\n\n${text}`,
    config: {
      systemInstruction: systemPrompt,
      responseMimeType: "application/json",
      responseSchema: NODE_COVERAGE_SCHEMA as any,
      temperature: 0.1,
    }
  });

  return JSON.parse(response.text!);
}

async function runExp007() {
  const datasetPath = path.join(__dirname, "datasets", "dataset-exp-007.json");
  const dataset = JSON.parse(fs.readFileSync(datasetPath, "utf-8"));

  console.log(`🚀 Starting EXP-007: Causal Isolation`);

  const variants = [
    { id: "A", version: "v2", desc: "V2 (Baseline Contracts)" },
    { id: "B", version: "v3_b", desc: "Structural Contract" },
    { id: "C", version: "v3_c", desc: "Structural + Anti-Isomorphism" }
  ];

  const results: any = {
    metadata: { name: "EXP-007", timestamp: new Date().toISOString() },
    cases: []
  };

  const textsByVariantTopic: Record<string, Record<string, Record<string, string>>> = {};

  for (const variant of variants) {
    console.log(`\n=================================================`);
    console.log(`🔷 VARIANT ${variant.id}: ${variant.desc}`);
    console.log(`=================================================`);

    textsByVariantTopic[variant.id] = {};

    for (const topic of dataset.topics) {
      console.log(`\n📌 Topic: ${topic.name}`);
      textsByVariantTopic[variant.id][topic.id] = {};

      for (const personaId of dataset.personas) {
        const basePersona = getPersona(personaId);
        if (!basePersona) throw new Error(`Persona ${personaId} not found`);

        console.log(`   Generate -> ${personaId}...`);
        const input: any = {
          rawInput: topic.prompt,
          platform: "linkedin",
          contentType: "social_post",
          mode: "creator",
          arabicStyle: "white_arabic",
          metadata: {
            persona: { ...basePersona, usePerspectiveConstraint: true, perspectiveVersion: variant.version },
            style: "storytelling",
          },
        };
        const raw = await generateContent(input);
        const text = extractFullText(raw);
        textsByVariantTopic[variant.id][topic.id][personaId] = text;

        await delay(2000);

        // Evaluation
        console.log(`   Evaluating Persona Accuracy (using V2 evaluator)...`);
        const evalPersona = await retryEval(() => evaluatePersona(text, "v2"));
        await delay(2000);

        console.log(`   Evaluating Ablation...`);
        const ablation = await retryEval(() => evaluateAblationWeighted(text, personaId as any));
        await delay(2000);

        console.log(`   Evaluating Node Coverage...`);
        const coverage = await retryEval(() => evaluateCustomNodeCoverage(text, personaId as any, variant.id));
        await delay(2000);

        const personaMapping: Record<string, string> = {
          "A": "developer",
          "B": "psychology",
          "C": "intellectual",
          "D": "creative"
        };
        const predictedString = personaMapping[evalPersona.predicted_persona] || evalPersona.predicted_persona;
        const isMatch = predictedString.toLowerCase() === personaId.toLowerCase();
        let collisionPersona = null;
        if (!isMatch) {
          collisionPersona = predictedString.toLowerCase();
        }

        const caseData = {
          variant: variant.id,
          topic: topic.id,
          persona: personaId,
          raw_text: text,
          predicted_persona: predictedString,
          confidence: evalPersona.confidence_score,
          is_match: isMatch,
          collision: collisionPersona,
          node_coverage: coverage,
          ablation: {
            weightedScore: ablation.weightedScore,
            reasoning_structure_delta: ablation.signals.reasoning_structure_delta,
            causal_model_delta: ablation.signals.causal_model_delta,
            isVocabularyOnly: ablation.isVocabularyOnly,
            blindPredicted: personaMapping[(ablation.blindClassificationAfterAblation as any).predicted_persona] || (ablation.blindClassificationAfterAblation as any).predicted_persona
          }
        };
        results.cases.push(caseData);
        console.log(`     -> Predicted: ${predictedString} (Confidence: ${evalPersona.confidence_score})`);
        console.log(`     -> Ablation Delta: ${ablation.weightedScore}, Blind: ${caseData.ablation.blindPredicted}`);
      }

      // Now evaluate separation between all pairs in this topic + variant
      const pairs = [
        ["developer", "psychology"],
        ["developer", "intellectual"],
        ["developer", "creative"],
        ["psychology", "intellectual"],
        ["psychology", "creative"],
        ["intellectual", "creative"],
      ];

      console.log(`   Evaluating Reasoning Separation for Topic ${topic.id} (Variant ${variant.id})...`);
      for (const [pA, pB] of pairs) {
        const textA = textsByVariantTopic[variant.id][topic.id][pA];
        const textB = textsByVariantTopic[variant.id][topic.id][pB];
        const sep = await retryEval(() => evaluateReasoningSeparation(textA, pA as any, textB, pB as any));
        await delay(2000);

        results.cases.push({
          type: "separation",
          variant: variant.id,
          topic: topic.id,
          pair: `${pA}_vs_${pB}`,
          separation_score: sep.separation_score,
          is_vocabulary_only_swap: sep.is_vocabulary_only_swap,
          causal_model_difference: sep.causal_model_difference
        });
        console.log(`     -> ${pA} vs ${pB}: separation_score = ${sep.separation_score}`);
      }
    }
  }

  // Calculate Aggregates
  const summary: any = {};
  for (const v of variants) {
    const vCases = results.cases.filter((c: any) => c.variant === v.id && c.type !== "separation");
    const sepCases = results.cases.filter((c: any) => c.variant === v.id && c.type === "separation");

    const collisionCount = vCases.filter((c: any) => !c.is_match).length;
    const collisionRate = (collisionCount / vCases.length) * 100;
    const avgAblationDelta = vCases.reduce((sum: number, c: any) => sum + c.ablation.weightedScore, 0) / vCases.length;

    const avgSeparation = sepCases.reduce((sum: number, c: any) => sum + c.separation_score, 0) / sepCases.length;
    const vocabOnlySwapRate = (sepCases.filter((c: any) => c.is_vocabulary_only_swap).length / sepCases.length) * 100;

    const adjacentCollisions = vCases.filter((c: any) => !c.is_match).map((c: any) => `${c.persona}->${c.collision}`);

    summary[v.id] = {
      "Collision Rate (%)": collisionRate.toFixed(2),
      "Ablation Delta": avgAblationDelta.toFixed(2),
      "Avg Reasoning Separation": avgSeparation.toFixed(2),
      "Vocab-only Swap Rate (%)": vocabOnlySwapRate.toFixed(2),
      "Adjacent Collisions": adjacentCollisions
    };
  }

  results.summary = summary;
  const reportPath = path.join(__dirname, "benchmark-reports", `exp-007-${Date.now()}.json`);
  fs.writeFileSync(reportPath, JSON.stringify(results, null, 2));

  console.log(`\n✅ EXP-007 Complete. Report saved to: ${reportPath}`);
  console.log(JSON.stringify(summary, null, 2));
}

runExp007().catch(console.error);
