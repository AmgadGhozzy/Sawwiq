import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { z } from "zod";
import { ERROR_CODES } from "../types/content";

const TEST_SESSION_ID = process.env.TEST_SESSION_ID || "e2e-test-session";

const baseHeaders = {
  "Content-Type": "application/json",
  "Cookie": `sawwiq_session=${TEST_SESSION_ID}`
};

const validPayload = {
  mode: "marketing",
  platform: "linkedin",
  format: "post",
  contentType: "interactive_post",
  arabicStyle: "egyptian_colloquial",
  marketingObjective: "engagement",
  rawInput: "تسويق شقق سكنية فاخرة في التجمع الخامس مع تسهيلات بالدفع",
};

async function executeApi(failureInject?: string) {
  const headers: Record<string, string> = { ...baseHeaders };
  if (failureInject) {
    headers["x-failure-inject"] = failureInject;
  }
  
  return fetch("http://localhost:3000/api/generate", {
    method: "POST",
    headers,
    body: JSON.stringify(validPayload)
  });
}

describe("Phase 6.2 - API E2E Layer A", () => {
  test("1. Happy Path - Marketing generation works and shape matches UI contract", async () => {
    const res = await executeApi();
    assert.strictEqual(res.status, 200, `Expected 200, got ${res.status}`);
    const json = await res.json();
    assert.strictEqual(json.success, true, "Expected success: true");
    assert.ok(json.meta?.requestId, "requestId must be present");
    
    // Runtime validation of shape expected by UI GenerationResult.tsx
    const resultSchema = z.object({
      title: z.string(),
      hook: z.string(),
      body: z.string(),
      callToAction: z.string(),
      hashtags: z.array(z.string())
    });
    
    const parseResult = resultSchema.safeParse(json.data);
    assert.strictEqual(parseResult.success, true, `Response data does not exactly match expected UI shape: ${parseResult.error?.message}`);
  });

  test("2. Soft validation failure -> Retry -> Success (Renderer)", async () => {
    const res = await executeApi("renderer_length_violation_retry_success");
    assert.strictEqual(res.status, 200, `Expected 200, got ${res.status}`);
    const json = await res.json();
    assert.strictEqual(json.success, true, "Expected success: true");
    // Ensure no error is exposed at all
    assert.strictEqual(json.error, undefined, "Expected no error to be present");
  });

  test("3. Soft validation failure -> Retry -> Failure (Planner)", async () => {
    const res = await executeApi("planner_topology_violation");
    assert.strictEqual(res.status, 500, `Expected 500, got ${res.status}`);
    const json = await res.json();
    assert.strictEqual(json.success, false, "Expected success: false");
    
    // Check canonical error code
    assert.strictEqual(json.error?.code, ERROR_CODES.GENERATION_FAILED);
    
    // Check for NO internal Pipeline B error leaks
    const stringified = JSON.stringify(json);
    assert.strictEqual(stringified.includes("PLANNER_"), false, "Leaked PLANNER_ code");
    assert.strictEqual(stringified.includes("IR_"), false, "Leaked IR_ code");
    assert.strictEqual(stringified.includes("TOPOLOGY_"), false, "Leaked TOPOLOGY_ code");
  });

  test("4. Hard Failure (Parser)", async () => {
    const res = await executeApi("planner_malformed_json");
    assert.strictEqual(res.status, 500, `Expected 500, got ${res.status}`);
    const json = await res.json();
    assert.strictEqual(json.success, false, "Expected success: false");
    assert.strictEqual(json.error?.code, ERROR_CODES.GENERATION_FAILED);
    
    const stringified = JSON.stringify(json);
    assert.strictEqual(stringified.includes("Planner LLM Output Validation Failed"), false, "Leaked raw parser error");
  });

  test("5. Unknown Pipeline Error -> Fallback to GENERATION_FAILED", async () => {
    const res = await executeApi("UNKNOWN_INTERNAL_ERROR");
    assert.strictEqual(res.status, 500, `Expected 500, got ${res.status}`);
    const json = await res.json();
    assert.strictEqual(json.success, false, "Expected success: false");
    assert.strictEqual(json.error?.code, ERROR_CODES.GENERATION_FAILED);
  });
});
