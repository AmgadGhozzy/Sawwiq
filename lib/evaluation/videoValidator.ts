import { repairVideoScriptTiming } from "../../supabase/functions/generate/utils/repair";
import type { VideoScript, VideoScene } from "@/types/content";

// ---------------------------------------------------------------------------
// Violation Codes — structured error taxonomy
// ---------------------------------------------------------------------------

export type VideoViolationCode =
  | "SCENE_NUMBERING"       // Scenes not sequential starting at 1
  | "DUPLICATE_SCENE"       // Same scene index appears more than once
  | "HOOK_DURATION"         // First scene duration > 3s
  | "MISSING_VISUAL"        // Scene missing [Visual] direction
  | "MISSING_AUDIO"         // Scene missing [Audio] direction
  | "EMPTY_SCRIPT"          // Zero scenes parsed
  | "UNPARSEABLE_SCRIPT"    // No scene headers found in body
  | "SCENE_COUNT_MISMATCH"  // Generated scene count ≠ requested count
  | "DURATION_MISMATCH"     // Total duration ≠ requested duration
  | "INVALID_FORMAT"        // Scene header present but malformed
  | "CTA_MISSING"           // No call-to-action found in any scene
  | "HOOK_MISSING";         // No hook line found in the script body

// ---------------------------------------------------------------------------
// Violation & ValidationResult
// ---------------------------------------------------------------------------

export interface VideoViolation {
  code: VideoViolationCode;
  /** 1-based scene index (absent for script-level violations). */
  scene?: number;
  message: string;
}

export interface ValidationResult {
  passed: boolean;
  violations: VideoViolation[];
  /** Convenience array of human-readable messages (derived from violations). */
  errors: string[];
}

// ---------------------------------------------------------------------------
// VideoValidationMetrics — telemetry for every validation run
// ---------------------------------------------------------------------------

export interface VideoValidationMetrics {
  parseable: boolean;
  initialValid: boolean;
  repaired: boolean;
  finalValid: boolean;
  violationsBeforeRepair: number;
  violationCodesBeforeRepair: VideoViolationCode[];
  violationsAfterRepair: number;
  violationCodesAfterRepair: VideoViolationCode[];
}

// ---------------------------------------------------------------------------
// Scene header regex — matches [Scene N - Xs] / [Scene N — Xs] / [Scene N – Xs]
// ---------------------------------------------------------------------------

const VISUAL_LINE = /^\[Visual\]\s*(.+)/m;
const AUDIO_LINE = /^\[Audio\]\s*(.+)/m;
const HOOK_LINE = /^\[Hook\]\s*(.+)/m;
const CTA_LINE = /\b(تواصل|اشترِ|احجز|سجّل|انضم|اكتشف|اطلب|اضغط|اتصل|تفضل|زور|call.?to.?action|cta)\b/i;

// ---------------------------------------------------------------------------
// parseVideoScript
// ---------------------------------------------------------------------------

/**
 * Parses a raw video-script body string into a structured `VideoScript`.
 * Returns `null` if no valid scene headers can be extracted — this is a
 * **parse failure** and is distinct from a structural validation failure.
 */
export function parseVideoScript(body: string): VideoScript | null {
  const scenePattern = /\[Scene\s+(\d+)\s*[—–-]\s*(\d+)s?\]/gi;
  const headerMatches = [...body.matchAll(scenePattern)];

  if (headerMatches.length === 0) return null;

  const scenes: VideoScene[] = [];

  for (let i = 0; i < headerMatches.length; i++) {
    const match = headerMatches[i];
    const index = parseInt(match[1], 10);
    const durationSec = parseInt(match[2], 10);

    // Slice the text belonging to this scene (until the next scene header)
    const start = match.index! + match[0].length;
    const end =
      i + 1 < headerMatches.length
        ? headerMatches[i + 1].index!
        : body.length;
    const sceneBody = body.slice(start, end);

    const visual = VISUAL_LINE.exec(sceneBody)?.[1]?.trim() ?? "";
    const audio = AUDIO_LINE.exec(sceneBody)?.[1]?.trim() ?? "";

    scenes.push({ index, durationSec, visual, audio });
  }

  if (scenes.length === 0) return null;

  const hookMatch = HOOK_LINE.exec(body);
  const hook = hookMatch?.[1]?.trim();

  return { scenes, hook };
}

// ---------------------------------------------------------------------------
// validateVideoScript
// ---------------------------------------------------------------------------

export interface VideoScriptValidationOptions {
  /** Expected number of scenes (optional; triggers SCENE_COUNT_MISMATCH). */
  expectedSceneCount?: number;
  /** Expected total duration in seconds (optional; triggers DURATION_MISMATCH). */
  expectedTotalDuration?: number;
  /** If true, missing CTA triggers CTA_MISSING violation. Default: false. */
  requireCta?: boolean;
}

/**
 * Validates a parsed `VideoScript` against structural rules.
 * All violations are structured (`VideoViolation`) so downstream systems
 * can programmatically react to specific codes rather than parse error strings.
 */
