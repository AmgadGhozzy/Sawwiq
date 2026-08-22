// ---------------------------------------------------------------------------
// PostGenerationValidator — unified extensible validation registry
//
// Architecture: each domain (claims, video, platform, brand, safety…) registers
// a named validator. The registry runs them in sequence and aggregates results.
// productionAdapter calls run() once — not multiple ad-hoc checks.
//
// Adding a new domain:
//   1. Implement PostGenerationValidator
//   2. Register it in defaultRegistry (or a custom registry)
// ---------------------------------------------------------------------------

import type { GeneratedContent } from "@/types/content";
import type { InputDTO } from "../../supabase/functions/generate/validation/schema.ts";

// ---------------------------------------------------------------------------
// Contract
// ---------------------------------------------------------------------------

export interface ValidatorResult {
  validatorName: string;
  passed: boolean;
  /** Machine-readable error codes produced by this validator. */
  codes: string[];
  /** Human-readable messages, one per violation. */
  messages: string[];
  /** Optional: domain-specific telemetry (metrics, repair info, etc.). */
  telemetry?: Record<string, unknown>;
}

export interface PostGenerationValidator {
  readonly name: string;
  validate(
    content: GeneratedContent,
    rawBody: string,
    input: InputDTO
  ): Promise<ValidatorResult> | ValidatorResult;
}

// ---------------------------------------------------------------------------
// Aggregate Result
// ---------------------------------------------------------------------------

export interface PostGenerationResult {
  passed: boolean;
  /** Results keyed by validator name, in execution order. */
  validatorResults: Record<string, ValidatorResult>;
  /** Flattened list of all violations across all validators. */
  allViolations: Array<{ validator: string; code: string; message: string }>;
}

// ---------------------------------------------------------------------------
// Registry
// ---------------------------------------------------------------------------

export class PostGenerationValidatorRegistry {
  private validators: PostGenerationValidator[] = [];

  register(validator: PostGenerationValidator): this {
    this.validators.push(validator);
    return this;
  }

  async run(
    content: GeneratedContent,
    rawBody: string,
    input: InputDTO
  ): Promise<PostGenerationResult> {
    const validatorResults: Record<string, ValidatorResult> = {};
    const allViolations: PostGenerationResult["allViolations"] = [];
    let passed = true;

    for (const validator of this.validators) {
      const result = await validator.validate(content, rawBody, input);
      validatorResults[validator.name] = result;

      if (!result.passed) {
        passed = false;
        for (let i = 0; i < result.codes.length; i++) {
          allViolations.push({
            validator: validator.name,
            code: result.codes[i],
            message: result.messages[i] ?? result.codes[i],
          });
        }
      }
    }

    return { passed, validatorResults, allViolations };
  }
}

// ---------------------------------------------------------------------------
// Built-in Validator Adapters
// ---------------------------------------------------------------------------

/**
 * Adapter: wraps the existing validateClaims function.
 * If contentType doesn't trigger claim validation, it passes trivially.
 */
export function makeClaimValidator(): PostGenerationValidator {
  return {
    name: "claim-validator",
    validate(content, _rawBody, input): ValidatorResult {
      // Lazy import to avoid circular deps at module load time
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { validateClaims } = require("../../supabase/functions/generate/validation/claimValidator.ts");
      const result = validateClaims(content, input);

      if (result.passed) {
        return { validatorName: "claim-validator", passed: true, codes: [], messages: [] };
      }

      const codes = result.violations.map((_: unknown, i: number) => `CLAIM_VIOLATION_${i + 1}`);
      const messages = result.violations.map((v: { reason: string }) => v.reason);
      return { validatorName: "claim-validator", passed: false, codes, messages };
    },
  };
}

/**
 * Adapter: wraps the videoValidator pipeline.
 * Only activates for contentType === "short_video_script".
 */
export function makeVideoStructureValidator(): PostGenerationValidator {
  return {
    name: "video-structure-validator",
    validate(content, rawBody, input): ValidatorResult {
      if (input.contentType !== "short_video_script") {
        return { validatorName: "video-structure-validator", passed: true, codes: [], messages: [] };
      }

      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { buildVideoValidationMetrics } = require("../evaluation/videoValidator");
      const metrics = buildVideoValidationMetrics(rawBody);

      const telemetry = metrics;

      if (metrics.finalValid) {
        return {
          validatorName: "video-structure-validator",
          passed: true,
          codes: [],
          messages: [],
          telemetry,
        };
      }

      const codes = metrics.violationCodesAfterRepair as string[];
      const messages = codes.map((c: string) => `Video structure violation: ${c}`);

      return {
        validatorName: "video-structure-validator",
        passed: false,
        codes,
        messages,
        telemetry,
      };
    },
  };
}

// ---------------------------------------------------------------------------
// Default Registry — used by productionAdapter
// ---------------------------------------------------------------------------

/**
 * Returns the default PostGenerationValidatorRegistry with all built-in
 * validators pre-registered. Order matters: claims first, then video structure.
 */
export function createDefaultRegistry(): PostGenerationValidatorRegistry {
  return new PostGenerationValidatorRegistry()
    .register(makeClaimValidator())
    .register(makeVideoStructureValidator());
}
