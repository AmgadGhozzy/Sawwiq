// ---------------------------------------------------------------------------
// Analytics Event Types
// ---------------------------------------------------------------------------

export const PRODUCT_EVENTS = [
  "generation_failed",
  "content_copied",
  "section_copied",
  "regeneration_requested",
] as const;

export type ProductEvent = (typeof PRODUCT_EVENTS)[number];

export interface AnalyticsEvent {
  event: ProductEvent;
  timestamp: number;
  properties?: Record<string, unknown>;
}
