import { GoogleGenAI, Type } from "@google/genai";
import { createVertexAIClient } from "./googleClient";
import type { GenerationInput, GenerationConfig } from "@/types/content";
import type { AIProvider, GenerationResult } from "./types";
import { normalizeGenerationConfig } from "@/lib/content/normalizer";
import { compilePrompt, buildUserPrompt } from "@/lib/content/prompt/compiler";
import { extractFacts } from "@/lib/content/facts/extractor";
import { validateClaims } from "../../supabase/functions/generate/validation/claimValidator";
import { generatedContentSchema, type InputDTO } from "../../supabase/functions/generate/validation/schema";
import { parseVideoScript, validateVideoScript, enforceTiming } from "@/lib/evaluation/videoValidator";
import { aiConfig } from "../config";

const generatedContentGeminiSchema = {
  type: Type.OBJECT,
  properties: {
    title: { type: Type.STRING },
    hook: { type: Type.STRING },
    body: { type: Type.STRING },
    callToAction: { type: Type.STRING },
    hashtags: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
    },
  },
  required: ["title", "hook", "body", "callToAction", "hashtags"],
};

function resolveConfig(input: GenerationInput | GenerationConfig): GenerationConfig {
  if ("language" in input && typeof input.language === "object" && "voice" in input) {
    return input as GenerationConfig;
  }
  const v1 = input as GenerationInput;
  return {
    platform: (v1.platform === "x_twitter" ? "x" : v1.platform) as any,
    format: v1.contentType === "short_video_script" ? "video" : "post",
    content: {
      type: (v1.contentType === "short_video_script" ? "video_script" : v1.contentType === "sponsored_ad" ? "advertisement" : v1.contentType === "ecommerce_product" ? "product_description" : v1.contentType === "real_estate" ? "real_estate_listing" : v1.contentType === "marketing_email" ? "email" : "social_post") as any,
      topic: v1.rawInput,
    },
    objective: (v1.metadata?.marketingObjective === "sell" ? "sales" : v1.metadata?.marketingObjective === "generate_leads" ? "leads" : v1.metadata?.marketingObjective === "attract_messages" ? "messages" : v1.metadata?.marketingObjective === "drive_traffic" ? "traffic" : "awareness") as any,
    language: {
      language: "ar",
      dialect: (v1.arabicStyle === "saudi_marketing" ? "saudi" : v1.arabicStyle === "gulf_premium" ? "gulf" : v1.arabicStyle === "egyptian_colloquial" ? "egyptian" : v1.arabicStyle === "formal_b2b" ? "msa" : "white_arabic") as any,
    },
    voice: {
      tone: "professional",
      style: "direct_response",
    },
    constraints: {},
  };
}

export class ProductionGenerationAdapter implements AIProvider {
  readonly providerName = "gemini-production-adapter";
  readonly modelName: string;
  private client: GoogleGenAI;

  constructor() {
    this.modelName = process.env.GEMINI_MODEL || "gemini-2.5-flash-lite";
    this.client = createVertexAIClient();
  }

  async generateContent(input: GenerationInput | GenerationConfig): Promise<GenerationResult> {
    const startTime = Date.now();

    const config = resolveConfig(input);
    const normalizedConfig = normalizeGenerationConfig(config);
    const factLedger = extractFacts(normalizedConfig);

    const systemPrompt = compilePrompt(normalizedConfig, factLedger);
    const userPrompt = buildUserPrompt();

    const inputDto: InputDTO = {
      platform: normalizedConfig.platform as any,
      arabicStyle: (normalizedConfig.language.dialect === "saudi" ? "saudi_marketing" : normalizedConfig.language.dialect === "gulf" ? "gulf_premium" : normalizedConfig.language.dialect === "egyptian" ? "egyptian_colloquial" : normalizedConfig.language.dialect === "msa" ? "formal_b2b" : "white_arabic") as any,
      contentType: normalizedConfig.content.type as any,
      marketingObjective: normalizedConfig.objective,
      rawInput: normalizedConfig.content.topic,
    };

    const response = await this.client.models.generateContent({
      model: this.modelName,
      contents: userPrompt,
      config: {
        systemInstruction: systemPrompt,
        responseMimeType: "application/json",
        responseSchema: generatedContentGeminiSchema,
        temperature: aiConfig.temperature,
        topP: aiConfig.topP,
      },
    });

    const latencyMs = Date.now() - startTime;
    const responseText = response.text;
    if (!responseText) {
      throw new Error("Empty response from Gemini");
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(responseText);
    } catch {
      throw new Error(`Invalid JSON from Gemini: ${responseText.slice(0, 200)}`);
    }

    const validated = generatedContentSchema.parse(parsed);

    const claimCheck = validateClaims(validated, inputDto);
    if (!claimCheck.passed) {
      const msgs = claimCheck.violations.map((v: { reason: string }) => v.reason).join(" | ");
      throw new Error(`Claim validation failed: ${msgs}`);
    }

    // Video script structural validation + auto-repair
    if (normalizedConfig.content.type === "video_script" || normalizedConfig.content.type === "short_video_script") {
      const initialParse = parseVideoScript(validated.body);

      if (!initialParse) {
        throw new Error(
          "Video script parsing failed: no recognisable scene headers found."
        );
      }

      const initialCheck = validateVideoScript(initialParse);

      if (!initialCheck.passed) {
        const repairedBody = enforceTiming(validated.body);
        const repairedParse = parseVideoScript(repairedBody);

        if (!repairedParse) {
          throw new Error("Video script repair produced an unparseable result.");
        }

        const postRepairCheck = validateVideoScript(repairedParse);
        if (!postRepairCheck.passed) {
          throw new Error(
            `Video script validation failed after auto-repair: ${postRepairCheck.errors.join(" | ")}`
          );
        }

        validated.body = repairedBody;
      }
    }

    return {
      content: validated,
      metadata: {
        model: this.modelName,
        provider: this.providerName,
        latencyMs,
        requestId: "",
        tokenUsage: {
          promptTokens: response.usageMetadata?.promptTokenCount,
          completionTokens: response.usageMetadata?.candidatesTokenCount,
          totalTokens: response.usageMetadata?.totalTokenCount,
          thoughtsTokens: response.usageMetadata?.thoughtsTokenCount,
        },
      },
    };
  }
}
