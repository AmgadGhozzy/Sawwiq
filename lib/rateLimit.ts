// ---------------------------------------------------------------------------
// Rate Limiter — interface + in-memory development fallback
//
// The memory implementation is NOT production-safe for serverless (each
// instance has its own memory). Switch to external (Redis/Upstash/Supabase)
// for production by setting RATE_LIMITER=external.
// ---------------------------------------------------------------------------

import { rateLimitConfig } from "./config";

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetMs: number;
}

export interface RateLimiter {
  check(identifier: string): Promise<RateLimitResult>;
}

// ---------------------------------------------------------------------------
// In-memory implementation (development fallback)
// ---------------------------------------------------------------------------

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

class MemoryRateLimiter implements RateLimiter {
  private store = new Map<string, RateLimitEntry>();
  private readonly windowMs: number;
  private readonly maxRequests: number;

  constructor(windowMs: number, maxRequests: number) {
    this.windowMs = windowMs;
    this.maxRequests = maxRequests;
  }

  async check(identifier: string): Promise<RateLimitResult> {
    const now = Date.now();
    const entry = this.store.get(identifier);

    // No entry or window expired — reset
    if (!entry || now >= entry.resetAt) {
      this.store.set(identifier, {
        count: 1,
        resetAt: now + this.windowMs,
      });
      return {
        allowed: true,
        remaining: this.maxRequests - 1,
        resetMs: this.windowMs,
      };
    }

    // Window still active
    if (entry.count >= this.maxRequests) {
      return {
        allowed: false,
        remaining: 0,
        resetMs: entry.resetAt - now,
      };
    }

    entry.count += 1;
    return {
      allowed: true,
      remaining: this.maxRequests - entry.count,
      resetMs: entry.resetAt - now,
    };
  }
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

let _rateLimiter: RateLimiter | null = null;

export function getRateLimiter(): RateLimiter {
  if (_rateLimiter) return _rateLimiter;

  if (rateLimitConfig.mode === "external") {
    // Future: instantiate Redis/Upstash/Supabase rate limiter
    // For now, fall back to memory with a warning
    console.warn(
      "[RateLimiter] external mode configured but not implemented — falling back to memory"
    );
  }

  _rateLimiter = new MemoryRateLimiter(
    rateLimitConfig.windowMs,
    rateLimitConfig.maxRequests
  );

  return _rateLimiter;
}
