import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { analyzeBenchmark } from "../lib/evaluation/benchmarkAnalysis";
import type { BenchmarkReport } from "../lib/evaluation/types";

const failedResult = {
  testCaseId: "video-1",
  testCaseName: "Video",
  category: "video_script" as const,
  deterministic: { checks: [{ name: "videoScenesExist", passed: false }], score: 0, passed: false, details: [] },
  claimViolations: [],
  combinedScore: 0,
  latencyMs: 1,
};

describe("Benchmark analysis", () => {
  test("turns failures and semantic weaknesses into focused prompt recommendations", () => {
    const report: BenchmarkReport = {
      timestamp: "2026-01-01T00:00:00.000Z", model: "test", promptVersion: "1.1.0", datasetVersion: "1.1.0",
      experimentId: "exp-test", generationConfig: { temperature: 0.7, topP: 0.9 },
      totalCases: 1, passedCases: 0, overallDeterministicScore: 0, overallSemanticScore: 70, overallCombinedScore: 0,
      categoryScores: {}, dimensionAverages: { factuality: 80, hallucinationSafety: 90, overall: 70 }, results: [failedResult],
    };
    const analysis = analyzeBenchmark(report);
    assert.equal(analysis.failureReasons.videoScenesExist, 1);
    assert.ok(analysis.recommendedPromptEdits.some((edit) => edit.includes("short_video_script")));
    assert.ok(analysis.recommendedPromptEdits.some((edit) => edit.includes("Fact Boundary")));
    assert.equal(analysis.diagnoses[0].classification, "video_structure");
    assert.equal(analysis.groupComparison.Video.candidate, 0);
  });
});
