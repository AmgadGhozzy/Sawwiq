import { CreatorConfig, NormalizedCreatorConfig } from "@/types/creator";
import { normalizePersona } from "../personas";
import { normalizeStyle } from "../styles";
import { generateCreatorBlueprint } from "./blueprints";

export function normalizeCreatorConfig(
  config?: CreatorConfig,
  topic: string = ""
): NormalizedCreatorConfig {
  const persona = normalizePersona(config?.persona) || {
    id: "developer",
    identity: "المبرمج والتقني",
    interests: ["البرمجة", "الأنظمة والتقنية"],
    traits: ["تحليلي", "فضولي"],
    voiceSignals: ["ذكي", "متزن"],
    contentPatterns: ["زاوية غير مألوفة وعميقة"],
    avoid: ["الكليشيهات العامة"],
  };

  const style = normalizeStyle(config?.style) || {
    id: "mystery",
    name: "الغموض والمفارقة",
    characteristics: ["بناء توتر وفضول", "كشف غير متوقع"],
    structure: ["افتتاحية شاذة", "تفكيك المشهد", "لحظة الإدراك"],
    rhetoricalDevices: ["المفارقة", "التشويق"],
    avoid: ["حرق الفكرة مبكراً"],
  };

  const intent = config?.intent || "insight";
  const originality = config?.originality || "balanced";
  const strategy = config?.strategy || "structured";

  const blueprint =
    strategy !== "direct"
      ? generateCreatorBlueprint({
          intent,
          styleId: style.id,
          topic,
          personaId: persona.id,
          originality,
          perspective: config?.perspective,
        })
      : undefined;

  const avoid = Array.from(
    new Set([
      ...(persona.avoid || []),
      ...(style.avoid || []),
      ...(config?.avoid || []),
      "العبارات الاستهلالية المبتذلة مثل: في عالمنا المتسارع، اليوم سنتحدث عن، لا يخفى على أحد",
    ])
  );

  return {
    persona,
    style,
    intent,
    originality,
    strategy,
    perspective: config?.perspective,
    blueprint,
    signature: config?.signature,
    avoid,
  };
}
