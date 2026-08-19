// ---------------------------------------------------------------------------
// Analytics Tracker — fire-and-forget, non-blocking
//
// The tracker MUST NEVER block or fail a generation.
// If analytics fail, they fail silently (logged server-side only).
// ---------------------------------------------------------------------------

import type { ProductEvent, AnalyticsEvent } from "./events";

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

export interface AnalyticsTracker {
  track(event: ProductEvent, properties?: Record<string, unknown>): void;
}

// ---------------------------------------------------------------------------
// Console implementation (development)
// ---------------------------------------------------------------------------

class ConsoleTracker implements AnalyticsTracker {
  track(event: ProductEvent, properties?: Record<string, unknown>): void {
    // Fire-and-forget — no await, no error propagation
    try {
      const analyticsEvent: AnalyticsEvent = {
        event,
        timestamp: Date.now(),
        properties,
      };

      if (process.env.NODE_ENV === "development") {
        console.log("[Analytics]", analyticsEvent);
      }
    } catch {
      // Swallow — analytics must never crash the app
    }
  }
}

// ---------------------------------------------------------------------------
// No-op implementation (production without analytics provider)
// ---------------------------------------------------------------------------

class NoopTracker implements AnalyticsTracker {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  track(_event: ProductEvent, _properties?: Record<string, unknown>): void {
    // Intentionally empty
  }
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

let _tracker: AnalyticsTracker | null = null;

export function getTracker(): AnalyticsTracker {
  if (_tracker) return _tracker;

  // Future: check env for PostHog/Vercel Analytics/Supabase config
  // and instantiate the appropriate tracker.
  _tracker =
    process.env.NODE_ENV === "development"
      ? new ConsoleTracker()
      : new NoopTracker();

  return _tracker;
}
