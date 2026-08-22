// ═══════════════════════════════════════════════════════════════
// EXP-004 Shared Types
// ═══════════════════════════════════════════════════════════════

export type PersonaId = "developer" | "psychology" | "intellectual" | "creative";
export type StyleId = "mystery" | "storytelling" | "contrarian";
export type PlatformId = "linkedin" | "x" | "instagram";

export const PERSONA_LETTER_MAP: Record<PersonaId, "A" | "B" | "C" | "D"> = {
  developer: "A",
  psychology: "B",
  intellectual: "C",
  creative: "D",
};

export const LETTER_PERSONA_MAP: Record<"A" | "B" | "C" | "D", PersonaId> = {
  A: "developer",
  B: "psychology",
  C: "intellectual",
  D: "creative",
};

export interface Topic {
  id: string;
  prompt: string;
}

export interface GeneratedContent {
  title: string;
  hook: string;
  body: string;
  callToAction: string;
  hashtags: string[];
}

// ── Per-case result ─────────────────────────────────────────────

export interface PersonaEvaluation {
  predicted_persona: "A" | "B" | "C" | "D";
  confidence_score: number;
  reasoning_pattern_detected: string;
  is_relying_on_cheap_keywords: boolean;
  is_correct: boolean; // filled after comparing predicted vs actual
  // 3D.1.1 — Dimensional scores (0-100 each)
  worldview_match?: number;
  reasoning_match?: number;
  evidence_match?: number;
  conclusion_match?: number;
  /** 0 = pure structural classification; 100 = topic drove the prediction */
  topic_leakage_risk?: number;
}

export interface AblationEvaluation {
  ablatedText: string;
  predicted_persona: "A" | "B" | "C" | "D";
  confidence_score: number;
  is_correct: boolean;
}

export interface PairwiseResult {
  pair: [PersonaId, PersonaId];
  topic: string;
  platform: PlatformId;
  separation_score: number;
  is_just_vocabulary_swap: boolean;
  perspective_difference: string;
  reasoning_difference: string;
  voice_difference: string;
}

export interface GenericnessEvaluation {
  score: number;
  detectedPatterns: string[];
  openingSpecificity: number;
}

export interface FactEvaluation {
  hasCriticalFailure: boolean;
  unsupportedClaimsCount: number;
  notes: string;
}

export interface StructuralEvaluation {
  passed: boolean;
  issues: string[];
}

export interface BenchmarkCaseResult {
  caseId: string;
  persona: PersonaId;
  style: StyleId;
  platform: PlatformId;
  topic: Topic;

  promptVersion: string;
  promptTokenEstimate: number;
  baselineTokenEstimate: number;

  generatedContent: GeneratedContent;

  personaEvaluation: PersonaEvaluation;
  /** Vocabulary Ablation Test result — undefined if ablation step failed */
  ablationEvaluation?: AblationEvaluation;
  genericnessEvaluation: GenericnessEvaluation;
  factEvaluation: FactEvaluation;
  structuralEvaluation: StructuralEvaluation;

  timestamp: string;
}

// ── Report ───────────────────────────────────────────────────────

export interface BenchmarkSummary {
  personaClassificationAccuracy: number;   // % of correct blind classifications
  ablationAccuracy: number;                // % still correct after vocabulary ablation
  avgPersonaSeparationScore: number;        // avg pairwise score
  avgGenericnessScore: number;              // lower = better
  avgOpeningSpecificity: number;            // higher = better
  criticalFactFailures: number;             // must be 0
  structuralPassRate: number;               // %
  promptGrowthPercent: number;              // % token growth vs baseline

  gates: {
    personaClassification: boolean;    // actual ≥ 75%
    personaSeparation: boolean;        // avg ≥ 80
    genericnessScore: boolean;         // avg ≤ 60
    criticalFactFailures: boolean;     // = 0
    structuralCompliance: boolean;     // ≥ 98%
    promptGrowth: boolean;             // ≤ 10%
  };
  overallPass: boolean;
}

export interface BenchmarkReport {
  experiment: string;
  promptVersion: string;
  totalCases: number;
  timestamp: string;
  cases: BenchmarkCaseResult[];
  pairwiseResults: PairwiseResult[];
  summary: BenchmarkSummary;
}

// ═══════════════════════════════════════════════════════════════
// LEGACY — run-benchmark.ts / evaluator.ts / benchmarkAnalysis.ts
// These types belong to the original marketing benchmark system,
// kept here to avoid breaking existing files during the EXP-004 refactor.
// ═══════════════════════════════════════════════════════════════

export type EvaluationCategory =
  | "real_estate"
  | "product"
  | "product_collection"
  | "incomplete_input"
  | "poor_input"
  | "mixed_language"
  | "dialect_stress"
  | "video_script";

export interface DeterministicCheck {
  name: string;
  passed: boolean;
  detail?: string;
}

export interface DeterministicScore {
  passed: boolean;
  score: number;
  checks: DeterministicCheck[];
}

export interface SemanticScore {
  overall: number;
  factuality: number;
  dialectAccuracy: number;
  marketingQuality: number;
  readability: number;
  hookQuality: number;
  ctaQuality: number;
  hallucinationSafety: number;
}

export interface TestCaseExpectations {
  mustContain?: string[];
  mustNotContain?: string[];
  minHashtags?: number;
  maxHashtags?: number;
}

export interface TestCaseResult {
  testCaseId: string;
  category: EvaluationCategory;
  deterministic: DeterministicScore;
  semantic?: SemanticScore;
  claimViolations: string[];
  generationError?: string;
}

export interface LegacyBenchmarkReport {
  promptVersion: string;
  datasetVersion: string;
  overallDeterministicScore: number;
  overallSemanticScore?: number;
  dimensionAverages?: Record<string, number>;
  results: TestCaseResult[];
  benchmarkGroups?: Record<string, {
    total: number;
    passed: number;
    structuralPassRate: number;
    semanticAverage?: number;
  }>;
}
