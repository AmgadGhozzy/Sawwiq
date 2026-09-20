// ---------------------------------------------------------------------------
// Analytics Event Types
// ---------------------------------------------------------------------------

export const PRODUCT_EVENTS = [
  "generation_failed",
  "generation_started",
  "generation_succeeded",
  "content_copied",
  "section_copied",
  "regeneration_requested",
  "rate_limit_reached",
  "auth_modal_shown",
  "credit_refunded",
  "credit_bonus_received",
  "email_verification_completed",
  "login_started",
  "login_failed",
  "signup_verification_required",
] as const;

export type ProductEvent = (typeof PRODUCT_EVENTS)[number];

export interface AnalyticsEvent {
  event: ProductEvent;
  timestamp: number;
  properties?: Record<string, unknown>;
}
