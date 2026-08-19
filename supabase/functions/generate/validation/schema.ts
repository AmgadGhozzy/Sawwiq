import { z } from "npm:zod";
import { Type } from "npm:@google/genai";

// ---------------------------------------------------------------------------
// Input validation (Zod)
// ---------------------------------------------------------------------------

export const inputSchema = z.object({
  rawInput: z.string().min(10, "الوصف قصير جدًا").max(2000),
  platform: z.enum(["tiktok", "instagram", "linkedin", "x_twitter"]),
  contentType: z.enum([
    "sponsored_ad",
    "interactive_post",
    "ecommerce_product",
    "real_estate",
    "short_video_script",
    "marketing_email",
  ]),
  arabicStyle: z.enum([
    "saudi_marketing",
    "gulf_premium",
    "egyptian_colloquial",
    "white_arabic",
    "formal_b2b",
  ]),
});

export type InputDTO = z.infer<typeof inputSchema>;

// ---------------------------------------------------------------------------
// Gemini Output Schema
// ---------------------------------------------------------------------------

export const GEMINI_RESPONSE_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    title: { type: Type.STRING },
    hook: { type: Type.STRING },
    body: { type: Type.STRING },
    callToAction: { type: Type.STRING },
    hashtags: { type: Type.ARRAY, items: { type: Type.STRING } },
  },
  required: ["title", "hook", "body", "callToAction", "hashtags"],
};
