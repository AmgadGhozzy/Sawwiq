import { GoogleGenAI, Type } from "@google/genai";
import { createVertexAIClient } from "../ai/googleClient";
import { aiConfig } from "../config";
import type { FactLedger, GeneratedContent, ClaimRisk } from "@/types/content";

export interface ClaimAudit {
  claim: string;
  status: "SUPPORTED" | "UNSUPPORTED";
  risk: ClaimRisk;
  justification: string;
}

export interface FactAuditResult {
  auditedClaims: ClaimAudit[];
  unsupportedClaimCount: number;
  criticalUnsupportedClaimCount: number;
  inventedConflictResolutionCount: number;
}

const factAuditSchema = {
  type: Type.OBJECT,
  properties: {
    auditedClaims: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          claim: { type: Type.STRING },
          status: { type: Type.STRING, enum: ["SUPPORTED", "UNSUPPORTED"] },
          risk: { type: Type.STRING, enum: ["low", "medium", "high", "critical"] },
          justification: { type: Type.STRING },
        },
        required: ["claim", "status", "risk", "justification"]
      }
    },
    unsupportedClaimCount: { type: Type.INTEGER },
    criticalUnsupportedClaimCount: { type: Type.INTEGER },
    inventedConflictResolutionCount: { type: Type.INTEGER, description: "Number of times the model tried to resolve or average conflicting facts on its own" }
  },
  required: ["auditedClaims", "unsupportedClaimCount", "criticalUnsupportedClaimCount", "inventedConflictResolutionCount"]
};

export async function auditGeneratedFacts(
  generatedContent: GeneratedContent,
  rawInput: string,
  factLedger: FactLedger
): Promise<FactAuditResult> {
  const client = createVertexAIClient();
  const modelName = process.env.GEMINI_MODEL ?? aiConfig.model;

  const systemInstruction = `
أنت مدقق جودة نهائي (Post-Generation Auditor).
مهمتك هي مراجعة كل الإدعاءات (Claims) الموجودة في النص المولد ومقارنتها بقائمة الحقائق المعتمدة.

القواعد:
1. صنف كل ادعاء كـ SUPPORTED (إذا كان موجوداً في الـ Input أو إعادة صياغة إبداعية صحيحة) أو UNSUPPORTED (إذا لم يكن له أساس أو تم اختلاقه).
2. حدد درجة خطورة كل ادعاء (ClaimRisk):
   - critical: الأسعار، الخصومات، الضمانات، النتائج الطبية، "رقم 1".
   - high: الأرقام الفنية (مثل سعة البطارية)، أسماء الماركات.
   - medium: الميزات الوظيفية.
   - low: الأوصاف الإبداعية والجمالية.
3. التناقضات (Conflicting Facts): إذا قام النموذج بحل التناقض بنفسه (مثل حساب متوسط لسعرين)، سجل ذلك كـ inventedConflictResolution.
`.trim();

  const userPrompt = `
Input Text:
${rawInput}

Explicit Facts Ledger:
${JSON.stringify(factLedger.explicit, null, 2)}

Generated Content:
${JSON.stringify(generatedContent, null, 2)}

Extract all claims and audit them.
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
          responseSchema: factAuditSchema,
          temperature: 0.1,
        },
      });

      const text = response.text;
      if (!text) throw new Error("Empty response from fact auditor");

      return JSON.parse(text) as FactAuditResult;
    } catch (error: any) {
      if (error?.status === 429) {
        retryAttempts++;
        console.log(`\n↻ Auditor rate limited, retrying in 10s... (${retryAttempts}/5)`);
        await new Promise(resolve => setTimeout(resolve, 10000));
      } else {
        console.error("Fact audit failed:", error);
        break;
      }
    }
  }

  throw new Error("EVALUATION_FAILED");
}
