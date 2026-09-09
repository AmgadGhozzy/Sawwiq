import { PlannerRequestDTO, normalizeAndEnforceInvariants, IR_SCHEMA_VERSION } from "../planner/validation.ts";
import { buildPlannerPrompt } from "../planner/thought/plannerPrompt.ts";
import { buildRendererPrompt } from "../planner/thought/thoughtRendererPrompt.ts";
import { buildMarketingPlannerPrompt } from "../planner/marketing/marketingPlannerPrompt.ts";
import { buildMarketingRendererPrompt } from "../planner/marketing/marketingRendererPrompt.ts";
import { parsePlannerOutput, parseRendererOutput } from "../planner/output/parser.ts";
import { compileIRGraph } from "../planner/ir/compiler.ts";
import { MARKETING_TOPOLOGIES } from "../planner/marketing/topologies.ts";
import { resolveFramework } from "../planner/marketing/frameworkResolver.ts";
import { validateRenderedContent, ValidationResult, ValidationSignal } from "../planner/output/validator.ts";
import { GeneratedContent } from "../../types/content.ts";
import { aiConfig } from "../config.ts";
import { createVertexAIClient } from "../ai/googleClient.ts";
import { TOPOLOGY_REQUIRED } from "../content/personas/topologyDefinitions.ts";
import type { NormalizedPlannerRequest, IRGraph, MarketingIRGraph, IRAngle } from "../planner/types.ts";

// ---------------------------------------------------------------------------
// Hard failures that warrant a single retry — explicit whitelist.
// LENGTH_EXCEEDED is NOT in this set (it's a soft signal, user trims manually).
// CLICHE_DENSITY is NOT retried: the model rarely fixes stylistic patterns on
// its own, and the signal is not deterministic enough to justify the cost.
// OBJECTIVE_MISMATCH and PLATFORM_FIT are soft-only and never trigger retry.
// ---------------------------------------------------------------------------
const RETRYABLE_HARD_FAILURES = new Set([
  "MISSING_FIELD",
  "HALLUCINATED_CLAIM",
  "FORBIDDEN_TERM",
  "FORMATTING_ARTIFACT",
]);

const PLATFORM_MAX_LENGTHS: Record<string, number> = {
  x: 280,
  instagram: 2200,
  facebook: 1500,
  linkedin: 2800,
};

export interface LocalPipelineResult {
  success: boolean;
  content?: GeneratedContent;
  firstPassSuccess: boolean;
  /** true when a retryable hard failure triggered a second renderer call */
  retryUsed: boolean;
  /** reason for the retry, if any */
  retryReason?: "hard_failure";
  error?: string;
  failureSignals: ValidationSignal[];
  allValidationPasses: ValidationResult[];
  plannerOutputRaw?: string;
  rendererOutputRaw?: string;
  lengths?: {
    effective: number;
    irLength: number;
    rawFirstPass: number;
    finalFirstPass: number;
    expansionRatioFirstPass: number;
    rawRetry?: number;
    finalRetry?: number;
    expansionRatioRetry?: number;
  };
}

