import fs from "fs";
import path from "path";
import { evaluatePersona } from "../lib/evaluation/personaEvaluator";
import { evaluateFingerprintSeparation } from "../lib/evaluation/fingerprintEvaluator";
import { evaluateGenericness } from "../lib/evaluation/genericnessEvaluator";

// Load Dataset
const datasetPath = path.join(__dirname, "datasets", "dataset-personal-creator.json");
const dataset = JSON.parse(fs.readFileSync(datasetPath, "utf-8"));

async function runSmokeTest() {
  console.log(`Starting Phase 1 Smoke Test for ${dataset.experiment}...`);

  // Dummy text to test the evaluators are connecting correctly
  const mockTextDeveloper = `البرمجة ليست مجرد كتابة أكواد، بل هي هندسة لحل المشكلات. عندما تنظر إلى عقلك كأنه وحدة معالجة مركزية (CPU)، ستدرك أن تعدد المهام (Multitasking) هو مجرد استنزاف للذاكرة العشوائية (RAM).`;

  const mockTextPsychology = `وهم تعدد المهام ينبع من رغبة العقل البشري في الشعور بالإنجاز السريع. الدوبامين يخدعنا ويجعلنا نظن أننا منتجون، بينما في الحقيقة نحن نرهق قشرة الدماغ الجبهية ونفقد القدرة على التركيز العميق.`;

  console.log("\\n--- Testing Persona Evaluator ---");
  const personaEval = await evaluatePersona(mockTextPsychology);
  console.log(JSON.stringify(personaEval, null, 2));

  console.log("\\n--- Testing Fingerprint Separation ---");
  const fingerprintEval = await evaluateFingerprintSeparation(mockTextDeveloper, mockTextPsychology);
  console.log(JSON.stringify(fingerprintEval, null, 2));

  console.log("\\n--- Testing Genericness Evaluator ---");
  const genericnessEval = await evaluateGenericness(mockTextDeveloper);
  console.log(JSON.stringify(genericnessEval, null, 2));

  console.log("\\nSmoke Test Completed Successfully.");
}

runSmokeTest().catch(console.error);
