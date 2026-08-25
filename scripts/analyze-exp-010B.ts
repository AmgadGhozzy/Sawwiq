import * as fs from "fs";
import * as path from "path";

const reportPath = path.join(
    __dirname,
    "benchmark-reports",
    "exp-010B-rendering-1787542225904.json"
);

const data = JSON.parse(fs.readFileSync(reportPath, "utf-8"));
const cases = data.cases;

console.log(`📊 EXP-010B Post-Processing Analysis`);
console.log(`   Total cases: ${cases.length}\n`);

// ─── Recalculate from raw cases ─────────────────────────────────────────────
let totalIRPurity = 0;
let totalFidelity = 0;
let personaCorrect = 0;
let totalAblation = 0;
let rendererDrift = 0;
let plannerFailures = 0;
let evaluatorCollisions = 0;

const collisionMatrix: any = {
    developer: { developer: 0, psychology: 0, intellectual: 0, creative: 0 },
    psychology: { developer: 0, psychology: 0, intellectual: 0, creative: 0 },
    intellectual: { developer: 0, psychology: 0, intellectual: 0, creative: 0 },
    creative: { developer: 0, psychology: 0, intellectual: 0, creative: 0 },
};

const byPersona: any = {
    developer: { total: 0, correct: 0, irPurity: 0, fidelity: 0 },
    psychology: { total: 0, correct: 0, irPurity: 0, fidelity: 0 },
    intellectual: { total: 0, correct: 0, irPurity: 0, fidelity: 0 },
    creative: { total: 0, correct: 0, irPurity: 0, fidelity: 0 },
};

const byCategory: any = {
    Human: { total: 0, correct: 0 },
    Business: { total: 0, correct: 0 },
    Technical: { total: 0, correct: 0 },
    Adversarial: { total: 0, correct: 0 },
};

const repairedCases: any[] = [];
let repairedCorrect = 0;
let repairedFidelity = 0;

for (const c of cases) {
    const purity = c.ir_purity?.overall_purity ?? 0;
    const fidelity = c.renderer?.fidelity_to_ir ?? 0;
    const predicted = c.persona_evaluation?.predicted ?? "unknown";
    const isMatch = c.persona_evaluation?.is_match ?? false;
    const ablation = c.ablation?.delta ?? 0;

    totalIRPurity += purity;
    totalFidelity += fidelity;
    totalAblation += ablation;
    if (isMatch) personaCorrect++;
    if (c.renderer?.renderer_drift_detected) rendererDrift++;
    if (c.attribution?.planner_failure) plannerFailures++;
    if (c.attribution?.evaluator_collision) evaluatorCollisions++;

    // Collision matrix
    if (collisionMatrix[c.persona] && collisionMatrix[c.persona][predicted] !== undefined) {
        collisionMatrix[c.persona][predicted]++;
    }

    // By persona
    if (byPersona[c.persona]) {
        byPersona[c.persona].total++;
        byPersona[c.persona].irPurity += purity;
        byPersona[c.persona].fidelity += fidelity;
        if (isMatch) byPersona[c.persona].correct++;
    }

    // By category
    if (byCategory[c.category]) {
        byCategory[c.category].total++;
        if (isMatch) byCategory[c.category].correct++;
    }

    // Repaired cases
    if (c.is_repaired_case || c.repair_attempts > 0) {
        repairedCases.push(c);
        if (isMatch) repairedCorrect++;
        repairedFidelity += fidelity;
    }
}

const n = cases.length;

