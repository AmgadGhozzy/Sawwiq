import type { MarketingToneId } from "@/types/content.ts";

export function resolveTone(arabicStyle: string, objective: string): MarketingToneId {
  const key = `${arabicStyle}_${objective}`;
  
  const TONE_MAP: Record<string, MarketingToneId> = {
    // Gulf Premium mappings
    "gulf_premium_sales": "premium",
    "gulf_premium_awareness": "premium",
    "gulf_premium_leads": "professional",
    "gulf_premium_engagement": "conversational",
    
    // Egyptian Colloquial mappings
    "egyptian_colloquial_sales": "friendly",
    "egyptian_colloquial_awareness": "conversational",
    "egyptian_colloquial_leads": "friendly",
    "egyptian_colloquial_engagement": "playful",
    
    // Saudi Marketing mappings
    "saudi_marketing_sales": "energetic",
    "saudi_marketing_awareness": "conversational",
    "saudi_marketing_leads": "professional",
    "saudi_marketing_engagement": "friendly",
    
    // White Arabic mappings
    "white_arabic_sales": "professional",
    "white_arabic_awareness": "conversational",
    "white_arabic_leads": "professional",
    "white_arabic_engagement": "friendly",
    
    // Formal B2B mappings
    "formal_b2b_sales": "professional",
    "formal_b2b_awareness": "professional",
    "formal_b2b_leads": "professional",
    "formal_b2b_engagement": "professional",
  };

  return TONE_MAP[key] ?? "conversational"; // safe default
}
