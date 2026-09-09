// ---------------------------------------------------------------------------
// Platforms (NEW - V2)
// ---------------------------------------------------------------------------

export const PLATFORMS_V2 = [
  // Tier 1
  "tiktok",
  "instagram",
  "facebook",
  "linkedin",
  "x",
  "youtube",
  // Tier 2 (Supported in types, hidden in UI for now)
  "whatsapp",
  "threads",
  "snapchat",
] as const;

export type PlatformV2 = (typeof PLATFORMS_V2)[number];

// ---------------------------------------------------------------------------
// Platform Formats (NEW - V2)
// ---------------------------------------------------------------------------
export type PlatformFormat =
  | "video" | "image" | "carousel" | "spark_ad" | "ugc" | "live_script" // TikTok
  | "post" | "reel" | "story" | "story_sequence" // Instagram / Facebook
  | "text_post" | "image_post" | "document" | "poll" | "article" // LinkedIn
  | "thread" | "video_post" // X
  | "short" | "community_post"; // YouTube

// ---------------------------------------------------------------------------
// Content Types (V2)
// ---------------------------------------------------------------------------

export const CONTENT_TYPES_V2 = [
  "social_post",
  "advertisement",
  "product_description",
  "real_estate_listing",
  "video_script",
  "email",
  "thread",
  "carousel_copy",
  "story_sequence",
  "ugc_script",
  "landing_page_copy",
] as const;

export type ContentTypeV2 = (typeof CONTENT_TYPES_V2)[number];

// ---------------------------------------------------------------------------
// Content Mode (V2) - UI Concept
// ---------------------------------------------------------------------------
export type ContentMode = "marketing" | "creator" | "personal_creator";
export type GenerationMode = ContentMode;

// ---------------------------------------------------------------------------
// Engine Routing (V2) - Internal Architecture
// ---------------------------------------------------------------------------
export type GenerationPurpose = "thought" | "marketing";

export type CopyFramework = 
  | "benefit_led"
  | "pas"
  | "feature_benefit"
  | "auto";

export type MarketingToneId = 
  | "premium"
  | "friendly"
  | "professional"
  | "energetic"
  | "conversational"
  | "minimal"
  | "bold"
  | "playful";

// ---------------------------------------------------------------------------
// Creator Domain (V2)
// ---------------------------------------------------------------------------
export type CreatorIntent =
  | "insight"
  | "story"
  | "opinion"
  | "observation"
  | "lesson"
  | "question"
  | "contrarian"
  | "reflection"
  | "explainer"
  | "experiment";

export const CREATOR_INTENTS = [
  "insight",
  "story",
  "opinion",
  "observation",
  "lesson",
  "question",
  "contrarian",
  "reflection",
  "explainer",
  "experiment",
] as const;

export type OriginalityLevel = "safe" | "balanced" | "high" | "experimental";

export const ORIGINALITY_LEVELS = ["safe", "balanced", "high", "experimental"] as const;

export type GenerationStrategy = "direct" | "structured" | "experimental";

export interface CreatorSignature {
  preferredOpenings?: string[];
  preferredClosings?: string[];
  favoriteExpressions?: string[];
  sentenceRhythm?: "punchy" | "balanced" | "flowing";
  emojiPreference?: "none" | "minimal";
  paragraphLength?: "short" | "medium" | "long";
  forbiddenExpressions?: string[];
}

export type BeatType =
  | "hook"
  | "observation"
  | "tension"
  | "breakthrough"
  | "insight"
  | "conclusion"
  | "takeaway";

export interface ContentBeat {
  index: number;
  type: BeatType;
  description: string;
}

export interface CreatorBlueprint {
  hookStrategy: string;
  coreIdea: string;
  perspective: string;
  progression: ContentBeat[];
  emotionalArc?: string[];
  endingStrategy: string;
}

export interface CreatorConfig {
  persona?: PersonaConfig;
  style?: StyleConfig;
  intent?: CreatorIntent;
  originality?: OriginalityLevel;
  strategy?: GenerationStrategy;
  perspective?: string;
  recurringThemes?: string[];
  avoid?: string[];
  signature?: CreatorSignature;
  customInstructions?: string;
}

export interface NormalizedCreatorConfig {
  persona: NormalizedPersona;
  style: NormalizedStyle;
  intent: CreatorIntent;
  originality: OriginalityLevel;
  strategy: GenerationStrategy;
  perspective?: string;
  blueprint?: CreatorBlueprint;
  signature?: CreatorSignature;
  avoid: string[];
}

// ---------------------------------------------------------------------------
// Persona Domain (V2 - Personal Creator)
// ---------------------------------------------------------------------------
export type PersonaId = string;

