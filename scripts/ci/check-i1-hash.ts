/**
 * check-i1-hash.ts
 *
 * I1 Freeze Integrity Check — Post-Release Hardening (EXP-015)
 *
 * Verifies that lib/content/personas/semanticConstraints.ts has not been
 * modified since the EXP-015 production gate was passed.
 *
 * Source of truth: scripts/benchmark-reports/exp-015-release-manifest.json
 *   → i1_manifest.sha256
 *
 * Rules:
 *   - PASS:  actual SHA-256 matches manifest.
 *   - FAIL:  any mismatch → exit(1). Any change must be treated as I2
 *            and requires a new production gate.
 *   - This script is READ-ONLY. It does not modify any file.
 */

import fs from "fs";
import path from "path";
import crypto from "crypto";

// ─── Paths ────────────────────────────────────────────────────────────────────

const ROOT = path.resolve(process.cwd());

const MANIFEST_PATH = path.join(
  ROOT,
  "scripts",
  "benchmark-reports",
  "exp-015-release-manifest.json"
);

const TARGET_PATH = path.join(
  ROOT,
  "lib",
  "content",
  "personas",
  "semanticConstraints.ts"
);

// ─── Helpers ─────────────────────────────────────────────────────────────────

function sha256(filePath: string): string {
  const buf = fs.readFileSync(filePath);
  return crypto.createHash("sha256").update(buf).digest("hex");
}

function fail(msg: string): never {
  console.error(`\n❌ I1 INTEGRITY: FAIL\n   ${msg}\n`);
  process.exit(1);
}

// ─── Main ────────────────────────────────────────────────────────────────────

console.log("━━━ I1 Freeze Integrity Check (EXP-015) ━━━\n");

// 1. Load manifest
if (!fs.existsSync(MANIFEST_PATH)) {
  fail(`Release manifest not found at:\n   ${MANIFEST_PATH}`);
}

let manifest: Record<string, unknown>;
try {
  manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, "utf-8"));
} catch {
  fail(`Failed to parse release manifest — file may be corrupt:\n   ${MANIFEST_PATH}`);
}

// 2. Extract expected SHA from manifest
const i1Manifest = manifest.i1_manifest as Record<string, unknown> | undefined;
if (!i1Manifest || typeof i1Manifest.sha256 !== "string" || !i1Manifest.sha256) {
  fail(
    `Release manifest is missing or has invalid i1_manifest.sha256.\n` +
    `   Manifest is the single source of truth — do not hard-code hashes elsewhere.\n` +
    `   Path: ${MANIFEST_PATH}`
  );
}
const expectedHash = i1Manifest.sha256 as string;

// 3. Hash the live file
if (!fs.existsSync(TARGET_PATH)) {
  fail(`semanticConstraints.ts not found at expected path:\n   ${TARGET_PATH}`);
}
const actualHash = sha256(TARGET_PATH);

// 4. Compare
console.log(`   File:     ${path.relative(ROOT, TARGET_PATH)}`);
console.log(`   Expected: ${expectedHash}`);
console.log(`   Actual:   ${actualHash}`);
console.log();

if (actualHash !== expectedHash) {
  fail(
    `SHA-256 mismatch detected.\n\n` +
    `   semanticConstraints.ts has been modified since EXP-015 was frozen.\n` +
    `   Any change to this file — including whitespace — must be treated as I2\n` +
    `   and requires a new 24-cell production gate before integration.\n\n` +
    `   Expected: ${expectedHash}\n` +
    `   Actual:   ${actualHash}\n\n` +
    `   DO NOT modify exp-015-release-manifest.json to fix this check.\n` +
    `   If you are intentionally creating I2, open a new experiment branch.`
  );
}

console.log(`✅ I1 INTEGRITY: PASS`);
console.log(`   SHA-256 matches release manifest. I1 is intact.\n`);
