import { GoogleGenAI, Type } from "@google/genai";
import { createVertexAIClient } from "../ai/googleClient";
import { aiConfig } from "../config";
import type { FactLedger, GeneratedContent } from "@/types/content";

export interface FactEvaluationScore {
  factPreservationScore: number;
  unsupportedClaimRate: number;
  numericAccuracy: number;
  entityPreservation: number;
  criticalFactualFailureCount: number;
  missingFactHallucinationRate: number;
  details: string[];
}

const factEvaluationSchema = {
  type: Type.OBJECT,
  properties: {
    factPreservationScore: { type: Type.INTEGER, description: "0-100 score of how well facts were preserved without fabrication" },
    unsupportedClaimRate: { type: Type.INTEGER, description: "Percentage of claims in output that are unsupported (0-100)" },
    numericAccuracy: { type: Type.INTEGER, description: "0-100 score for numeric exactness" },
    entityPreservation: { type: Type.INTEGER, description: "0-100 score for preserving entities like names and locations" },
    criticalFactualFailureCount: { type: Type.INTEGER, description: "Count of critical failures like changing prices or guarantees" },
    missingFactHallucinationRate: { type: Type.INTEGER, description: "Percentage of missing facts that were hallucinated (0-100)" },
    details: { type: Type.ARRAY, items: { type: Type.STRING }, description: "Specific instances of failures or paraphrases" },
  },
  required: [
    "factPreservationScore",
    "unsupportedClaimRate",
    "numericAccuracy",
    "entityPreservation",
    "criticalFactualFailureCount",
    "missingFactHallucinationRate",
    "details"
  ]
};

export async function evaluateFactPreservation(
  generatedContent: GeneratedContent,
  rawInput: string,
  factLedger: FactLedger
): Promise<FactEvaluationScore> {
  const client = createVertexAIClient();
  const modelName = process.env.GEMINI_MODEL ?? aiConfig.model;

  const systemInstruction = `
أنت مقيّم جودة صارم متخصص في فحص الحقائق (Fact Checking) للمحتوى التسويقي.
الهدف هو التفريق بين "الهلوسة" وبين "إعادة الصياغة الإبداعية".

القواعد:
1. Hard Facts (السعر، الأرقام، المقاسات، المواقع، التواريخ) يجب أن تُحفظ بدقة تامة (Numeric Accuracy & Entity Preservation).
2. Creative Paraphrase (مثل "بطارية 5000mAh" → "بطارية بسعة 5000 ملي أمبير") مقبول ولا يعتبر هلوسة.
3. Unsupported Claims (مثل "بطارية تدوم يومين" ولم تكن مذكورة) تعتبر هلوسة (Unsupported Claim).
4. Critical Failure يحدث إذا قام النموذج بتغيير حقيقة مهمة (مثل تخفيض السعر، زيادة الضمان، أو إضافة ميزة طبية كاذبة).

قم بتقييم النص المولد مقابل الحقائق المقدمة.
`.trim();

  const userPrompt = `
Input Text:
${rawInput}

Explicit Facts:
${JSON.stringify(factLedger.explicit, null, 2)}

Missing/Prohibited Facts:
${JSON.stringify(factLedger.missing.concat(factLedger.prohibitedClaims), null, 2)}

Generated Content:
${JSON.stringify(generatedContent, null, 2)}

Evaluate the fact preservation according to the schema.
`.trim();

  let retryAttempts = 0;
  while (retryAttempts < 5) {
    try {
      const response = await client.models.generateContent({
        model: modelName,
        contents: userPrompt,
        config: {
          systemInstruction,
          responseMimeType: "application/json",
          responseSchema: factEvaluationSchema,
          temperature: 0.1, // Low temperature for deterministic evaluation
        },
      });

      const text = response.text;
      if (!text) throw new Error("Empty response from fact evaluator");

      return JSON.parse(text) as FactEvaluationScore;
    } catch (error: any) {
      if (error?.status === 429) {
        retryAttempts++;
        console.log(`\n↻ Evaluator rate limited, retrying in 10s... (${retryAttempts}/5)`);
        await new Promise(resolve => setTimeout(resolve, 10000));
      } else {
        console.error("Fact evaluation failed:", error);
        break;
      }
    }
  }

  throw new Error("EVALUATION_FAILED");
}
