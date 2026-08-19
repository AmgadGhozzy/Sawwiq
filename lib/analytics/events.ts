// ---------------------------------------------------------------------------
// Analytics Event Types
// ---------------------------------------------------------------------------

export const PRODUCT_EVENTS = [
  "page_view",
  "generation_started",
  "generation_completed",
  "generation_failed",
  "content_copied",
  "section_copied",
  "regeneration_requested",
  "cta_clicked",
] as const;

export type ProductEvent = (typeof PRODUCT_EVENTS)[number];

export interface AnalyticsEvent {
  event: ProductEvent;
  timestamp: number;
  properties?: Record<string, unknown>;
}