export interface PersonaReasoningProfile {
  worldview: string[];
  reasoningPatterns: string[];
  attentionBiases: string[];
  evidencePreferences: string[];
  analogyDomains: string[];
  questionPatterns: string[];
  conclusionPatterns: string[];
  avoidances: string[];
}

export interface ContentPersona {
  id: PersonaId;
  name: string;
  description: string;
  reasoningProfile: PersonaReasoningProfile;
  enabled: boolean;
}

export interface PersonaConfig {
  id?: string;
  name?: string;
  description?: string;
  interests?: string[];
  characteristics?: string[];
  customInstructions?: string;
}

export interface NormalizedPersona {
  id: string;
  identity: string;
  interests: string[];
  traits: string[];
  voiceSignals: string[];
  contentPatterns: string[];
  vocabulary?: string[];
  avoid: string[];
  customInstructions?: string;
}

// ---------------------------------------------------------------------------
// Content Style Domain (V2)
// ---------------------------------------------------------------------------
export type StyleId = string;

export interface ContentStyleDefinition {
  id: StyleId;
  name: string;
  description: string;
  characteristics: string[];
  structure?: string[];
  rhetoricalDevices?: string[];
  visualDirection?: string[];
  avoid?: string[];
  enabled: boolean;
}

export interface StyleConfig {
  id?: string;
  name?: string;
  description?: string;
  characteristics?: string[];
  customInstructions?: string;
}

export interface NormalizedStyle {
  id: string;
  name: string;
  characteristics: string[];
  structure: string[];
  rhetoricalDevices: string[];
  avoid: string[];
  customInstructions?: string;
}

// ---------------------------------------------------------------------------
// Marketing Objective (V2)
// ---------------------------------------------------------------------------

export type MarketingObjectiveV2 =
  | "awareness"
  | "engagement"
  | "traffic"
  | "leads"
  | "sales"
  | "messages"
  | "app_installs"
  | "retention"
  | "community"
  | "education";

// ---------------------------------------------------------------------------
// Audience (NEW - V2)
// ---------------------------------------------------------------------------
export type AudienceAwareness =
  | "unaware"
  | "problem_aware"
  | "solution_aware"
  | "product_aware"
  | "most_aware";

export interface AudienceConfig {
  segment?: string;
  ageRange?: string;
  location?: string;
  interests?: string[];
  painPoints?: string[];
  awarenessLevel?: AudienceAwareness;
}

// ---------------------------------------------------------------------------
// Voice & Dialect (V2)
// ---------------------------------------------------------------------------
export type Language = "ar" | "en" | "bilingual";

export type DialectV2 =
  | "saudi"
  | "gulf"
  | "egyptian"
  | "levantine"
  | "maghrebi"
  | "white_arabic"
  | "msa";

export type Tone =
  | "professional"
  | "friendly"
  | "casual"
  | "premium"
  | "bold"
  | "playful"
  | "educational"
  | "authoritative"
  | "empathetic"
  | "urgent"
  | "inspirational";

export type ContentStyle =
  | "storytelling"
  | "direct_response"
  | "problem_solution"
  | "educational"
  | "listicle"
  | "comparison"
  | "testimonial"
  | "ugc"
  | "luxury"
  | "minimal"
  | "humorous"
  | "emotional";

export interface BrandVoice {
  personality?: string;
  vocabulary?: string;
  forbiddenWords?: string[];
  preferredExpressions?: string[];
  positioning?: string;
  examples?: string[];
}

// ---------------------------------------------------------------------------
// Constraints & Settings (V2)
// ---------------------------------------------------------------------------
export type LengthConstraint = "short" | "medium" | "long" | "custom" | number;

export type EmojiLevel = "none" | "minimal" | "moderate" | "high";

export interface HashtagConfig {
  enabled: boolean;
  count?: number;
  strategy?: "broad" | "niche" | "mixed";
}

export type CTAType =
  | "buy_now"
  | "shop_now"
  | "learn_more"
  | "visit_website"
  | "send_message"
  | "book_now"
  | "contact_us"
  | "sign_up"
  | "download"
  | "comment"
  | "share"
  | "save"
  | "follow"
  | "none"
  | "custom";

export interface CTAConfig {
  type: CTAType;
  customText?: string;
  strength?: "soft" | "medium" | "strong";
}

export interface ContentConstraints {
  maxLength?: number;
  minLength?: number;
  length?: LengthConstraint;
  hashtags?: HashtagConfig;
  emojiLevel?: EmojiLevel;
  cta?: CTAConfig;
  requiredTerms?: string[];
  forbiddenTerms?: string[];
  includeHook?: boolean;
}

