import { GenerationConfig, NormalizedGenerationConfig } from "@/types/content";
import { getFormat } from "./formats";
import { extractFacts } from "./facts/extractor";
import { normalizePersona } from "./personas";
import { normalizeStyle } from "./styles";

export function normalizeGenerationConfig(input: GenerationConfig): NormalizedGenerationConfig {
  const format = getFormat(input.platform, input.format);
  if (!format) {
    throw new Error("Cannot normalize config for unsupported format");
  }

  // Deep clone to ensure immutability
  const normalized: NormalizedGenerationConfig = JSON.parse(JSON.stringify(input));

  // Merge constraints: Registry Defaults -> User Overrides -> Normalized Constraints
  const defaultConstraints = format.defaultConstraints || {};
  const userConstraints = input.constraints || {};

  normalized.constraints = {
    maxLength: userConstraints.maxLength ?? defaultConstraints.maxLength ?? 0, // 0 means no explicit limit applied by system
    minLength: userConstraints.minLength ?? defaultConstraints.minLength ?? 0,
    length: userConstraints.length ?? defaultConstraints.length ?? "medium",
    hashtags: {
      enabled: userConstraints.hashtags?.enabled ?? defaultConstraints.hashtags?.enabled ?? false,
      count: userConstraints.hashtags?.count ?? defaultConstraints.hashtags?.count,
      strategy: userConstraints.hashtags?.strategy ?? defaultConstraints.hashtags?.strategy ?? "mixed",
    },
    emojiLevel: userConstraints.emojiLevel ?? defaultConstraints.emojiLevel ?? "minimal",
    cta: userConstraints.cta ?? defaultConstraints.cta ?? { type: "none" },
    requiredTerms: userConstraints.requiredTerms ?? defaultConstraints.requiredTerms ?? [],
    forbiddenTerms: userConstraints.forbiddenTerms ?? defaultConstraints.forbiddenTerms ?? [],
    includeHook: userConstraints.includeHook ?? defaultConstraints.includeHook ?? false,
  };

  // Video normalization
  if (format.capabilities.video && !normalized.video) {
    normalized.video = {
      duration: 30, // Default duration if not specified but video is supported
      aspectRatio: input.platform === "tiktok" || input.format === "reel" || input.format === "short" ? "9:16" : "16:9",
      hookDuration: 3,
    };
  } else if (normalized.video) {
    normalized.video = {
      duration: normalized.video.duration ?? 30,
      aspectRatio: normalized.video.aspectRatio ?? (input.platform === "tiktok" || input.format === "reel" || input.format === "short" ? "9:16" : "16:9"),
      hookDuration: normalized.video.hookDuration ?? 3,
      structure: normalized.video.structure ?? "hook_body_cta",
      captions: normalized.video.captions ?? false,
      voiceover: normalized.video.voiceover ?? false,
      onScreenText: normalized.video.onScreenText ?? false,
      shotInstructions: normalized.video.shotInstructions ?? false,
    }
  }

  // Ensure arrays exist
  if (!normalized.audience) normalized.audience = {};
  if (!normalized.audience.interests) normalized.audience.interests = [];
  if (!normalized.audience.painPoints) normalized.audience.painPoints = [];

  normalized.factLedger = extractFacts(input);
  normalized.normalizedPersona = normalizePersona(input.persona);
  normalized.normalizedStyle = normalizeStyle(input.styleConfig);

  return normalized;
}