console.log("=".repeat(60));
console.log("📈 CORRECTED SUMMARY (computed from all 80 raw cases)");
console.log("=".repeat(60));
console.log(`IR Purity (avg):          ${(totalIRPurity / n).toFixed(1)}`);
console.log(`Surface Fidelity (avg):   ${(totalFidelity / n).toFixed(3)}`);
console.log(`Persona Accuracy:         ${((personaCorrect / n) * 100).toFixed(1)}%  (${personaCorrect}/${n})`);
console.log(`Ablation Delta (avg):     ${(totalAblation / n).toFixed(1)}`);
console.log(`Collision Rate:           ${(((n - personaCorrect) / n) * 100).toFixed(1)}%`);
console.log(`Renderer Drift Cases:     ${rendererDrift}`);
console.log(`Planner Failures:         ${plannerFailures}`);
console.log(`Evaluator Collisions:     ${evaluatorCollisions}`);
console.log(`Composite Score:          ${((totalIRPurity / n / 100) * (totalFidelity / n) * (personaCorrect / n)).toFixed(3)}`);

console.log("\n" + "─".repeat(60));
console.log("📊 PERSONA BREAKDOWN");
console.log("─".repeat(60));
for (const [persona, stats] of Object.entries(byPersona) as any) {
    const acc = stats.total > 0 ? ((stats.correct / stats.total) * 100).toFixed(1) : "N/A";
    const purity = stats.total > 0 ? (stats.irPurity / stats.total).toFixed(1) : "N/A";
    const fid = stats.total > 0 ? (stats.fidelity / stats.total).toFixed(3) : "N/A";
    console.log(`  ${persona.padEnd(14)} Accuracy: ${String(acc + "%").padEnd(8)} | IR Purity: ${purity} | Fidelity: ${fid} | ${stats.correct}/${stats.total}`);
}

console.log("\n" + "─".repeat(60));
console.log("📊 CATEGORY BREAKDOWN");
console.log("─".repeat(60));
for (const [cat, stats] of Object.entries(byCategory) as any) {
    if (stats.total === 0) continue;
    const acc = ((stats.correct / stats.total) * 100).toFixed(1);
    console.log(`  ${cat.padEnd(12)} Accuracy: ${acc}%  (${stats.correct}/${stats.total})`);
}

console.log("\n" + "─".repeat(60));
console.log("📊 COLLISION MATRIX (rows=target, cols=predicted)");
console.log("─".repeat(60));
console.log("                   dev   psych  intel  creat");
for (const [persona, row] of Object.entries(collisionMatrix) as any) {
    const vals = [row.developer, row.psychology, row.intellectual, row.creative];
    console.log(`  ${persona.padEnd(16)} ${vals.map((v: number) => String(v).padEnd(6)).join(" ")}`);
}

if (repairedCases.length > 0) {
    console.log("\n" + "─".repeat(60));
    console.log("🔧 REPAIRED CASES GROUP");
    console.log("─".repeat(60));
    console.log(`  Count:           ${repairedCases.length}`);
    console.log(`  Accuracy:        ${((repairedCorrect / repairedCases.length) * 100).toFixed(1)}%`);
    console.log(`  Avg Fidelity:    ${(repairedFidelity / repairedCases.length).toFixed(3)}`);
}

console.log("\n" + "─".repeat(60));
console.log("🎯 GATE EVALUATION");
console.log("─".repeat(60));
const gates: [string, string, string, boolean][] = [
    ["IR Purity ≥ 90", `${(totalIRPurity / n).toFixed(1)}`, "90", (totalIRPurity / n) >= 90],
    ["Surface Fidelity ≥ 0.95", `${(totalFidelity / n).toFixed(3)}`, "0.95", (totalFidelity / n) >= 0.95],
    ["Persona Accuracy ≥ 85%", `${((personaCorrect / n) * 100).toFixed(1)}%`, "85%", (personaCorrect / n) >= 0.85],
    ["Collision Rate ≤ 15%", `${(((n - personaCorrect) / n) * 100).toFixed(1)}%`, "15%", ((n - personaCorrect) / n) <= 0.15],
];
for (const [name, actual, threshold, pass] of gates) {
    console.log(`  ${pass ? "✅" : "❌"} ${name.padEnd(30)} actual: ${actual}`);
}

