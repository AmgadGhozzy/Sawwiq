// ---------------------------------------------------------------------------
// Validation Schemas — Zod schemas for input and output validation
//
// The output schema is the SINGLE SOURCE OF TRUTH for the content contract.
// The Gemini provider derives its responseSchema from the shared field
// descriptions exported here — never define them independently.
// ---------------------------------------------------------------------------

import { z } from "zod";
import { CONTENT_TYPES, ARABIC_STYLES, PLATFORMS } from "@/types/content";
import { aiConfig } from "@/lib/config";

// ---------------------------------------------------------------------------
// Input Validation
// ---------------------------------------------------------------------------

export const generateInputSchema = z.object({
  platform: z.enum(PLATFORMS, {
    errorMap: () => ({ message: "المنصة غير صحيحة." }),
  }),
  contentType: z.enum(CONTENT_TYPES, {
    errorMap: () => ({ message: "نوع المحتوى غير صحيح." }),
  }),
  arabicStyle: z.enum(ARABIC_STYLES, {
    errorMap: () => ({ message: "أسلوب اللغة غير صحيح." }),
  }),
  rawInput: z
    .string()
    .trim()
    .min(10, "المحتوى قصير جدًا. اكتب على الأقل 10 أحرف.")
    .max(
      aiConfig.maxInputLength,
      `المحتوى طويل جدًا. الحد الأقصى ${aiConfig.maxInputLength} حرف.`
    ),
});

export type GenerateInputDTO = z.infer<typeof generateInputSchema>;

// ---------------------------------------------------------------------------
// Content Field Descriptions — shared between Zod and Gemini schemas
//
// If you add a field here, add it to generatedContentSchema below AND
// handle its type in the Gemini schema derivation in gemini.ts.
// ---------------------------------------------------------------------------

export const CONTENT_FIELD_DESCRIPTIONS = {
  title: "عنوان جذاب وقصير",
  hook: "جملة افتتاحية تشد الانتباه",
  body: "المحتوى الرئيسي",
  callToAction: "دعوة واضحة للعمل",
  hashtags: "هاشتاغات مرتبطة بالموضوع",
} as const;

// ---------------------------------------------------------------------------
// Output Validation (validate AI response)
//
// Contract: 5-8 unique hashtags without #. This matches the prompt
// instructions exactly — no "robustness" fallbacks that break the contract.
// ---------------------------------------------------------------------------

export const generatedContentSchema = z.object({
  title: z.string().min(1, "العنوان مطلوب."),
  hook: z.string().min(1, "الـ Hook مطلوب."),
  body: z.string().min(1, "المحتوى مطلوب."),
  callToAction: z.string().min(1, "دعوة العمل مطلوبة."),
  hashtags: z
    .array(z.string().min(1))
    .min(5, "الحد الأدنى 5 هاشتاغات.")
    .max(8, "الحد الأقصى 8 هاشتاغات.")
    .refine(
      (tags) => tags.every((tag) => !tag.includes("#")),
      "الهاشتاغات يجب ألا تحتوي على #"
    )
    .refine(
      (tags) => new Set(tags.map((t) => t.trim())).size === tags.length,
      "الهاشتاغات يجب ألا تكون مكررة"
    ),
});
