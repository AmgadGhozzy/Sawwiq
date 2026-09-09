import type { IRGraph } from "../../../../lib/planner/types.ts";
import type { GeneratedContent } from "../../../../types/content.ts";
import type { PlannerRequestDTO } from "../../../../lib/planner/validation.ts";

export interface EvaluationResult {
  planner_status: string;
  compiler_status: string;
  renderer_status: string;
  failure_code: string | null;
  constraint_results: {
    passed: boolean;
    hard_failures: string[];
    warnings: string[];
    checks: {
      required_fields: boolean;
      max_length: boolean;
      required_terms: boolean;
      forbidden_terms: boolean;
      hashtag_count: boolean;
      hashtags_unique: boolean;
      no_html: boolean;
      no_markdown: boolean;
      no_json_artifacts: boolean;
      fidelity: boolean;
      cliche: boolean;
      platform_length: boolean;
    };
    fidelity_details?: {
      input_numbers: string[];
      output_numbers: string[];
      unexpected_numbers: string[];
    };
    cliche_details?: string[];
  };
}

function normalizeArabicText(text: string): string {
  return text
    .normalize("NFKC")
    .replace(/[أإآٱ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/ؤ/g, "و")
    .replace(/ئ/g, "ي")
    .replace(/ـ/g, "")
    .toLowerCase()
    .trim();
}

const ARABIC_CLICHES = [
  "مستني إيه",
  "مستنى ايه",
  "فرصة متتفوتش",
  "لا تفوت الفرصة",
  "ده مش حلم",
  "خلي حياتك",
  "اكتشف الآن",
  "تخيل معايا كده"
];

function extractNumbers(text: string): string[] {
  // Matches digits (including Arabic numerals)
  const numberRegex = /\d+|[\u0660-\u0669]+/g;
  const matches = text.match(numberRegex);
  return matches ? matches : [];
}

export function evaluateShadowRun(
  request: PlannerRequestDTO,
  irGraph: IRGraph | null,
  renderedContent: GeneratedContent | null,
  error?: Error | null
): EvaluationResult {
  const result: EvaluationResult = {
    planner_status: "success",
    compiler_status: "success",
    renderer_status: "success",
    failure_code: null,
    constraint_results: {
      passed: true,
      hard_failures: [],
      warnings: [],
      checks: {
        required_fields: true,
        max_length: true,
        required_terms: true,
        forbidden_terms: true,
        hashtag_count: true,
        hashtags_unique: true,
        no_html: true,
        no_markdown: true,
        no_json_artifacts: true,
        fidelity: true,
        cliche: false, // Default false means no cliche detected
        platform_length: true
      }
    }
  };

  if (error) {
    result.constraint_results.passed = false;
    const msg = error.message || "";
    
    if (msg.includes("Planner")) {
      result.planner_status = "error";
      result.compiler_status = "skipped";
      result.renderer_status = "skipped";
      result.failure_code = "PLANNER_FAILED";
      result.constraint_results.hard_failures.push("PLANNER_FAILED");
    } else if (msg.includes("Compiler")) {
      result.compiler_status = "error";
      result.renderer_status = "skipped";
      result.failure_code = "COMPILER_FAILED";
      result.constraint_results.hard_failures.push("COMPILER_FAILED");
    } else if (msg.includes("Renderer") || msg.includes("Hard constraint")) {
      result.renderer_status = "error";
      if (msg.includes("Hard constraint violated")) {
        result.failure_code = "RENDERER_LENGTH_VIOLATION";
        result.constraint_results.checks.max_length = false;
        result.constraint_results.hard_failures.push("RENDERER_LENGTH_VIOLATION");
      } else {
        result.failure_code = "RENDERER_FAILED";
        result.constraint_results.hard_failures.push("RENDERER_FAILED");
      }
    } else if (msg === "Internal Database Error") {
      result.failure_code = "PERSISTENCE_FAILED";
      result.constraint_results.hard_failures.push("PERSISTENCE_FAILED");
    } else if (msg === "DUPLICATE_REQUEST") {
      result.failure_code = "DUPLICATE_REQUEST";
      result.constraint_results.hard_failures.push("DUPLICATE_REQUEST");
    } else {
      result.failure_code = "UNKNOWN_ERROR";
      result.constraint_results.hard_failures.push("UNKNOWN_ERROR");
    }
  }

  // Deterministic checks on success
  if (renderedContent) {
    const fullText = `${renderedContent.title} ${renderedContent.hook} ${renderedContent.body} ${renderedContent.callToAction}`;
    const normalizedFullText = normalizeArabicText(fullText);
    const cr = result.constraint_results;

    if (request.constraints?.maxLength) {
      const hashtagsText = renderedContent.hashtags.map(t => t.startsWith("#") ? t : `#${t}`).join(" ");
      const totalLength = 
        renderedContent.title.length + 
        renderedContent.hook.length + 
        renderedContent.body.length + 
        renderedContent.callToAction.length + 
        hashtagsText.length;
        
      if (totalLength > request.constraints.maxLength) {
        cr.checks.max_length = false;
        cr.hard_failures.push("max_length_violated");
        cr.passed = false;
        result.failure_code = result.failure_code || "RENDERER_LENGTH_VIOLATION";
      }
    }

    if (request.platform === "x") {
      const hashtagsText = renderedContent.hashtags.map(t => t.startsWith("#") ? t : `#${t}`).join(" ");
      const totalLength = 
        renderedContent.title.length + 
        renderedContent.hook.length + 
        renderedContent.body.length + 
        renderedContent.callToAction.length + 
        hashtagsText.length;
        
      if (totalLength > 280) {
        cr.checks.platform_length = false;
        cr.hard_failures.push("platform_length_violation");
        cr.passed = false;
        result.failure_code = result.failure_code || "RENDERER_LENGTH_VIOLATION";
      }
    }
    
    // Check required fields
    const missing = [];
    if (!renderedContent.title || renderedContent.title.length <= 3) missing.push("title");
    if (!renderedContent.hook || renderedContent.hook.length <= 5) missing.push("hook");
    if (!renderedContent.body || renderedContent.body.length <= 20) missing.push("body");
    if (!renderedContent.callToAction || renderedContent.callToAction.length <= 3) missing.push("callToAction");
    
    if (missing.length > 0) {
      cr.checks.required_fields = false;
      cr.hard_failures.push(`missing_or_short_fields: ${missing.join(",")}`);
      cr.passed = false;
      result.failure_code = result.failure_code || "MISSING_FIELDS";
    }

    // Hashtag count (assuming 5-8 is the standard range as in evaluateDeterministic)
    const minH = 5;
    const maxH = 8;
    if (renderedContent.hashtags.length < minH || renderedContent.hashtags.length > maxH) {
      cr.checks.hashtag_count = false;
      cr.warnings.push(`hashtag_count: ${renderedContent.hashtags.length} (expected ${minH}-${maxH})`);
    }

    if (renderedContent.hashtags.some((t) => t.includes("#"))) {
       cr.warnings.push("hashtags_contain_hash");
    }

    // Hashtags unique
    const uniqueSet = new Set(renderedContent.hashtags.map((t) => t.trim()));
    if (uniqueSet.size !== renderedContent.hashtags.length) {
      cr.checks.hashtags_unique = false;
      cr.warnings.push("duplicate_hashtags");
    }

    // HTML, Markdown, JSON artifacts
    if (/<[a-z][^>]*>/i.test(fullText)) {
      cr.checks.no_html = false;
      cr.hard_failures.push("contains_html");
      cr.passed = false;
    }
    if (/^#{1,6}\s/m.test(fullText) || /```/.test(fullText)) {
      cr.checks.no_markdown = false;
      cr.hard_failures.push("contains_markdown");
      cr.passed = false;
    }
    if (/\{"/.test(fullText) || /"\}/.test(fullText)) {
      cr.checks.no_json_artifacts = false;
      cr.hard_failures.push("contains_json_artifacts");
      cr.passed = false;
    }

    // Constraints: forbidden/required terms
    if (request.constraints?.forbiddenTerms && request.constraints.forbiddenTerms.length > 0) {
      const found = request.constraints.forbiddenTerms.filter(term => 
        normalizedFullText.includes(normalizeArabicText(term))
      );
      if (found.length > 0) {
        cr.checks.forbidden_terms = false;
        cr.hard_failures.push(`forbidden_terms_found: ${found.join(",")}`);
        cr.passed = false;
      }
    }

    if (request.constraints?.requiredTerms && request.constraints.requiredTerms.length > 0) {
      const missingTerms = request.constraints.requiredTerms.filter(term => {
        const options = term.split("|").map(opt => normalizeArabicText(opt.trim()));
        return !options.some(opt => normalizedFullText.includes(opt));
      });
      if (missingTerms.length > 0) {
        cr.checks.required_terms = false;
        cr.hard_failures.push(`required_terms_missing: ${missingTerms.join(",")}`);
        cr.passed = false;
      }
    }

    // Arabic Cliche Detector
    const clichesFound = ARABIC_CLICHES.filter(cliche => 
      normalizedFullText.includes(normalizeArabicText(cliche))
    );
    if (clichesFound.length > 0) {
      cr.checks.cliche = true; // This is a warning, so passed is not set to false
      cr.cliche_details = clichesFound;
      cr.warnings.push("cliche_detected");
    }

    // Input Fidelity (Hallucination Guard for Numbers)
    const inputText = `${request.topic} ${request.audience || ""} ${request.constraints?.customInstructions || ""} ${request.constraints?.requiredTerms?.join(" ") || ""}`;
    const inputNumbers = new Set(extractNumbers(inputText));
    const outputNumbers = new Set(extractNumbers(fullText));
    
    const unexpectedNumbers: string[] = [];
    for (const num of outputNumbers) {
      // Exclude single digit numbers (length 1)
      if (!inputNumbers.has(num) && num.length > 1) {
        unexpectedNumbers.push(num);
      }
    }

    cr.fidelity_details = {
      input_numbers: Array.from(inputNumbers),
      output_numbers: Array.from(outputNumbers),
      unexpected_numbers: unexpectedNumbers
    };

    if (unexpectedNumbers.length > 0) {
      cr.checks.fidelity = false;
      cr.hard_failures.push(`fidelity_violation_unexpected_numbers: ${unexpectedNumbers.join(",")}`);
      cr.passed = false;
    }
    
    if (!cr.passed && !result.failure_code) {
      result.failure_code = "CONTENT_EVALUATION_FAILED";
    }
  }

  return result;
}
