import { PersonaConfig, NormalizedPersona } from "@/types/content";
import { getPersona } from "./registry";

/**
 * Sanitizes custom user instructions to guard against prompt injection attempts
 * and keep instructions strictly within stylistic bounds.
 */
function sanitizeInstructions(text?: string): string | undefined {
  if (!text) return undefined;
  
  let cleaned = text.trim();
  if (cleaned.length === 0) return undefined;

  // Max length defense to respect prompt budget
  if (cleaned.length > 300) {
    cleaned = cleaned.substring(0, 300).trim();
  }

  // Remove common injection patterns and systemic override phrases
  const forbiddenPatterns = [
    /ignore\s+(all\s+)?(previous|prior|system)\s+instructions?/gi,
    /system\s*prompt/gi,
    /you\s+are\s+now\s+in\s+developer\s+mode/gi,
    /disregard\s+(all\s+)?rules/gi,
    /jailbreak/gi,
    /<script[\s\S]*?>[\s\S]*?<\/script>/gi,
  ];

  for (const pattern of forbiddenPatterns) {
    cleaned = cleaned.replace(pattern, "");
  }

  cleaned = cleaned.trim();
  return cleaned.length > 0 ? cleaned : undefined;
}

export function normalizePersona(config?: PersonaConfig): NormalizedPersona | undefined {
  if (!config) return undefined;

  const preset = config.id ? getPersona(config.id) : undefined;
  const rp = preset?.reasoningProfile;

  // Derive interests from analogy domains + attention biases (best approximation from reasoning profile)
  const presetInterests: string[] = rp
    ? [...rp.analogyDomains, ...rp.attentionBiases].slice(0, 5)
    : [];

  const interests = Array.from(
    new Set([
      ...presetInterests,
      ...(config.interests || []),
    ])
  ).filter(Boolean);

  // Derive traits from reasoning patterns
  const presetTraits: string[] = rp ? rp.reasoningPatterns.slice(0, 3) : [];
  const traits = Array.from(
    new Set([
      ...presetTraits,
      ...(config.characteristics || []),
    ])
  ).filter(Boolean);

  // Voice signals from conclusion patterns or generic defaults
  const voiceSignals: string[] = rp
    ? rp.conclusionPatterns.slice(0, 2)
    : ["ذكي", "متزن", "أصيل"];

  // Content patterns from question patterns
  const contentPatterns: string[] = rp
    ? rp.questionPatterns.slice(0, 2)
    : ["زاوية نظر غير مألوفة وعميقة"];

  // No preset vocabulary list anymore — avoidances become the avoid list
  const vocabulary: string[] = [];
  const avoid: string[] = rp
    ? rp.avoidances
    : ["الكليشيهات والعبارات المبتذلة", "ادعاء خبرات وهمية"];

  const customInstructions = sanitizeInstructions(config.customInstructions);

  const identity =
    config.name ||
    preset?.name ||
    (interests.length > 0 ? `صانع محتوى مهتم بـ ${interests.slice(0, 3).join("، ")}` : "صانع محتوى ذكي ومستبصر");

  return {
    id: config.id || "custom",
    identity,
    interests,
    traits,
    voiceSignals,
    contentPatterns,
    vocabulary,
    avoid,
    customInstructions,
  };
}
