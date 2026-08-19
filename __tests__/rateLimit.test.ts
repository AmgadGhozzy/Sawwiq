import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { getRateLimiter } from "../lib/rateLimit";

describe("Rate Limiter (Memory Fallback)", () => {
  test("allows requests under the limit", async () => {
    const limiter = getRateLimiter();
    const result1 = await limiter.check("test-client-1");
    assert.strictEqual(result1.allowed, true);
    assert.ok(result1.remaining >= 0);
  });

  test("tracks remaining count properly", async () => {
    const limiter = getRateLimiter();
    const id = `test-client-${Date.now()}`;
    const first = await limiter.check(id);
    assert.strictEqual(first.allowed, true);
    assert.strictEqual(first.remaining, 9); // 10 max - 1

    const second = await limiter.check(id);
    assert.strictEqual(second.allowed, true);
    assert.strictEqual(second.remaining, 8);
  });

  test("blocks requests exceeding maximum requests", async () => {
    const limiter = getRateLimiter();
    const id = `test-blocked-${Date.now()}`;
    
    // Consume all 10 requests
    for (let i = 0; i < 10; i++) {
      const res = await limiter.check(id);
      assert.strictEqual(res.allowed, true);
    }

    // 11th request must be blocked
    const blocked = await limiter.check(id);
    assert.strictEqual(blocked.allowed, false);
    assert.strictEqual(blocked.remaining, 0);
  });
});
