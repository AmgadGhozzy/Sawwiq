// ---------------------------------------------------------------------------
// Evaluation Types — deterministic + semantic scoring, versioned reports
// ---------------------------------------------------------------------------

import type { ArabicStyle, ContentType, GeneratedContent } from "@/types/content";

// ---------------------------------------------------------------------------
// Test Case Categories
// ---------------------------------------------------------------------------

export type EvaluationCategory =
  | "real_estate"
  | "product"
  | "product_collection"
  | "poor_input"
  | "incomplete_input"
  | "mixed_language"
  | "dialect_stress"
  | "video_script";

// ---------------------------------------------------------------------------
// Test Case Expectations (deterministic assertions)
// ---------------------------------------------------------------------------

export interface TestCaseExpectations {
  /** Strings that MUST appear somewhere in the generated content. */
  mustContain?: string[];
  /** Strings that MUST NOT appear in the generated content. */
  mustNotContain?: string[];
  /** Minimum number of hashtags (defaults to 5). */
  minHashtags?: number;
  /** Maximum number of hashtags (defaults to 8). */
  maxHashtags?: number;
}

// ---------------------------------------------------------------------------
// Test Case Definition
// ---------------------------------------------------------------------------

export interface EvaluationTestCase {
  id: string;
  category: EvaluationCategory;
  name: string;
  input: {
    contentType: ContentType;
    arabicStyle: ArabicStyle;
    rawInput: string;
  };
  /** Human-readable criteria (used by semantic judge). */
  criteria: string[];
  /** Machine-checkable expectations (used by deterministic evaluator). */
  expectations?: TestCaseExpectations;
}

// ---------------------------------------------------------------------------
// Deterministic Score (Level 1 — code-based, no API calls)
// ---------------------------------------------------------------------------

export interface DeterministicCheck {
  name: string;
  passed: boolean;
  detail?: string;
}

export interface DeterministicScore {
  checks: DeterministicCheck[];
  /** 0-100 percentage of checks passed. */
  score: number;
  /** True only if ALL checks pass. */
  passed: boolean;
  /** Human-readable list of failures. */
  details: string[];
}

// ---------------------------------------------------------------------------
// Semantic Score (Level 2 — LLM-as-judge, requires API call)
// ---------------------------------------------------------------------------

export interface SemanticScore {
  factuality: number;
  dialectAccuracy: number;
  marketingQuality: number;
  readability: number;
  hookQuality: number;
  ctaQuality: number;
  hallucinationSafety: number;
  overall: number;
  violations: string[];
}

// ---------------------------------------------------------------------------
// Per–Test Case Result
// ---------------------------------------------------------------------------

export interface TestCaseResult {
  testCaseId: string;
  testCaseName: string;
  category: EvaluationCategory;
  deterministic: DeterministicScore;
  semantic?: SemanticScore;
  claimViolations: string[];
  /** Structural gate → 0 if schema invalid; else 40% det + 60% sem. */
  combinedScore: number;
  latencyMs: number;
  /** Optionally persisted when --save-output is passed. */
  output?: GeneratedContent;
}

// ---------------------------------------------------------------------------
// Benchmark Report (versioned, persisted to JSON)
// ---------------------------------------------------------------------------

export interface BenchmarkReport {
  timestamp: string;
  model: string;
  promptVersion: string;
  datasetVersion: string;
  totalCases: number;
  passedCases: number;
  overallDeterministicScore: number;
  overallSemanticScore?: number;
  overallCombinedScore: number;
  results: TestCaseResult[];
  /** Per-dimension averages (only when semantic evaluation is run). */
  dimensionAverages?: Record<string, number>;
  categoryScores: Record<
    string,
    {
      total: number;
      averageDeterministic: number;
      averageSemantic?: number;
    }
  >;
}
