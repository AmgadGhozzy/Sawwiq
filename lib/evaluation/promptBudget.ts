import { PROMPT_MAX_GROWTH_PERCENT } from "../config";
import type { InputDTO } from "../../supabase/functions/generate/validation/schema";

export interface PromptBudgetCase {
  id: string;
  input: InputDTO;
}

export interface PromptBudgetMeasurement {
  id: string;
  characters: number;
  estimatedTokens: number;
  baselineCharacters: number;
  growthPercent: number;
  withinBudget: boolean;
}

export interface PromptBudgetResult {
  measurements: PromptBudgetMeasurement[];
  totalCharacters: number;
  estimatedTokens: number;
  violations: string[];
}

// This compact matrix covers every conditional prompt layer without making a
// prompt-length guard expensive to run in unit tests or benchmarks.
export const PROMPT_BUDGET_MATRIX: PromptBudgetCase[] = [
  {
    id: "tiktok-egyptian-post",
    input: { platform: "tiktok", arabicStyle: "egyptian_colloquial", contentType: "interactive_post", rawInput: "شقة في المعادي قريبة من الكورنيش وبها اسانسير" },
  },
  {
    id: "instagram-gulf-product",
    input: { platform: "instagram", arabicStyle: "gulf_premium", contentType: "ecommerce_product", rawInput: "دهن عود معتق طبيعي بثبات وفوحان مميزين" },
  },
  {
    id: "linkedin-formal-b2b",
    input: { platform: "linkedin", arabicStyle: "formal_b2b", contentType: "marketing_email", rawInput: "برنامج محاسبة سحابي لإصدار الفواتير الإلكترونية" },
  },
  {
    id: "x-saudi-ad",
    input: { platform: "x_twitter", arabicStyle: "saudi_marketing", contentType: "sponsored_ad", rawInput: "عرض على منتجات العناية بالشعر حتى نهاية الشهر" },
  },
  {
    id: "facebook-white-real-estate",
    input: { platform: "facebook", arabicStyle: "white_arabic", contentType: "real_estate", rawInput: "فيلا أربع غرف نوم في حي الملقا مع مسبح خاص" },
  },
  {
    id: "tiktok-video",
    input: { platform: "tiktok", arabicStyle: "egyptian_colloquial", contentType: "short_video_script", rawInput: "سماعة بلوتوث بعزل ضوضاء وبطارية تدوم 24 ساعة" },
  },
];

// Updated intentionally only after a reviewed prompt change is accepted.
// Values are character counts because they are deterministic across providers;
// estimated tokens are exposed for reporting, not used as an exact tokenizer.
export const PROMPT_BUDGET_BASELINE: Record<string, number> = {
  "tiktok-egyptian-post": 3871,
  "instagram-gulf-product": 3827,
  "linkedin-formal-b2b": 3571,
  "x-saudi-ad": 3805,
  "facebook-white-real-estate": 3597,
  "tiktok-video": 5336,
};

export function estimatePromptTokens(characters: number): number {
  return Math.ceil(characters / 4);
}

export function measurePromptBudget(
  buildPrompt: (input: InputDTO) => string,
  maxGrowthPercent = PROMPT_MAX_GROWTH_PERCENT,
): PromptBudgetResult {
  const measurements = PROMPT_BUDGET_MATRIX.map(({ id, input }) => {
    const characters = buildPrompt(input).length;
    const baselineCharacters = PROMPT_BUDGET_BASELINE[id];
    const growthPercent = baselineCharacters === 0
      ? 0
      : ((characters - baselineCharacters) / baselineCharacters) * 100;

    return {
      id,
      characters,
      estimatedTokens: estimatePromptTokens(characters),
      baselineCharacters,
      growthPercent,
      withinBudget: baselineCharacters === 0 || growthPercent <= maxGrowthPercent,
    };
  });

  const violations = measurements
    .filter((measurement) => !measurement.withinBudget)
    .map((measurement) => `${measurement.id}: +${measurement.growthPercent.toFixed(1)}%`);

  return {
    measurements,
    totalCharacters: measurements.reduce((sum, measurement) => sum + measurement.characters, 0),
    estimatedTokens: measurements.reduce((sum, measurement) => sum + measurement.estimatedTokens, 0),
    violations,
  };
}
