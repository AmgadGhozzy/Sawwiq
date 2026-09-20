import { test, describe } from "node:test";
import assert from "node:assert/strict";

import { getFailureInjection } from "../supabase/functions/planner/utils/failureInjector";

describe("Phase 3B.6.1 - Failure Injector Logic", () => {
  test("Returns null and silently ignores header if feature is disabled (Production behavior)", () => {
    // Feature disabled
    const result = getFailureInjection("planner_429", false);
    assert.strictEqual(result, null);
  });

  test("Returns null if header is not present (even if feature enabled)", () => {
    const result = getFailureInjection(null, true);
    assert.strictEqual(result, null);
  });

  test("Returns the requested scenario if valid and feature is enabled", () => {
    const result = getFailureInjection("renderer_length_violation", true);
    assert.strictEqual(result, "renderer_length_violation");
  });

  test("Throws error if scenario is invalid (to catch typos during staging tests)", () => {
    assert.throws(
      () => getFailureInjection("some_hacked_scenario", true),
      /FailureInjector: Unknown scenario/
    );
  });

  test("Handles whitespace in the header value", () => {
    const result = getFailureInjection("  db_persistence_failure  ", true);
    assert.strictEqual(result, "db_persistence_failure");
  });
});
