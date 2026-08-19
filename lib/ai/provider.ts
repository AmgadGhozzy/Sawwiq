// ---------------------------------------------------------------------------
// AI Provider Factory
//
// The API route depends on the AIProvider interface via this factory.
// Adding a new provider (OpenAI, Anthropic) means:
//   1. Implement AIProvider in a new file
//   2. Add a case here
//   3. Set the env var
// No changes to API routes, prompts, or validation.
// ---------------------------------------------------------------------------

import { aiConfig } from "@/lib/config";
import type { AIProvider } from "./types";
import { GeminiProvider } from "./gemini";

let _provider: AIProvider | null = null;

export function getAIProvider(): AIProvider {
  if (_provider) return _provider;

  switch (aiConfig.provider) {
    case "gemini":
      _provider = new GeminiProvider();
      break;
    // Future:
    // case "openai":
    //   _provider = new OpenAIProvider();
    //   break;
    // case "anthropic":
    //   _provider = new AnthropicProvider();
    //   break;
    default:
      throw new Error(`Unknown AI provider: ${aiConfig.provider}`);
  }

  return _provider;
}
