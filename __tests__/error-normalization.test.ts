import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { ERROR_CODES } from "../types/content";

describe("Error Code Normalization", () => {
  test("every ERROR_CODES value equals its key", () => {
    for (const [key, value] of Object.entries(ERROR_CODES)) {
      assert.strictEqual(key, value, `ERROR_CODES.${key} should equal "${key}" but got "${value}"`);
    }
  });
});