export async function runPlannerLocal(request: PlannerRequestDTO): Promise<LocalPipelineResult> {
  const client = createVertexAIClient();
  const modelName = process.env.GEMINI_MODEL || "gemini-2.5-flash-lite";
  const allValidationPasses: ValidationResult[] = [];

  // 0. Normalize — single source of truth for structural invariants
  let normalized: NormalizedPlannerRequest;
  try {
    normalized = normalizeAndEnforceInvariants(request);
  } catch (error: any) {
    return { success: false, firstPassSuccess: false, retryUsed: false, error: `Normalization Error: ${error.message}`, failureSignals: [], allValidationPasses };
  }

  const isMarketing = normalized.purpose === "marketing";

  // 1. Planner Phase — route to correct prompt builder
  const plannerPrompt = isMarketing && !normalized.useLegacyEngine ? buildMarketingPlannerPrompt(normalized) : buildPlannerPrompt(normalized);

  let plannerRaw = "";
  let irGraph: IRGraph;
  try {
    const plannerRes = await client.models.generateContent({
      model: modelName,
      contents: plannerPrompt,
      config: { temperature: aiConfig.temperature, responseMimeType: "application/json" }
    });
    plannerRaw = plannerRes.text || "";
    const parsedPlanner = parsePlannerOutput(plannerRaw);

    if (isMarketing) {
      // Marketing: build IR from marketing topologies
      const framework = normalized.copyFramework === "auto"
        ? resolveFramework(normalized.objective)
        : (normalized.copyFramework ?? "benefit_led");
      const topology = MARKETING_TOPOLOGIES[framework];
      const marketingIr: MarketingIRGraph = {
        personaId: "marketing",
        version: IR_SCHEMA_VERSION,
        nodes: parsedPlanner.nodes,
        angles: (parsedPlanner.angles ?? []) as IRAngle[],
        edges: topology.nodes.slice(0, -1).map((n: string, i: number) => ({
          from: n,
          to: topology.nodes[i + 1],
          rel: "leads_to"
        })),
      };
      irGraph = marketingIr;
    } else {
      // Thought: use persona-based topology via compileIRGraph
      const effectiveMaxLength = request.constraints?.maxLength ??
        PLATFORM_MAX_LENGTHS[request.platform.toLowerCase()];
      const forcedVariant = request.constraints?.forcedIntellectualModeVariant as
        ("standard" | "compact" | undefined);
      const modeVariant: "standard" | "compact" =
        forcedVariant ??
        (request.persona === "intellectual" && effectiveMaxLength && effectiveMaxLength <= 280
          ? "compact"
          : "standard");
      const forcedMode = request.constraints?.forcedIntellectualMode as
        ("thought_provoking" | "analytical" | "philosophical" | undefined);

      irGraph = compileIRGraph(parsedPlanner.nodes, request.persona as keyof typeof TOPOLOGY_REQUIRED, modeVariant, forcedMode);
    }
  } catch (error: any) {
    return { success: false, firstPassSuccess: false, retryUsed: false, error: `Planner Error: ${error.message}`, failureSignals: [], allValidationPasses };
  }

  // 2. Renderer Phase — single pass, one retry if retryable hard failure
  const irContentLength = irGraph.nodes.reduce((sum, n) => sum + (n.content?.length || 0), 0);

  const effectiveMaxLength =
    request.constraints?.maxLength ??
    PLATFORM_MAX_LENGTHS[request.platform?.toLowerCase() ?? ""] ?? 280;

  const lengths: LocalPipelineResult["lengths"] = {
    effective: effectiveMaxLength,
    irLength: irContentLength,
    rawFirstPass: 0,
    finalFirstPass: 0,
    expansionRatioFirstPass: 0,
  };

  let firstPassSuccess = true;
  let retryUsed = false;
  let retryReason: "hard_failure" | undefined;
  let rendererRaw = "";

  // ── Attempt 0 — first pass ────────────────────────────────────────────────
  let firstPassContent: GeneratedContent | undefined;
  let firstPassValidation: ValidationResult | undefined;

  try {
    const rendererRes = await client.models.generateContent({
      model: modelName,
      contents: isMarketing && !normalized.useLegacyEngine ? buildMarketingRendererPrompt(irGraph, normalized) : buildRendererPrompt(irGraph, normalized),
      config: { temperature: aiConfig.temperature, responseMimeType: "application/json" }
    });
    rendererRaw = rendererRes.text || "";

    firstPassContent = parseRendererOutput(rendererRaw);

    const combinedText = `${firstPassContent.title ?? ""} ${firstPassContent.hook ?? ""} ${firstPassContent.body ?? ""} ${firstPassContent.callToAction ?? ""} ${(firstPassContent.hashtags ?? []).join(" ")}`.trim();
    lengths.rawFirstPass = rendererRaw.length;
    lengths.finalFirstPass = combinedText.length;
    lengths.expansionRatioFirstPass = irContentLength > 0 ? combinedText.length / irContentLength : 0;

    firstPassValidation = validateRenderedContent(firstPassContent, request, effectiveMaxLength, 0);
    allValidationPasses.push(firstPassValidation);

    if (firstPassValidation.passed) {
      return {
        success: true,
        content: firstPassContent,
        firstPassSuccess: true,
        retryUsed: false,
        failureSignals: [],
        allValidationPasses,
        plannerOutputRaw: plannerRaw,
        rendererOutputRaw: rendererRaw,
        lengths,
      };
    }

    // First pass failed — check if any failure is retryable
    const retryableFailures = firstPassValidation.signals.filter(
      s => s.severity === "hard" && RETRYABLE_HARD_FAILURES.has(s.code)
    );
    firstPassSuccess = false;

    if (retryableFailures.length === 0) {
      // No retryable failures — return as-is (soft failures only, or non-retryable hard)
      return {
        success: false,
        content: firstPassContent,
        firstPassSuccess: false,
        retryUsed: false,
        failureSignals: firstPassValidation.signals,
        allValidationPasses,
        plannerOutputRaw: plannerRaw,
        rendererOutputRaw: rendererRaw,
        lengths,
      };
    }

    // ── Attempt 1 — retry for retryable hard failures only ───────────────────
    retryUsed = true;
    retryReason = "hard_failure";

    const repairStrategies = retryableFailures
      .map(s => `- ${s.repair_strategy}`)
      .join("\n");

    const retryInstructions = [
      request.constraints?.customInstructions ?? "",
      "المحاولة السابقة فشلت للأسباب التالية. يجب إصلاح هذه الأخطاء بدقة:",
      repairStrategies,
      "حافظ على الفكرة الأساسية والمنصة. لا تضف أي معلومات جديدة.",
    ].filter(Boolean).join("\n\n");

    const retryNormalized = {
      ...normalized,
      constraints: { ...normalized.constraints, customInstructions: retryInstructions },
    };

    try {
      const retryRes = await client.models.generateContent({
        model: modelName,
        contents: isMarketing ? buildMarketingRendererPrompt(irGraph, retryNormalized) : buildRendererPrompt(irGraph, retryNormalized),
        config: { temperature: aiConfig.temperature, responseMimeType: "application/json" }
      });
      const retryRaw = retryRes.text || "";
      const retryContent = parseRendererOutput(retryRaw);

      const retryText = `${retryContent.title ?? ""} ${retryContent.hook ?? ""} ${retryContent.body ?? ""} ${retryContent.callToAction ?? ""} ${(retryContent.hashtags ?? []).join(" ")}`.trim();
      lengths.rawRetry = retryRaw.length;
      lengths.finalRetry = retryText.length;
      lengths.expansionRatioRetry = irContentLength > 0 ? retryText.length / irContentLength : 0;

      const retryValidation = validateRenderedContent(retryContent, request, effectiveMaxLength, 1);
      allValidationPasses.push(retryValidation);

      // Accept the retry result — whether it passed or not, it's our best output.
      // The caller (benchmark) can compare signals between passes.
      return {
        success: retryValidation.passed,
        content: retryContent,
        firstPassSuccess: false,
        retryUsed: true,
        retryReason: "hard_failure",
        failureSignals: retryValidation.signals,
        allValidationPasses,
        plannerOutputRaw: plannerRaw,
        rendererOutputRaw: retryRaw,
        lengths,
      };

    } catch (retryError: any) {
      // Retry itself failed to parse — return the first-pass result as fallback
      return {
        success: false,
        content: firstPassContent,
        firstPassSuccess: false,
        retryUsed: true,
        retryReason: "hard_failure",
        error: `Renderer Retry JSON Error: ${retryError.message}`,
        failureSignals: firstPassValidation.signals,
        allValidationPasses,
        plannerOutputRaw: plannerRaw,
        rendererOutputRaw: rendererRaw,
        lengths,
      };
    }

  } catch (error: any) {
    return {
      success: false,
      firstPassSuccess: false,
      retryUsed: false,
      error: `Renderer JSON Error: ${error.message}`,
      failureSignals: [],
      allValidationPasses,
      plannerOutputRaw: plannerRaw,
      rendererOutputRaw: rendererRaw,
      lengths,
    };
  }
}
