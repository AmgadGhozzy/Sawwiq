import { GoogleGenAI, Type } from "@google/genai";
import type { GenerationInput } from "@/types/content";
import type { AIProvider, GenerationResult } from "./types";
import { buildSystemPrompt, buildUserPrompt } from "../../supabase/functions/generate/prompts/promptBuilder.ts";
import { validateClaims } from "../../supabase/functions/generate/validation/claimValidator.ts";
import { generatedContentSchema, type InputDTO } from "../../supabase/functions/generate/validation/schema.ts";
import { repairVideoScriptTiming } from "../../supabase/functions/generate/utils/repair.ts";

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

export class ProductionGenerationAdapter implements AIProvider {
  readonly providerName = "gemini-production-adapter";
  readonly modelName: string;
  private client: GoogleGenAI;

  constructor() {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY is not set");
    }
    this.modelName = process.env.GEMINI_MODEL || "gemini-2.5-flash-lite";
    this.client = new GoogleGenAI({ apiKey });
  }

  async generateContent(input: GenerationInput): Promise<GenerationResult> {
    const startTime = Date.now();

    const inputDto: InputDTO = {
      platform: input.platform,
      arabicStyle: input.arabicStyle,
      contentType: input.contentType,
      marketingObjective: input.metadata?.marketingObjective,
      rawInput: input.rawInput,
    };

    const systemPrompt = buildSystemPrompt(inputDto);
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

    if (inputDto.contentType === "short_video_script") {
      validated.body = repairVideoScriptTiming(validated.body);
    }

    const claimCheck = validateClaims(validated, inputDto);
    if (!claimCheck.passed) {
      const msgs = claimCheck.violations.map((v: { reason: string }) => v.reason).join(" | ");
      throw new Error(`Claim validation failed: ${msgs}`);
    }

    return {
      content: validated,
      metadata: {
        model: this.modelName,
        provider: this.providerName,
        latencyMs,
        requestId: "",
      },
    };
  }
}
