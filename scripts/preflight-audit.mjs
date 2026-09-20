/**
 * Production Config Audit Script
 *
 * Validates all required environment variables for Pipeline B production launch.
 * Run BEFORE deploying or switching PIPELINE_B_ENABLED=true.
 *
 * Usage:
 *   node scripts/preflight-audit.mjs
 *   # or with custom env file:
 *   node --env-file=.env.local scripts/preflight-audit.mjs
 */

// ─── Config ───────────────────────────────────────────────────────────────────

const SUPABASE_PROJECT_REF = "qoigocuyjxcavyfouapa";
const FROZEN_MODEL = "gemini-2.5-flash-lite";

const checks = [];
let failCount = 0;
let warnCount = 0;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function pass(label, detail = "") {
  checks.push({ status: "✅", label, detail });
}
function fail(label, detail = "") {
  checks.push({ status: "❌", label, detail });
  failCount++;
}
function warn(label, detail = "") {
  checks.push({ status: "⚠️ ", label, detail });
  warnCount++;
}

function get(key) {
  return process.env[key];
}

function checkRequired(key, validator = null, hint = "") {
  const val = get(key);
  if (!val || val.trim() === "" || val.includes("your_") || val.includes("your-")) {
    fail(`${key} is set`, hint || `Missing or placeholder value`);
    return null;
  }
  if (validator) {
    const result = validator(val);
    if (result !== true) {
      fail(`${key} is valid`, result);
      return null;
    }
  }
  pass(`${key} is set`);
  return val;
}

// ─── 1. Supabase ──────────────────────────────────────────────────────────────

console.log("\n📋 SAWWIQ PRODUCTION PREFLIGHT AUDIT\n" + "─".repeat(50));
console.log("\n[1/5] Supabase Configuration");

const supabaseUrl = checkRequired(
  "NEXT_PUBLIC_SUPABASE_URL",
  (v) => v.includes(SUPABASE_PROJECT_REF)
    ? true
    : `URL should contain project ref '${SUPABASE_PROJECT_REF}'. Got: ${v}`,
);
checkRequired("NEXT_PUBLIC_SUPABASE_ANON_KEY",
  (v) => v.length > 50 ? true : "Key seems too short — verify it's the anon key from Supabase Dashboard"
);
checkRequired("SUPABASE_SERVICE_ROLE_KEY",
  (v) => v.length > 50 ? true : "Key seems too short — verify it's the service role key"
);

// ─── 2. Pipeline B ────────────────────────────────────────────────────────────

console.log("\n[2/5] Pipeline B Flags");

const isPipelineBEnabled = get("NEXT_PUBLIC_PIPELINE_B_ENABLED");
if (isPipelineBEnabled === "true") {
  pass("NEXT_PUBLIC_PIPELINE_B_ENABLED = true (Pipeline B is primary)");
} else if (isPipelineBEnabled === "false") {
  warn("NEXT_PUBLIC_PIPELINE_B_ENABLED = false", "Pipeline A will be used. Set to 'true' for production launch.");
} else {
  fail("NEXT_PUBLIC_PIPELINE_B_ENABLED", "Must be 'true' or 'false'");
}

const fallbackToA = get("NEXT_PUBLIC_PIPELINE_B_FALLBACK_TO_A");
if (fallbackToA === "true") {
  pass("NEXT_PUBLIC_PIPELINE_B_FALLBACK_TO_A = true (safety net active during rollout)");
} else if (fallbackToA === "false") {
  warn(
    "NEXT_PUBLIC_PIPELINE_B_FALLBACK_TO_A = false",
    "No fallback to Pipeline A. Only disable after confirming rollout stability."
  );
} else {
  fail("NEXT_PUBLIC_PIPELINE_B_FALLBACK_TO_A", "Must be 'true' or 'false'");
}

const shadowEnabled = get("NEXT_PUBLIC_PIPELINE_B_SHADOW_ENABLED");
if (shadowEnabled === "true" && isPipelineBEnabled === "true") {
  warn(
    "NEXT_PUBLIC_PIPELINE_B_SHADOW_ENABLED = true while B is primary",
    "Shadow mode fires background B calls even when B is already primary. Intentional?"
  );
} else {
  pass(`NEXT_PUBLIC_PIPELINE_B_SHADOW_ENABLED = ${shadowEnabled ?? "not set (false)"}`);
}

