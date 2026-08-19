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

// ---------------------------------------------------------------------------
// Claim Classes
// ---------------------------------------------------------------------------

export type ClaimClass =
  | "comparison"
  | "superiority"
  | "financial_return"
  | "guarantee"
  | "availability_scarcity"
  | "quantified_claim"
  | "location_distance"
  | "specification"
  | "price"
  | "payment_plan"
  | "legal_status"
  | "view"
  | "facilities"
  | "finishing"
  | "medical_claim"
  | "certification"
  | "discount";

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

// ---------------------------------------------------------------------------
// Marketing Objective (future — not exposed in MVP UI)
// ---------------------------------------------------------------------------

export type MarketingObjective =
  | "sell"
  | "attract_messages"
  | "drive_traffic"
  | "launch_product"
  | "build_trust"
  | "generate_leads";

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
  SESSION_MISSING: "SESSION_MISSING",
  RATE_LIMITED: "RATE_LIMITED",
  RATE_LIMIT_REACHED: "RATE_LIMIT_REACHED",
  GENERATION_FAILED: "GENERATION_FAILED",
  EMPTY_RESPONSE: "EMPTY_RESPONSE",
  OUTPUT_VALIDATION_FAILED: "OUTPUT_VALIDATION_FAILED",
  OUTPUT_SCHEMA_INVALID: "OUTPUT_SCHEMA_INVALID",
  CLAIM_VALIDATION_FAILED: "CLAIM_VALIDATION_FAILED",
  PERSISTENCE_FAILED: "PERSISTENCE_FAILED",
  MISSING_API_KEY: "MISSING_API_KEY",
  PROVIDER_ERROR: "PROVIDER_ERROR",
  TIMEOUT: "TIMEOUT",
  INTERNAL_ERROR: "INTERNAL_ERROR",
} as const;

export type ErrorCode = (typeof ERROR_CODES)[keyof typeof ERROR_CODES];

