// ---------------------------------------------------------------------------
// videoEvaluator.ts — Static (no LLM) video compliance evaluator
//
// Runs the full parse → validate → repair → re-validate pipeline
// and returns a structured VideoComplianceResult for benchmarking.
// ---------------------------------------------------------------------------

import {
  parseVideoScript,
  validateVideoScript,
  enforceTiming,
  buildVideoValidationMetrics,
  type VideoViolation,
  type VideoValidationMetrics,
  type VideoScriptValidationOptions,
} from "./videoValidator";

// ---------------------------------------------------------------------------
// Result Types
// ---------------------------------------------------------------------------

export interface VideoComplianceResult {
  /** Body string fed to the evaluator. */
  rawBody: string;

  // --- Parse layer ---
  /** False = UNPARSEABLE_SCRIPT; all subsequent fields are null. */
  parseable: boolean;

  // --- Initial validation layer ---
  /** null if not parseable. */
  initialValid: boolean | null;
  initialViolations: VideoViolation[];

  // --- Repair layer ---
  repaired: boolean;
  /** Body after repair. null if parse failed or no repair attempted. */
  repairedBody: string | null;

  // --- Post-repair validation layer ---
  /** null if not parseable. */
  finalValid: boolean | null;
  finalViolations: VideoViolation[];

  /** Full telemetry snapshot. */
  metrics: VideoValidationMetrics;
}

// ---------------------------------------------------------------------------
// evaluateVideoCompliance
// ---------------------------------------------------------------------------

/**
 * Runs the full video compliance pipeline on a raw body string.
 * Never throws — all outcomes are captured in the returned result.
 */
export function evaluateVideoCompliance(
  rawBody: string,
  opts: VideoScriptValidationOptions = {}
): VideoComplianceResult {
  // --- Parse ---
  const initialParse = parseVideoScript(rawBody);

  if (!initialParse) {
    const metrics = buildVideoValidationMetrics(rawBody, opts);
    return {
      rawBody,
      parseable: false,
      initialValid: null,
      initialViolations: [],
      repaired: false,
      repairedBody: null,
      finalValid: null,
      finalViolations: [],
      metrics,
    };
  }

  // --- Initial validation ---
  const initialCheck = validateVideoScript(initialParse, rawBody, opts);

  if (initialCheck.passed) {
    const metrics = buildVideoValidationMetrics(rawBody, opts);
    return {
      rawBody,
      parseable: true,
      initialValid: true,
      initialViolations: [],
      repaired: false,
      repairedBody: null,
      finalValid: true,
      finalViolations: [],
      metrics,
    };
  }

  // --- Repair ---
  const repairedBody = enforceTiming(rawBody);
  const repairedParse = parseVideoScript(repairedBody);

  if (!repairedParse) {
    const metrics = buildVideoValidationMetrics(rawBody, opts);
    return {
      rawBody,
      parseable: true,
      initialValid: false,
      initialViolations: initialCheck.violations,
      repaired: true,
      repairedBody,
      finalValid: false,
      finalViolations: [{ code: "UNPARSEABLE_SCRIPT", message: "Body became unparseable after repair." }],
      metrics,
    };
  }

  // --- Post-repair validation ---
  const postRepairCheck = validateVideoScript(repairedParse, repairedBody, opts);
  const metrics = buildVideoValidationMetrics(rawBody, opts);

  return {
    rawBody,
    parseable: true,
    initialValid: false,
    initialViolations: initialCheck.violations,
    repaired: true,
    repairedBody,
    finalValid: postRepairCheck.passed,
    finalViolations: postRepairCheck.violations,
    metrics,
  };
}

// ---------------------------------------------------------------------------
// aggregateVideoResults — for benchmark reports
// ---------------------------------------------------------------------------

export interface VideoComplianceAggregate {
  total: number;

  // Parse layer
  parseableCount: number;
  parseSuccessRate: number;        // primary: parseable / total

  // Initial structural layer
  initialValidCount: number;
  initialPassRate: number;         // PRIMARY metric per user spec

  // Repair layer
  repairedCount: number;
  repairRate: number;              // repairs / parseable

  // Final layer
  finalValidCount: number;
  finalPassRate: number;

  // Safety
  hardFailureCount: number;        // parseable but failed even after repair
  hardFailureRate: number;

  // Violation distribution (across all initial violations)
  violationCodeDistribution: Record<string, number>;

  // Average violations before repair (among initially invalid)
  avgViolationsBeforeRepair: number;
}

export function aggregateVideoResults(
  results: VideoComplianceResult[]
): VideoComplianceAggregate {
  const total = results.length;
  if (total === 0) {
    return {
      total: 0,
      parseableCount: 0,
      parseSuccessRate: 0,
      initialValidCount: 0,
      initialPassRate: 0,
      repairedCount: 0,
      repairRate: 0,
      finalValidCount: 0,
      finalPassRate: 0,
      hardFailureCount: 0,
      hardFailureRate: 0,
      violationCodeDistribution: {},
      avgViolationsBeforeRepair: 0,
    };
  }

  const parseable = results.filter((r) => r.parseable);
  const parseableCount = parseable.length;

  const initialValid = results.filter((r) => r.initialValid === true);
  const repaired = results.filter((r) => r.repaired);
  const finalValid = results.filter((r) => r.finalValid === true);
  const hardFailures = results.filter((r) => r.parseable && r.finalValid === false);

  // Violation code distribution (before repair)
  const violationCodeDistribution: Record<string, number> = {};
  for (const r of results) {
    for (const v of r.initialViolations) {
      violationCodeDistribution[v.code] = (violationCodeDistribution[v.code] ?? 0) + 1;
    }
  }

  const initialInvalid = results.filter((r) => r.initialValid === false);
  const avgViolationsBeforeRepair =
    initialInvalid.length > 0
      ? initialInvalid.reduce((sum, r) => sum + r.initialViolations.length, 0) / initialInvalid.length
      : 0;

  const pct = (n: number, d: number) => (d === 0 ? 0 : Math.round((n / d) * 1000) / 10);

  return {
    total,
    parseableCount,
    parseSuccessRate: pct(parseableCount, total),
    initialValidCount: initialValid.length,
    initialPassRate: pct(initialValid.length, total),
    repairedCount: repaired.length,
    repairRate: pct(repaired.length, parseableCount),
    finalValidCount: finalValid.length,
    finalPassRate: pct(finalValid.length, total),
    hardFailureCount: hardFailures.length,
    hardFailureRate: pct(hardFailures.length, total),
    violationCodeDistribution,
    avgViolationsBeforeRepair: Math.round(avgViolationsBeforeRepair * 100) / 100,
  };
}