// ─── 3. Danger Variables ─────────────────────────────────────────────────────

console.log("\n[3/5] Danger Variables (must be absent or false in production)");

const e2eMode = get("PIPELINE_B_E2E_MODE");
if (e2eMode === "true") {
  fail(
    "PIPELINE_B_E2E_MODE is 'true'",
    "🔴 CRITICAL: E2E mode disables fallback to A and enables failure injection. MUST be false/absent in production."
  );
} else {
  pass(`PIPELINE_B_E2E_MODE = ${e2eMode ?? "not set"} (safe)`);
}

const failureInjection = get("PIPELINE_B_FAILURE_INJECTION");
if (failureInjection === "true") {
  fail(
    "PIPELINE_B_FAILURE_INJECTION is 'true'",
    "🔴 CRITICAL: Failure injection in production will cause artificial errors for real users."
  );
} else {
  pass(`PIPELINE_B_FAILURE_INJECTION = ${failureInjection ?? "not set"} (safe)`);
}

// ─── 4. Auth & Security ───────────────────────────────────────────────────────

console.log("\n[4/5] Auth & Security");

const shadowSecret = checkRequired(
  "SHADOW_SECRET_KEY",
  (v) => v.length >= 32 ? true : `Secret too short (${v.length} chars). Generate with: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`,
  "Required for Pipeline B authentication between Next.js and Supabase Edge Function"
);

checkRequired(
  "ANTI_ABUSE_SECRET",
  (v) => v.length >= 32 ? true : `Secret too short (${v.length} chars). Generate with: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`,
);

if (shadowSecret) {
  console.log(
    `   📌 IMPORTANT: Verify that SHADOW_SECRET_KEY in Supabase Edge Function secrets`
  );
  console.log(
    `      matches this value (first 8 chars: ${shadowSecret.substring(0, 8)}...)`
  );
}

// ─── 5. AI Provider ───────────────────────────────────────────────────────────

console.log("\n[5/5] AI Provider");

const model = get("GEMINI_MODEL");
if (!model) {
  pass(`GEMINI_MODEL not set → will use default: '${FROZEN_MODEL}'`);
} else if (model === FROZEN_MODEL) {
  pass(`GEMINI_MODEL = '${model}' (matches frozen benchmark model)`);
} else {
  warn(
    `GEMINI_MODEL = '${model}'`,
    `Frozen benchmark was run on '${FROZEN_MODEL}'. Different model = benchmark invalid. Intentional?`
  );
}

// Note: GEMINI_API_KEY is a Supabase secret, not a Next.js env var
console.log("   ℹ️  GEMINI_API_KEY is set in Supabase Edge Function secrets (not checked here)");
console.log(`   ℹ️  Verify in: Supabase Dashboard → Edge Functions → planner → Secrets`);

// ─── Summary ─────────────────────────────────────────────────────────────────

console.log("\n" + "─".repeat(50));
console.log("AUDIT RESULTS:\n");

const maxLabelLen = Math.max(...checks.map(c => c.label.length));
for (const c of checks) {
  const label = c.label.padEnd(maxLabelLen + 2);
  console.log(`  ${c.status} ${label}${c.detail ? `\n     └─ ${c.detail}` : ""}`);
}

console.log("\n" + "─".repeat(50));

if (failCount === 0 && warnCount === 0) {
  console.log(`\n🟢 PREFLIGHT PASSED — All ${checks.length} checks passed`);
  console.log("   Ready to proceed with E2E verification.\n");
  process.exit(0);
} else if (failCount === 0) {
  console.log(`\n🟡 PREFLIGHT PASSED WITH WARNINGS`);
  console.log(`   ${checks.length - failCount - warnCount} passed, ${warnCount} warnings, 0 failures`);
  console.log("   Review warnings above before proceeding.\n");
  process.exit(0);
} else {
  console.log(`\n🔴 PREFLIGHT FAILED`);
  console.log(`   ${failCount} failure(s), ${warnCount} warning(s)`);
  console.log("   Fix failures before launching Pipeline B in production.\n");
  process.exit(1);
}
