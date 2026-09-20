/**
 * check-regression-state.ts
 *
 * C009 Regression Monitor — Post-Release Hardening (EXP-015)
 * Policy version: 2
 *
 * Reads the latest benchmark report to extract the C009 (developer × P03) cell
 * identity score, then applies the consecutive-failure state machine.
 *
 * State machine:
 *   identity >= 80  → PASS   (consecutive_failures reset to 0)
 *   identity <  80  → failure #1 → WATCH
 *   identity <  80  → failure #2 (consecutive) → CONSTRAINT REVIEW
 *   identity >= 80  → reset (even if previous run was WATCH)
 *
 * Thresholds:
 *   identity <  80  → failure  (strict less-than; 80 is a PASS)
 *   identity >= 80  → pass
 *
 * State file: scripts/benchmark-reports/.c009-regression-state.json
 *   - Mutable operational state. NOT an EXP-015 release artifact.
 *   - Only updated if current run is successfully parsed.
 *   - A parse failure does NOT update state (to avoid poisoning valid state).
 *
 * Fail-closed contract:
 *   - If C009 data is missing or unparseable → exit(1) (infrastructure error,
 *     not a regression). State is NOT updated.
 *   - If state file is corrupt → treated as 0 consecutive failures (fresh start).
 *
 * Exit codes:
 *   0 → PASS or WATCH
 *   1 → CONSTRAINT REVIEW, C009 data missing, or parse failure
 */

import fs from "fs";
import path from "path";

// ─── Policy constants ────────────────────────────────────────────────────────

const POLICY_VERSION = 2;
const IDENTITY_THRESHOLD = 80;     // identity < 80 → failure; >= 80 → pass
const ESCALATION_FAILURES = 2;     // consecutive failures before CONSTRAINT REVIEW
const WATCH_CASE_ID = "C009-developer-P03";

// ─── Paths ───────────────────────────────────────────────────────────────────

const ROOT = path.resolve(process.cwd());
const REPORTS_DIR = path.join(ROOT, "scripts", "benchmark-reports");
const STATE_PATH = path.join(REPORTS_DIR, ".c009-regression-state.json");

// ─── Types ───────────────────────────────────────────────────────────────────

interface RegressionState {
  case: string;
  policy_version: number;
  threshold: number;
  last_run_at: string;
  last_identity: number;
  consecutive_failures: number;
  action: "PASS" | "WATCH" | "CONSTRAINT_REVIEW";
}

