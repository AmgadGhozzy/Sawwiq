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

const baseGenerateInputSchema = z.object({
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
  metadata: z.any().optional(),
  constraints: z
    .object({
      minLength: z.number().int().positive().optional(),
      maxLength: z.number().int().positive().optional(),
      forbiddenTerms: z.array(z.string()).optional(),
      requiredTerms: z.array(z.string()).optional(),
      customInstructions: z.string().optional(),
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

export const generateInputSchema = z.discriminatedUnion("mode", [
  baseGenerateInputSchema.extend({
    mode: z.literal("marketing"),
    tone: z.string().optional(),
    copyFramework: z.string().optional(),
    keyMessage: z.string().optional(),
  }),
  baseGenerateInputSchema.extend({
    mode: z.literal("creator"),
    intent: z.string().optional(),
    originality: z.string().optional(),
    persona: z.any().optional(),
    style: z.any().optional(),
  }),
  baseGenerateInputSchema.extend({
    mode: z.literal("personal_creator"),
    intent: z.string().optional(),
    originality: z.string().optional(),
    persona: z.any().optional(),
    style: z.any().optional(),
  }),
]);

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