export function validateVideoScript(
  script: VideoScript,
  rawBody?: string,
  opts: VideoScriptValidationOptions = {}
): ValidationResult {
  const violations: VideoViolation[] = [];
  const { scenes } = script;

  // Rule: non-empty scenes
  if (scenes.length === 0) {
    violations.push({ code: "EMPTY_SCRIPT", message: "Video script contains no scenes." });
    return toResult(violations);
  }

  // Rule: scene count matches expectation
  if (opts.expectedSceneCount !== undefined && scenes.length !== opts.expectedSceneCount) {
    violations.push({
      code: "SCENE_COUNT_MISMATCH",
      message: `Expected ${opts.expectedSceneCount} scenes, got ${scenes.length}.`,
    });
  }

  // Rule: sequential numbering (no gaps, starts at 1)
  for (let i = 0; i < scenes.length; i++) {
    const expected = i + 1;
    if (scenes[i].index !== expected) {
      violations.push({
        code: "SCENE_NUMBERING",
        scene: scenes[i].index,
        message: `Scene numbering error: expected Scene ${expected}, got Scene ${scenes[i].index}.`,
      });
    }
  }

  // Rule: no duplicate scene indices
  const seen = new Set<number>();
  for (const scene of scenes) {
    if (seen.has(scene.index)) {
      violations.push({
        code: "DUPLICATE_SCENE",
        scene: scene.index,
        message: `Duplicate scene index: Scene ${scene.index}.`,
      });
    }
    seen.add(scene.index);
  }

  // Rule: first scene duration ≤ 3s (hook rule)
  if (scenes[0].durationSec > 3) {
    violations.push({
      code: "HOOK_DURATION",
      scene: 1,
      message: `First scene duration is ${scenes[0].durationSec}s — must be ≤ 3s.`,
    });
  }

  // Rule: non-empty visual & audio per scene
  for (const scene of scenes) {
    if (!scene.visual) {
      violations.push({
        code: "MISSING_VISUAL",
        scene: scene.index,
        message: `Scene ${scene.index} is missing [Visual] direction.`,
      });
    }
    if (!scene.audio) {
      violations.push({
        code: "MISSING_AUDIO",
        scene: scene.index,
        message: `Scene ${scene.index} is missing [Audio] direction.`,
      });
    }
  }

  // Rule: total duration matches expectation
  if (opts.expectedTotalDuration !== undefined) {
    const totalDuration = scenes.reduce((sum, s) => sum + s.durationSec, 0);
    if (totalDuration !== opts.expectedTotalDuration) {
      violations.push({
        code: "DURATION_MISMATCH",
        message: `Expected total duration ${opts.expectedTotalDuration}s, got ${totalDuration}s.`,
      });
    }
  }

  // Rule: CTA present (optional)
  if (opts.requireCta && rawBody && !CTA_LINE.test(rawBody)) {
    violations.push({
      code: "CTA_MISSING",
      message: "No call-to-action detected in the script body.",
    });
  }

  return toResult(violations);
}

// ---------------------------------------------------------------------------
// enforceTiming
// ---------------------------------------------------------------------------

/**
 * Applies `repairVideoScriptTiming` and returns the repaired body string.
 * Intentionally a thin wrapper so `productionAdapter` doesn't import repair directly.
 */
export function enforceTiming(rawBody: string): string {
  return repairVideoScriptTiming(rawBody);
}

// ---------------------------------------------------------------------------
// buildVideoValidationMetrics
// ---------------------------------------------------------------------------

/**
 * Runs the full parse → validate → repair → re-validate pipeline and returns
 * a `VideoValidationMetrics` snapshot. Does NOT throw — all outcomes are
 * captured in the metrics object.
 */
export function buildVideoValidationMetrics(
  rawBody: string,
  opts: VideoScriptValidationOptions = {}
): VideoValidationMetrics {
  // Parse
  const initialParse = parseVideoScript(rawBody);

  if (!initialParse) {
    return {
      parseable: false,
      initialValid: false,
      repaired: false,
      finalValid: false,
      violationsBeforeRepair: 1,
      violationCodesBeforeRepair: ["UNPARSEABLE_SCRIPT"],
      violationsAfterRepair: 1,
      violationCodesAfterRepair: ["UNPARSEABLE_SCRIPT"],
    };
  }

  // Initial validation
  const initialCheck = validateVideoScript(initialParse, rawBody, opts);

  if (initialCheck.passed) {
    return {
      parseable: true,
      initialValid: true,
      repaired: false,
      finalValid: true,
      violationsBeforeRepair: 0,
      violationCodesBeforeRepair: [],
      violationsAfterRepair: 0,
      violationCodesAfterRepair: [],
    };
  }

  // Attempt repair
  const repairedBody = enforceTiming(rawBody);
  const repairedParse = parseVideoScript(repairedBody);

  if (!repairedParse) {
    return {
      parseable: true,
      initialValid: false,
      repaired: true,
      finalValid: false,
      violationsBeforeRepair: initialCheck.violations.length,
      violationCodesBeforeRepair: initialCheck.violations.map((v) => v.code),
      violationsAfterRepair: 1,
      violationCodesAfterRepair: ["UNPARSEABLE_SCRIPT"],
    };
  }

  const postRepairCheck = validateVideoScript(repairedParse, repairedBody, opts);

  return {
    parseable: true,
    initialValid: false,
    repaired: true,
    finalValid: postRepairCheck.passed,
    violationsBeforeRepair: initialCheck.violations.length,
    violationCodesBeforeRepair: initialCheck.violations.map((v) => v.code),
    violationsAfterRepair: postRepairCheck.violations.length,
    violationCodesAfterRepair: postRepairCheck.violations.map((v) => v.code),
  };
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function toResult(violations: VideoViolation[]): ValidationResult {
  return {
    passed: violations.length === 0,
    violations,
    errors: violations.map((v) => v.message),
  };
}
