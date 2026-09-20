import { test, describe } from "node:test";
import assert from "node:assert";
import { ERROR_CODES } from "../types/content";
import {
  extractPipelineBErrorCode,
  normalizePipelineBError,
} from "../lib/utils/pipelineBErrors";

describe("Pipeline B Error Boundary", () => {
  describe("extractPipelineBErrorCode", () => {
    test("extracts flat string error", () => {
      const response = { error: "IR_SCHEMA_VIOLATION" };
      assert.strictEqual(extractPipelineBErrorCode(response), "IR_SCHEMA_VIOLATION");
    });

    test("extracts object with code", () => {
      const response = {
        error: { code: "RENDERER_LENGTH_VIOLATION", message: "Too long" },
      };
      assert.strictEqual(extractPipelineBErrorCode(response), "RENDERER_LENGTH_VIOLATION");
    });

    test("returns null for missing error", () => {
      const response = { success: false };
      assert.strictEqual(extractPipelineBErrorCode(response as any), null);
    });

    test("returns null for unknown error shape", () => {
      const response = { error: 500 };
      assert.strictEqual(extractPipelineBErrorCode(response as any), null);
      
      const response2 = { error: { msg: "Something" } };
      assert.strictEqual(extractPipelineBErrorCode(response2), null);
    });

    test("returns null for null response", () => {
      assert.strictEqual(extractPipelineBErrorCode(null), null);
      assert.strictEqual(extractPipelineBErrorCode(undefined), null);
    });
  });

  describe("normalizePipelineBError", () => {
    test("maps IR_SCHEMA_VIOLATION to GENERATION_FAILED", () => {
      assert.strictEqual(normalizePipelineBError("IR_SCHEMA_VIOLATION"), ERROR_CODES.GENERATION_FAILED);
    });

    test("maps CONTENT_VALIDATION_FAILED (internal usage simulation) to OUTPUT_VALIDATION_FAILED", () => {
      // If VALIDATION_ERROR is returned from renderer, it maps to OUTPUT_VALIDATION_FAILED
      assert.strictEqual(normalizePipelineBError("VALIDATION_ERROR"), ERROR_CODES.OUTPUT_VALIDATION_FAILED);
    });

    test("maps unknown errors to GENERATION_FAILED", () => {
      assert.strictEqual(normalizePipelineBError("UNKNOWN_ERROR_CODE"), ERROR_CODES.GENERATION_FAILED);
      assert.strictEqual(normalizePipelineBError("SOME_RANDOM_STRING"), ERROR_CODES.GENERATION_FAILED);
    });

    test("maps infrastructure errors to INTERNAL_ERROR", () => {
      assert.strictEqual(normalizePipelineBError("Pipeline B is currently disabled"), ERROR_CODES.INTERNAL_ERROR);
      assert.strictEqual(normalizePipelineBError("SERVICE_UNAVAILABLE"), ERROR_CODES.INTERNAL_ERROR);
    });

    test("keeps RATE_LIMIT_REACHED as RATE_LIMIT_REACHED", () => {
      assert.strictEqual(normalizePipelineBError("RATE_LIMIT_REACHED"), ERROR_CODES.RATE_LIMIT_REACHED);
    });
  });
});