export interface VideoConfig {
  duration?: 15 | 30 | 45 | 60 | number; // 'number' for custom
  aspectRatio?: "9:16" | "16:9" | "1:1";
  hookDuration?: number; // e.g. 3 seconds
  structure?: "hook_body_cta" | string;
  captions?: boolean;
  voiceover?: boolean;
  onScreenText?: boolean;
  shotInstructions?: boolean;
}

// ---------------------------------------------------------------------------
// VideoScript (structured output from parser / validator)
// ---------------------------------------------------------------------------

export interface VideoScene {
  index: number;       // 1-based scene number
  durationSec: number; // duration in whole seconds
  visual: string;      // on-screen visual direction
  audio: string;       // voiceover / audio direction
}

export interface VideoScript {
  scenes: VideoScene[];
  hook?: string;
}

// ---------------------------------------------------------------------------
// GenerationConfig (V2 Root Model)
// ---------------------------------------------------------------------------
export interface GenerationConfig {
  mode?: ContentMode;
  platform: PlatformV2;
  format: PlatformFormat;
  content: {
    type: ContentTypeV2;
    topic: string;
    sourceFacts?: string; // Optional context facts
  };
  objective: MarketingObjectiveV2;
  audience?: AudienceConfig;
  language: {
    language: Language;
    dialect?: DialectV2;
  };
  voice: {
    tone: Tone;
    style: ContentStyle;
  };
  creator?: CreatorConfig;
  persona?: PersonaConfig;
  styleConfig?: StyleConfig;
  brand?: {
    voice?: BrandVoice;
  };
  constraints: ContentConstraints;
  video?: VideoConfig;
}

// ---------------------------------------------------------------------------
// Normalized Config & Snapshot (V2)
// ---------------------------------------------------------------------------

export interface NormalizedGenerationConfig extends GenerationConfig {
  // Enforces that constraints are always fully resolved and populated
  constraints: Required<ContentConstraints>;
  // Other fields can be required as needed by the Prompt Builder
  factLedger?: FactLedger;
  normalizedCreator?: NormalizedCreatorConfig;
  normalizedPersona?: NormalizedPersona;
  normalizedStyle?: NormalizedStyle;
}

export type FactSource = "user_input" | "brand_data";

export type FactConfidence = "explicit" | "uncertain";

export type FactStatus = "verified" | "uncertain" | "conflicting" | "missing";

export type ClaimRisk = "low" | "medium" | "high" | "critical";

export type FactType =
  | "numeric"
  | "commercial"
  | "product"
  | "technical"
  | "location"
  | "date"
  | "duration"
  | "claim"
  | "general";

export interface Fact {
  id: string;
  key: string;
  value: string;
  type: FactType;
  source: FactSource;
  confidence: FactConfidence;
  status: FactStatus;
}

export interface FactLedger {
  explicit: Fact[];
  uncertain: Fact[];
  missing: string[];
  prohibitedClaims: string[];
}

export interface ConfigSnapshot {
  configVersion: string;
  timestamp: string;
  config: NormalizedGenerationConfig;
}

// ===========================================================================
// LEGACY TYPES (V1) - Kept for backward compatibility during Sprint 1
// ===========================================================================

export const PLATFORMS = [
  "tiktok",
  "instagram",
  "facebook",
  "linkedin",
  "x",
  "x_twitter",
  "youtube",
  "whatsapp",
  "threads",
  "snapchat",
] as const;

export type Platform = (typeof PLATFORMS)[number];

export const CONTENT_TYPES = [
  "sponsored_ad",
  "interactive_post",
  "ecommerce_product",
  "real_estate",
  "short_video_script",
  "marketing_email",
  "social_post",
  "advertisement",
  "product_description",
  "real_estate_listing",
  "video_script",
  "email",
  "thread",
  "carousel_copy",
  "story_sequence",
  "ugc_script",
  "landing_page_copy",
] as const;

export type ContentType = (typeof CONTENT_TYPES)[number];

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

export const ARABIC_STYLES = [
  "saudi_marketing",
  "gulf_premium",
  "egyptian_colloquial",
  "white_arabic",
  "formal_b2b",
] as const;

export type ArabicStyle = (typeof ARABIC_STYLES)[number];

export type MarketingObjective =
  | "sell"
  | "attract_messages"
  | "drive_traffic"
  | "launch_product"
  | "build_trust"
  | "generate_leads";

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
// Generated Content & API Responses (Shared V1 & V2)
// ---------------------------------------------------------------------------

export interface GeneratedContent {
  title: string;
  hook: string;
  body: string;
  callToAction: string;
  hashtags: string[];
}

export interface GenerationMetadata {
  model: string;
  provider: string;
  latencyMs: number;
  requestId: string;
  tokenUsage?: {
    promptTokens?: number;
    completionTokens?: number;
    totalTokens?: number;
    thoughtsTokens?: number;
  };
}

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
