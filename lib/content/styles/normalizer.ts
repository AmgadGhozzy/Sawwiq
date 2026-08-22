import { StyleConfig, NormalizedStyle } from "@/types/content";
import { getStyle } from "./registry";

function sanitizeStyleInstructions(text?: string): string | undefined {
  if (!text) return undefined;
  let cleaned = text.trim();
  if (cleaned.length === 0) return undefined;

  if (cleaned.length > 250) {
    cleaned = cleaned.substring(0, 250).trim();
  }

  const forbiddenPatterns = [
    /ignore\s+(all\s+)?(previous|prior|system)\s+instructions?/gi,
    /system\s*prompt/gi,
    /override/gi,
  ];

  for (const pattern of forbiddenPatterns) {
    cleaned = cleaned.replace(pattern, "");
  }

  cleaned = cleaned.trim();
  return cleaned.length > 0 ? cleaned : undefined;
}

export function normalizeStyle(config?: StyleConfig): NormalizedStyle | undefined {
  if (!config) return undefined;

  const preset = config.id ? getStyle(config.id) : undefined;

  const characteristics = Array.from(
    new Set([
      ...(preset?.characteristics || []),
      ...(config.characteristics || []),
    ])
  ).filter(Boolean);

  const structure = preset?.structure || ["مدخل قوي", "تطوير مشوق للفكرة", "خاتمة ذات أثر"];
  const rhetoricalDevices = preset?.rhetoricalDevices || ["الإيقاع السلس", "الوضوح"];
  const avoid = preset?.avoid || ["الحشو", "التكلف"];

  const customInstructions = sanitizeStyleInstructions(config.customInstructions);

  return {
    id: config.id || "custom",
    name: config.name || preset?.name || "أسلوب مخصص",
    characteristics,
    structure,
    rhetoricalDevices,
    avoid,
    customInstructions,
  };
}
