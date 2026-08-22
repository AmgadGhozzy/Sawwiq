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

  const interests = Array.from(
    new Set([
      ...(preset?.interests || []),
      ...(config.interests || []),
    ])
  ).filter(Boolean);

  const traits = Array.from(
    new Set([
      ...(preset?.characteristics || []),
      ...(config.characteristics || []),
    ])
  ).filter(Boolean);

  const voiceSignals = preset?.tone || ["ذكي", "متزن", "أصيل"];
  const contentPatterns = preset?.contentPatterns || ["زاوية نظر غير مألوفة وعميقة"];
  const vocabulary = preset?.vocabulary || [];
  const avoid = preset?.avoid || ["الكليشيهات والعبارات المبتذلة", "ادعاء خبرات وهمية"];

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