interface RunResult {
  case: string;
  identity: number;
  threshold: number;
  failed: boolean;
  consecutive_failures: number;
  policy_version: number;
  action: "PASS" | "WATCH" | "CONSTRAINT_REVIEW";
  run_at: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fail(msg: string): never {
  console.error(`\n❌ C009 REGRESSION CHECK: ERROR\n   ${msg}\n`);
  process.exit(1);
}

function escalate(result: RunResult): never {
  console.error(`\n🚨 C009 REGRESSION: CONSTRAINT REVIEW REQUIRED`);
  console.error(`   ${WATCH_CASE_ID} identity has been < ${IDENTITY_THRESHOLD}%`);
  console.error(`   for ${result.consecutive_failures} consecutive run(s).`);
  console.error(`   Review semanticConstraints.ts — Developer × psychology-adjacent topics.\n`);
  console.error(JSON.stringify(result, null, 2));
  process.exit(1);
}

/** Load previous state. Returns null if file missing (fresh start). */
function loadState(): RegressionState | null {
  if (!fs.existsSync(STATE_PATH)) return null;
  try {
    return JSON.parse(fs.readFileSync(STATE_PATH, "utf-8")) as RegressionState;
  } catch {
    console.warn(`   ⚠️  State file corrupt — treating as fresh start (0 consecutive failures).`);
    return null;
  }
}

/** Persist updated state. Only called after a successful parse of current run. */
function saveState(state: RegressionState): void {
  fs.writeFileSync(STATE_PATH, JSON.stringify(state, null, 2) + "\n", "utf-8");
}

/**
 * Find the most recent benchmark report that contains C009 data.
 * Looks for files matching exp-015-production-gate-*.json in REPORTS_DIR,
 * sorted by filename descending (timestamp embedded in name).
 */
function findLatestC009Data(): { identity: number } {
  const candidates = fs
    .readdirSync(REPORTS_DIR)
    .filter(
      (f) =>
        f.startsWith("exp-015-production-gate-") && f.endsWith(".json")
    )
    .sort()
    .reverse(); // latest timestamp first

  if (candidates.length === 0) {
    fail(
      `No exp-015-production-gate-*.json files found in:\n   ${REPORTS_DIR}\n` +
      `   Cannot evaluate C009. Run a production gate first.`
    );
  }

  for (const fname of candidates) {
    const fpath = path.join(REPORTS_DIR, fname);
    let report: Record<string, unknown>;
    try {
      report = JSON.parse(fs.readFileSync(fpath, "utf-8"));
    } catch {
      continue; // skip corrupt files, try next
    }

    // Look for C009 cell result. Structure varies by gate script version;
    // try both common shapes.
    const identity = extractC009Identity(report, fname);
    if (identity !== null) {
      console.log(`   Source: ${fname}`);
      return { identity };
    }
  }

  fail(
    `C009 (developer × P03) cell data not found in any production gate report.\n` +
    `   This is an infrastructure error — C009 data is required.\n` +
    `   Missing data is NOT treated as a regression.`
  );
}

/**
 * Extract C009 identity % from a gate report.
 * Returns null if not found (so caller can try next file).
 * Returns the numeric identity (0–100 scale).
 */
function extractC009Identity(
  report: Record<string, unknown>,
  sourceName: string
): number | null {
  // Shape 1: top-level `cases` array (from EXP-015 production gate)
  if (Array.isArray(report.cases)) {
    const cell = (report.cases as Record<string, unknown>[]).find(
      (c) =>
        (typeof c.caseId === "string" && c.caseId.startsWith("C009")) ||
        (typeof c.cell_id === "string" && c.cell_id === "C009") ||
        (typeof c.id === "string" && c.id === "C009")
    );
    if (cell) {
      const id = extractIdentityFromCell(cell);
      if (id !== null) return id;
    }
  }

  // Shape 2: top-level `cells` array with cell_id field
  if (Array.isArray(report.cells)) {
    const cell = (report.cells as Record<string, unknown>[]).find(
      (c) =>
        (typeof c.cell_id === "string" && c.cell_id === "C009") ||
        (typeof c.id === "string" && c.id === "C009")
    );
    if (cell) {
      const id = extractIdentityFromCell(cell);
      if (id !== null) return id;
    }
  }

  // Shape 2: top-level `results` object keyed by cell id
  if (report.results && typeof report.results === "object") {
    const results = report.results as Record<string, unknown>;
    const cell = results["C009"] as Record<string, unknown> | undefined;
    if (cell) {
      const id = extractIdentityFromCell(cell);
      if (id !== null) return id;
    }
  }

  // Shape 3: nested per-arm results (I1 arm)
  if (report.arms && typeof report.arms === "object") {
    const arms = report.arms as Record<string, unknown>;
    for (const arm of Object.values(arms)) {
      if (arm && typeof arm === "object" && Array.isArray((arm as Record<string, unknown>).cells)) {
        const cell = ((arm as Record<string, unknown>).cells as Record<string, unknown>[]).find(
          (c) => c.cell_id === "C009" || c.id === "C009"
        );
        if (cell) {
          const id = extractIdentityFromCell(cell);
          if (id !== null) return id;
        }
      }
    }
  }

  console.warn(`   ⚠️  C009 not found in ${sourceName} — trying next report.`);
  return null;
}

function extractIdentityFromCell(cell: Record<string, unknown>): number | null {
  // Try numeric fields first
  for (const key of ["identity", "identity_pct", "identity_accuracy", "cell_identity", "render_identity_accuracy_pct"]) {
    const v = cell[key];
    if (typeof v === "number" && isFinite(v)) {
      // Normalize: accept both 0-1 and 0-100 scales
      return v <= 1.0 ? Math.round(v * 100) : v;
    }
    if (typeof v === "string") {
      const n = parseFloat(v.replace("%", ""));
      if (isFinite(n)) return n <= 1.0 ? Math.round(n * 100) : n;
    }
  }
  // Try i1 or I1 sub-object
  const i1Obj = cell.i1 || cell.I1;
  if (i1Obj && typeof i1Obj === "object") {
    const i1Rec = i1Obj as Record<string, unknown>;
    if (i1Rec.metrics && typeof i1Rec.metrics === "object") {
      return extractIdentityFromCell(i1Rec.metrics as Record<string, unknown>);
    }
    return extractIdentityFromCell(i1Rec);
  }
  return null;
}

// ─── Main ────────────────────────────────────────────────────────────────────

console.log("━━━ C009 Regression Monitor (Policy v2, EXP-015) ━━━\n");
console.log(`   Case:      ${WATCH_CASE_ID}`);
console.log(`   Threshold: identity >= ${IDENTITY_THRESHOLD}% → PASS`);
console.log(`              identity <  ${IDENTITY_THRESHOLD}% → failure`);
console.log(`   Escalation: ${ESCALATION_FAILURES} consecutive failures → CONSTRAINT REVIEW\n`);

// 1. Load previous state
const prevState = loadState();
const prevConsecutive = prevState?.consecutive_failures ?? 0;
if (prevState) {
  console.log(`   Previous run: identity=${prevState.last_identity}%, consecutive_failures=${prevConsecutive}, action=${prevState.action}`);
} else {
  console.log(`   Previous run: none (fresh start)`);
}

// 2. Get current identity from latest gate report
const { identity } = findLatestC009Data();
console.log(`   Current:  identity=${identity}%`);
console.log();

// 3. Apply state machine
const now = new Date().toISOString();
const isFailed = identity < IDENTITY_THRESHOLD;
const newConsecutive = isFailed ? prevConsecutive + 1 : 0;

let action: "PASS" | "WATCH" | "CONSTRAINT_REVIEW";
if (!isFailed) {
  action = "PASS";
} else if (newConsecutive >= ESCALATION_FAILURES) {
  action = "CONSTRAINT_REVIEW";
} else {
  action = "WATCH";
}

const result: RunResult = {
  case: WATCH_CASE_ID,
  identity,
  threshold: IDENTITY_THRESHOLD,
  failed: isFailed,
  consecutive_failures: newConsecutive,
  policy_version: POLICY_VERSION,
  action,
  run_at: now,
};

// 4. Persist state (only on successful parse — already guaranteed by reaching here)
const newState: RegressionState = {
  case: WATCH_CASE_ID,
  policy_version: POLICY_VERSION,
  threshold: IDENTITY_THRESHOLD,
  last_run_at: now,
  last_identity: identity,
  consecutive_failures: newConsecutive,
  action,
};
saveState(newState);

// 5. Output and exit
console.log(JSON.stringify(result, null, 2));
console.log();

if (action === "CONSTRAINT_REVIEW") {
  escalate(result);
}

if (action === "WATCH") {
  console.warn(`⚠️  C009 REGRESSION: WATCH`);
  console.warn(`   Identity ${identity}% is below threshold (${IDENTITY_THRESHOLD}%).`);
  console.warn(`   Consecutive failures: ${newConsecutive}/${ESCALATION_FAILURES}.`);
  console.warn(`   One more failure will trigger CONSTRAINT REVIEW.\n`);
  process.exit(0); // WATCH is non-blocking
}

console.log(`✅ C009 REGRESSION: PASS`);
console.log(`   Identity ${identity}% >= ${IDENTITY_THRESHOLD}%. Consecutive failures reset.\n`);
