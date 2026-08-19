// ---------------------------------------------------------------------------
// Gemini Provider — structured output via Google Gen AI SDK
//
// Uses structured JSON output. Schema is derived from the single source
// of truth (CONTENT_FIELD_DESCRIPTIONS).
//
// Pipeline: LLM → JSON Parse → Zod → Claim Validator → Response
// ---------------------------------------------------------------------------

import { GoogleGenAI, Type } from "@google/genai";
import type { GenerationInput } from "@/types/content";
import type { AIProvider, GenerationResult } from "./types";
import {
  generatedContentSchema,
  CONTENT_FIELD_DESCRIPTIONS,
} from "@/lib/validation/generation";
import { buildSystemPrompt, buildUserPrompt } from "../../supabase/functions/generate/prompts/promptBuilder.ts";
import { aiConfig } from "@/lib/config";
import { validateClaims } from "../../supabase/functions/generate/validation/claimValidator.ts";

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

// ---------------------------------------------------------------------------
// Provider Implementation
// ---------------------------------------------------------------------------

export class GeminiProvider implements AIProvider {
  readonly providerName = "gemini";
  readonly modelName: string;

  private client: GoogleGenAI;

  constructor() {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY is not set");
    }

    this.modelName = process.env.GEMINI_MODEL || aiConfig.model;
    this.client = new GoogleGenAI({ apiKey });
  }

  async generateContent(input: GenerationInput): Promise<GenerationResult> {
    const startTime = Date.now();

    const systemPrompt = buildSystemPrompt({
      platform: input.platform,
      arabicStyle: input.arabicStyle,
      contentType: input.contentType,
      marketingObjective: input.metadata?.marketingObjective,
      rawInput: input.rawInput, // Context layer injection
    });

    // Simple instruction without data duplication
    const userPrompt = buildUserPrompt();

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
    // In production, this throws. In benchmarks, we might want to catch it or evaluate it differently,
    // but the AI provider's job is to guarantee safe output. We will let it throw here.
    const claimCheck = validateClaims(validated, input);
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
        requestId: "", // Set by the API route
        tokenUsage: {
          promptTokens: response.usageMetadata?.promptTokenCount,
          completionTokens: response.usageMetadata?.candidatesTokenCount,
          totalTokens: response.usageMetadata?.totalTokenCount,
        },
      },
    };
  }
}
