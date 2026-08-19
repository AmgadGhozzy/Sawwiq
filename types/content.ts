// ---------------------------------------------------------------------------
// Platforms (NEW)
// ---------------------------------------------------------------------------

export const PLATFORMS = [
  "tiktok",
  "instagram",
  "linkedin",
  "x_twitter",
] as const;

export type Platform = (typeof PLATFORMS)[number];

export const PLATFORM_LABELS: Record<Platform, string> = {
  tiktok: "تيك توك / ريلز",
  instagram: "انستجرام",
  linkedin: "لينكد إن",
  x_twitter: "إكس / تويتر",
};

// ---------------------------------------------------------------------------
// Content Types
// ---------------------------------------------------------------------------

export const CONTENT_TYPES = [
  "sponsored_ad",
  "interactive_post",
  "ecommerce_product",
  "real_estate",
  "short_video_script",
  "marketing_email",
] as const;

export type ContentType = (typeof CONTENT_TYPES)[number];

export const CONTENT_TYPE_LABELS: Record<ContentType, string> = {
  sponsored_ad: "إعلان ممول",
  interactive_post: "بوست تفاعلي",
  ecommerce_product: "وصف منتج",
  real_estate: "وصف عقاري",
  short_video_script: "سكريبت فيديو",
  marketing_email: "رسالة تسويقية",
};

// ---------------------------------------------------------------------------
// Claim Classes
// ---------------------------------------------------------------------------

export const CLAIM_CLASSES = [
  // Relational and Hallucination Prone
  "comparison",
  "superiority",
  "financial_return",
  "guarantee",
  "availability_scarcity",
  "quantified_claim",
  "location_distance",
  "specification",
  // Standard
  "price",
  "payment_plan",
  "legal_status",
  "view",
  "facilities",
  "finishing",
  "medical_claim",
  "certification",
  "discount",
] as const;

export type ClaimClass = (typeof CLAIM_CLASSES)[number];

// ---------------------------------------------------------------------------
// Arabic Styles (Dialects)
// ---------------------------------------------------------------------------

export const ARABIC_STYLES = [
  "saudi_marketing",
  "gulf_premium",
  "egyptian_colloquial",
  "white_arabic",
  "formal_b2b",
] as const;

export type ArabicStyle = (typeof ARABIC_STYLES)[number];

export const ARABIC_STYLE_LABELS: Record<ArabicStyle, string> = {
  saudi_marketing: "سعودي تسويقي",
  gulf_premium: "خليجي فخم",
  egyptian_colloquial: "مصري دارج",
  white_arabic: "عربية بيضاء",
  formal_b2b: "فصحى رسمية",
};

// ---------------------------------------------------------------------------
// Marketing Objective (future — not exposed in MVP UI)
// ---------------------------------------------------------------------------

export const MARKETING_OBJECTIVES = [
  "sell",
  "attract_messages",
  "drive_traffic",
  "launch_product",
  "build_trust",
  "generate_leads",
] as const;

export type MarketingObjective = (typeof MARKETING_OBJECTIVES)[number];

// ---------------------------------------------------------------------------
// Generation Input
// ---------------------------------------------------------------------------

export interface GenerationInput {
  platform: Platform;
  contentType: ContentType;
  arabicStyle: ArabicStyle;
  rawInput: string;
  metadata?: {
    brandName?: string;
    targetAudience?: string;
    marketingObjective?: MarketingObjective;
  };
}

// ---------------------------------------------------------------------------
// Generated Content (AI output contract)
// ---------------------------------------------------------------------------

export interface GeneratedContent {
  title: string;
  hook: string;
  body: string;
  callToAction: string;
  hashtags: string[];
}

// ---------------------------------------------------------------------------
// Generation Metadata (internal — not shown to user)
// ---------------------------------------------------------------------------

export interface GenerationMetadata {
  model: string;
  provider: string;
  latencyMs: number;
  requestId: string;
  tokenUsage?: {
    promptTokens?: number;
    completionTokens?: number;
    totalTokens?: number;
  };
}

// ---------------------------------------------------------------------------
// API Response (discriminated union)
// ---------------------------------------------------------------------------

export type GenerateResponse =
  | {
      success: true;
      data: GeneratedContent;
      remainingGenerations: number;
      meta: {
        requestId: string;
      };
    }
  | {
      success: false;
      error: {
        code: string;
        message: string;
      };
      meta: {
        requestId: string;
      };
    };

// ---------------------------------------------------------------------------
// Error Codes
// ---------------------------------------------------------------------------

export const ERROR_CODES = {
  VALIDATION_ERROR: "VALIDATION_ERROR",
  RATE_LIMITED: "RATE_LIMITED",
  RATE_LIMIT_REACHED: "RATE_LIMIT_REACHED",
  GENERATION_FAILED: "GENERATION_FAILED",
  OUTPUT_VALIDATION_FAILED: "OUTPUT_VALIDATION_FAILED",
  MISSING_API_KEY: "MISSING_API_KEY",
  PROVIDER_ERROR: "PROVIDER_ERROR",
  TIMEOUT: "TIMEOUT",
  INTERNAL_ERROR: "INTERNAL_ERROR",
} as const;

export type ErrorCode = (typeof ERROR_CODES)[keyof typeof ERROR_CODES];

// ---------------------------------------------------------------------------
// Arabic error messages
// ---------------------------------------------------------------------------

export const ERROR_MESSAGES: Record<ErrorCode, string> = {
  VALIDATION_ERROR: "البيانات المدخلة غير صحيحة. تأكد من ملء جميع الحقول المطلوبة.",
  RATE_LIMITED: "لقد تجاوزت الحد المسموح. حاول مرة أخرى بعد قليل.",
  RATE_LIMIT_REACHED: "لقد استنفدت محاولاتك المجانية الثلاث! سجّل في قائمة الانتظار للحصول على المزيد.",
  GENERATION_FAILED: "حدث خطأ أثناء إنشاء المحتوى. حاول مرة أخرى.",
  OUTPUT_VALIDATION_FAILED: "لم نتمكن من معالجة النتيجة. حاول مرة أخرى.",
  MISSING_API_KEY: "خدمة الذكاء الاصطناعي غير متاحة حاليًا.",
  PROVIDER_ERROR: "حدث خطأ في خدمة الذكاء الاصطناعي. حاول مرة أخرى.",
  TIMEOUT: "استغرقت العملية وقتًا طويلاً. حاول مرة أخرى.",
  INTERNAL_ERROR: "حدث خطأ غير متوقع. حاول مرة أخرى.",
};
