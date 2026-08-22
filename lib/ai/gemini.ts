// ---------------------------------------------------------------------------
// Gemini Provider — structured output via Google Gen AI SDK
//
// Uses structured JSON output. Schema is derived from the single source
// of truth (CONTENT_FIELD_DESCRIPTIONS).
//
// Pipeline: LLM → JSON Parse → Zod → Claim Validator → Response
// ---------------------------------------------------------------------------

import { GoogleGenAI, Type } from "@google/genai";
import { createVertexAIClient } from "./googleClient";
import type { GenerationInput, GenerationConfig } from "@/types/content";
import type { AIProvider, GenerationResult } from "./types";
import {
  generatedContentSchema,
  CONTENT_FIELD_DESCRIPTIONS,
} from "@/lib/validation/generation";
import { normalizeGenerationConfig } from "@/lib/content/normalizer";
import { compilePrompt, buildUserPrompt } from "@/lib/content/prompt/compiler";
import { aiConfig } from "@/lib/config";
import { validateClaims } from "../../supabase/functions/generate/validation/claimValidator";
import { type InputDTO } from "../../supabase/functions/generate/validation/schema";

// ---------------------------------------------------------------------------
// Derived JSON Schema
// ---------------------------------------------------------------------------

const generatedContentGeminiSchema = {
  type: Type.OBJECT,
  properties: {
    title: { type: Type.STRING, description: CONTENT_FIELD_DESCRIPTIONS.title },
    hook: { type: Type.STRING, description: CONTENT_FIELD_DESCRIPTIONS.hook },
    body: { type: Type.STRING, description: CONTENT_FIELD_DESCRIPTIONS.body },
    callToAction: { type: Type.STRING, description: CONTENT_FIELD_DESCRIPTIONS.callToAction },
    hashtags: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: CONTENT_FIELD_DESCRIPTIONS.hashtags,
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

// ---------------------------------------------------------------------------
// Provider Implementation
// ---------------------------------------------------------------------------

export class GeminiProvider implements AIProvider {
  readonly providerName = "gemini";
  readonly modelName: string;

  private client: GoogleGenAI;

  constructor() {
    this.modelName = process.env.GEMINI_MODEL || aiConfig.model;
    this.client = createVertexAIClient();
  }

  async generateContent(input: GenerationInput | GenerationConfig): Promise<GenerationResult> {
    const startTime = Date.now();

    const config = resolveConfig(input);
    const normalizedConfig = normalizeGenerationConfig(config);

    const systemPrompt = compilePrompt(normalizedConfig);
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
        temperature: 0.7,
        topP: 0.9,
      },
    });

    const latencyMs = Date.now() - startTime;

    // Parse the JSON response
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

    // Validate with Zod — structural enforcement
    const validated = generatedContentSchema.parse(parsed);

    // Validate claims — business logic enforcement
    const claimCheck = validateClaims(validated, inputDto);
    if (!claimCheck.passed) {
      const msgs = claimCheck.violations.map((v) => v.reason).join(" | ");
      throw new Error(`Claim validation failed: ${msgs}`);
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
        },
      },
    };
  }
}
