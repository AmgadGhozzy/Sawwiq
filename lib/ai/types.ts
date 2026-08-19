// ---------------------------------------------------------------------------
// AI Provider Interface
// ---------------------------------------------------------------------------

import type { GeneratedContent, GenerationInput, GenerationMetadata } from "@/types/content";

/**
 * Result from an AI generation call.
 * Includes both the content and internal metadata for observability.
 */
export interface GenerationResult {
  content: GeneratedContent;
  metadata: GenerationMetadata;
}

/**
 * Abstract AI provider interface.
 *
 * The application layer depends on this contract — never on a concrete
 * provider (Gemini, OpenAI, Anthropic, etc.).
 */
export interface AIProvider {
  readonly providerName: string;
  readonly modelName: string;

  generateContent(input: GenerationInput): Promise<GenerationResult>;
}
