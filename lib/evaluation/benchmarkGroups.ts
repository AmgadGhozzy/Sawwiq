import type { EvaluationCategory, TestCaseResult } from "./types";

export const BENCHMARK_GROUPS = {
  "Core Content": ["real_estate", "product", "product_collection"],
  "Input Robustness": ["incomplete_input", "poor_input", "mixed_language"],
  Language: ["dialect_stress"],
  Video: ["video_script"],
} as const satisfies Record<string, EvaluationCategory[]>;

export function getBenchmarkGroup(category: EvaluationCategory): keyof typeof BENCHMARK_GROUPS {
  const match = Object.entries(BENCHMARK_GROUPS).find(([, categories]) =>
    (categories as readonly EvaluationCategory[]).includes(category),
  );
  if (!match) throw new Error(`No benchmark group configured for ${category}`);
  return match[0] as keyof typeof BENCHMARK_GROUPS;
}

export function buildGroupScores(results: TestCaseResult[]) {
  return Object.fromEntries(Object.keys(BENCHMARK_GROUPS).map((group) => {
    const groupResults = results.filter((result) => getBenchmarkGroup(result.category) === group);
    const passed = groupResults.filter((result) =>
      result.deterministic.passed && result.claimViolations.length === 0 && !result.generationError,
    ).length;
    const semanticScores = groupResults.flatMap((result) => result.semantic ? [result.semantic.overall] : []);
    return [group, {
      total: groupResults.length,
      passed,
      structuralPassRate: groupResults.length === 0 ? 0 : Math.round((passed / groupResults.length) * 100),
      semanticAverage: semanticScores.length === 0
        ? undefined
        : Math.round(semanticScores.reduce((sum, score) => sum + score, 0) / semanticScores.length),
    }];
  }));
}
