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
  mode: z.enum(["marketing", "creator", "personal_creator"]).optional(),
  platform: z.enum(PLATFORMS, {
    errorMap: () => ({ message: "المنصة غير صحيحة." }),
  }),
  contentType: z.enum(CONTENT_TYPES, {
    errorMap: () => ({ message: "نوع المحتوى غير صحيح." }),
  }),
  arabicStyle: z.enum(ARABIC_STYLES, {
    errorMap: () => ({ message: "أسلوب اللغة غير صحيح." }),
  }),
  marketingObjective: z.string().optional(),
  format: z.string().optional(),
  intent: z.string().optional(),
  originality: z.string().optional(),
  persona: z
    .object({
      id: z.string().optional(),
      name: z.string().optional(),
      description: z.string().optional(),
      interests: z.array(z.string()).optional(),
      characteristics: z.array(z.string()).optional(),
      customInstructions: z.string().optional(),
    })
    .optional(),
  style: z
    .object({
      id: z.string().optional(),
      name: z.string().optional(),
      description: z.string().optional(),
      characteristics: z.array(z.string()).optional(),
      customInstructions: z.string().optional(),
    })
    .optional(),
  metadata: z
    .object({
      brandName: z.string().optional(),
      targetAudience: z.string().optional(),
      marketingObjective: z.string().optional(),
      persona: z.any().optional(),
      style: z.any().optional(),
      intent: z.string().optional(),
      originality: z.string().optional(),
    })
    .optional(),
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
// Contract: up to 8 unique non-empty hashtags without #. Hashtag COUNT is
// platform-aware and enforced via prompts (e.g. X allows 0-2, or none for
// native-feeling threads), so no global minimum is enforced here.
// ---------------------------------------------------------------------------

export const generatedContentSchema = z.object({
  title: z.string().min(1, "العنوان مطلوب."),
  hook: z.string().min(1, "الـ Hook مطلوب."),
  body: z.string().min(1, "المحتوى مطلوب."),
  callToAction: z.string().min(1, "دعوة العمل مطلوبة."),
  hashtags: z
    .array(z.string().min(1))
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
