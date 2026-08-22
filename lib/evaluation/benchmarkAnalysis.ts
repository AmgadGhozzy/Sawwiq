import type { LegacyBenchmarkReport as BenchmarkReport, TestCaseResult } from "./types";
import { buildGroupScores } from "./benchmarkGroups";

export interface BenchmarkAnalysis {
  generatedAt: string;
  report: {
    promptVersion: string;
    datasetVersion: string;
    structuralPassRate: number;
    semanticAverage?: number;
  };
  failureReasons: Record<string, number>;
  categoryFailures: Record<string, number>;
  recurringFailures: string[];
  newRegressions: string[];
  semanticWeaknesses: Array<{ dimension: string; score: number }>;
  recommendedPromptEdits: string[];
  diagnoses: Array<{
    testCaseId: string;
    classification: "provider_error" | "fact_boundary" | "required_information_preservation" | "video_structure" | "evaluator_review";
    layer: string;
    needsHumanReview: boolean;
  }>;
  groupComparison: Record<string, { baseline: number; candidate: number; delta: number }>;
}

function failedCheckNames(result: TestCaseResult): string[] {
  return result.deterministic.checks
    .filter((check) => !check.passed)
    .map((check) => check.name);
}

function recommendationFor(reason: string): string | null {
  if (reason === "mustContain") {
    return "عدّل Input Context أو Output Contract: اطلب الحفاظ على كل التفاصيل الصريحة المهمة قبل الصياغة الإبداعية.";
  }
  if (reason === "mustNotContain" || reason === "claimViolation") {
    return "عدّل Fact Boundary: امنع تحويل المزايا إلى وعود أو نتائج أو أرقام غير مذكورة.";
  }
  if (reason.startsWith("hashtag")) {
    return "عدّل Output Contract: ثبّت عدد الهاشتاغات وصيغتها من دون # ومنع التكرار.";
  }
  if (reason.startsWith("video")) {
    return "عدّل Content Type: short_video_script وOutput Contract لتأكيد مشاهد متسلسلة مع [Visual] و[Audio].";
  }
  if (reason === "dialectAccuracy") {
    return "عدّل Arabic Style layer الخاص باللهجة المتأثرة، وأضف أمثلة قصيرة محلية بدل توسيع القواعد العامة.";
  }
  if (reason === "hookQuality" || reason === "ctaQuality") {
    return "عدّل Output Contract: اجعل الـ hook قائمًا على فضول أو مشكلة حقيقية، والـ CTA مرتبطًا بالمعلومة المتاحة فقط.";
  }
  if (reason === "factuality" || reason === "hallucinationSafety") {
    return "عدّل Fact Boundary أولًا: ارفع أولوية الحقائق الصريحة ومنع الاستنتاجات التي تبدو كحقائق.";
  }
  if (reason === "marketingQuality") {
    return "عدّل Global Rules أو Content Type layer: قدّم الفائدة المسموح استنتاجها بصياغة احتمالية بدل تكرار المواصفات.";
  }
  return null;
}

export function analyzeBenchmark(
  report: BenchmarkReport,
  baseline?: BenchmarkReport | null,
): BenchmarkAnalysis {
  const failureReasons: Record<string, number> = {};
  const categoryFailures: Record<string, number> = {};
  const recurringFailures: string[] = [];
  const newRegressions: string[] = [];
  const diagnoses: BenchmarkAnalysis["diagnoses"] = [];

  for (const result of report.results) {
    const failedChecks = failedCheckNames(result);
    const hasFailure = !result.deterministic.passed || result.claimViolations.length > 0 || Boolean(result.generationError);
    if (hasFailure) categoryFailures[result.category] = (categoryFailures[result.category] ?? 0) + 1;

    for (const name of failedChecks) failureReasons[name] = (failureReasons[name] ?? 0) + 1;
    if (result.claimViolations.length > 0) {
      failureReasons.claimViolation = (failureReasons.claimViolation ?? 0) + result.claimViolations.length;
    }
    if (result.generationError) {
      failureReasons.generationError = (failureReasons.generationError ?? 0) + 1;
      diagnoses.push({ testCaseId: result.testCaseId, classification: "provider_error", layer: "Provider", needsHumanReview: false });
    } else if (result.claimViolations.length > 0 || failedChecks.includes("mustNotContain")) {
      diagnoses.push({ testCaseId: result.testCaseId, classification: "fact_boundary", layer: "Fact Boundary", needsHumanReview: true });
    } else if (failedChecks.includes("mustContain")) {
      // A literal miss may be a benchmark-normalization issue, so it is never
      // an automatic prompt edit without reviewing the generated output.
      diagnoses.push({ testCaseId: result.testCaseId, classification: "required_information_preservation", layer: "Input Context", needsHumanReview: true });
    } else if (failedChecks.some((name) => name.startsWith("video"))) {
      diagnoses.push({ testCaseId: result.testCaseId, classification: "video_structure", layer: "Content Type: short_video_script", needsHumanReview: false });
    } else if (hasFailure) {
      diagnoses.push({ testCaseId: result.testCaseId, classification: "evaluator_review", layer: "Evaluator", needsHumanReview: true });
    }

    const previous = baseline?.results.find((item) => item.testCaseId === result.testCaseId);
    if (!previous) continue;
    const previouslyPassed = previous.deterministic.passed && previous.claimViolations.length === 0 && !previous.generationError;
    const currentlyPassed = result.deterministic.passed && result.claimViolations.length === 0 && !result.generationError;
    if (previouslyPassed && !currentlyPassed) newRegressions.push(result.testCaseId);
    if (!previouslyPassed && !currentlyPassed) recurringFailures.push(result.testCaseId);
  }

  const semanticWeaknesses = Object.entries(report.dimensionAverages ?? {})
    .filter(([dimension]) => dimension !== "overall")
    .map(([dimension, score]) => ({ dimension, score }))
    .filter(({ dimension, score }) => score < 85 || score < (baseline?.dimensionAverages?.[dimension] ?? 0))
    .sort((a, b) => a.score - b.score);

  const rankedReasons = [
    "claimViolation",
    "mustNotContain",
    "mustContain",
    ...Object.entries(failureReasons)
      .sort(([, left], [, right]) => right - left)
      .map(([reason]) => reason),
  ];
  const edits = [...rankedReasons, ...semanticWeaknesses.map(({ dimension }) => dimension)]
    .map(recommendationFor)
    .filter((edit): edit is string => edit !== null);

  const candidateGroups = report.benchmarkGroups ?? buildGroupScores(report.results);
  const baselineGroups = baseline?.benchmarkGroups ?? (baseline ? buildGroupScores(baseline.results) : {});
  const groupComparison = Object.fromEntries(Object.keys(candidateGroups).map((group) => {
    const candidate = candidateGroups[group].structuralPassRate;
    const baseline = baselineGroups[group]?.structuralPassRate ?? 0;
    return [group, { baseline, candidate, delta: candidate - baseline }];
  }));

  return {
    generatedAt: new Date().toISOString(),
    report: {
      promptVersion: report.promptVersion,
      datasetVersion: report.datasetVersion,
      structuralPassRate: report.overallDeterministicScore,
      semanticAverage: report.overallSemanticScore,
    },
    failureReasons,
    categoryFailures,
    recurringFailures,
    newRegressions,
    semanticWeaknesses,
    recommendedPromptEdits: Array.from(new Set(edits)).slice(0, 3),
    diagnoses,
    groupComparison,
  };
}
