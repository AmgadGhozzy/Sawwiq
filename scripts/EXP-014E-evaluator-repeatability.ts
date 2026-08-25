import fs from 'fs';
import path from 'path';
import { evaluateIntellectualContamination } from '../lib/evaluation/intellectualContaminationGuard';

const delay = (ms: number) => new Promise(res => setTimeout(res, ms));

const REPEAT_COUNT = 10;
const MAX_CONCURRENT = 5;
let _active = 0;
const _queue: Array<() => void> = [];

function acquireSemaphore(): Promise<void> {
  return new Promise(resolve => {
    if (_active < MAX_CONCURRENT) { _active++; resolve(); }
    else { _queue.push(() => { _active++; resolve(); }); }
  });
}
function releaseSemaphore() {
  _active--;
  if (_queue.length > 0) { const next = _queue.shift()!; next(); }
}
async function limitedCall<T>(fn: () => Promise<T>): Promise<T> {
  await acquireSemaphore();
  try { return await fn(); }
  finally { releaseSemaphore(); }
}

async function retry<T>(fn: () => Promise<T>, label = 'eval'): Promise<T> {
  const MAX_ATTEMPTS = 5;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try { return await fn(); }
    catch (e: any) {
      if (attempt >= MAX_ATTEMPTS) throw e;
      const waitMs = 3000 * Math.pow(1.5, attempt - 1);
      console.error(`     [Retry] ${label} failed. Waiting ${(waitMs / 1000).toFixed(1)}s...`);
      await delay(waitMs);
    }
  }
  throw new Error('Max retries exceeded');
}

async function testRepeatability(id: string, text: string, expectedLabel: 'clean' | 'contaminated') {
  console.log(`\nTesting: ${id} (Expected: ${expectedLabel})`);
  const promises = [];
  
  for (let i = 1; i <= REPEAT_COUNT; i++) {
    promises.push(
      limitedCall(() => retry(
        () => evaluateIntellectualContamination(text, { temperature: 0.0 }),
        `${id}-${i}`
      ))
    );
  }
  
  const results = await Promise.all(promises);
  const contaminatedCount = results.filter(r => r.is_developer_contaminated).length;
  const cleanCount = REPEAT_COUNT - contaminatedCount;
  const contaminationRate = (contaminatedCount / REPEAT_COUNT) * 100;
  
  const majorityVerdict = contaminatedCount > (REPEAT_COUNT / 2) ? 'contaminated' : 'clean';
  const agreement = majorityVerdict === 'contaminated' ? contaminatedCount : cleanCount;
  const agreementRate = (agreement / REPEAT_COUNT) * 100;
  const isCorrect = majorityVerdict === expectedLabel;
  
  console.log(`  Expected: ${expectedLabel} | Majority: ${majorityVerdict} | Correct: ${isCorrect ? '✅' : '❌'}`);
  console.log(`  Agreement: ${agreementRate}% (${agreement}/${REPEAT_COUNT})`);
  console.log(`  Results array (1=contaminated, 0=clean): [${results.map(r => r.is_developer_contaminated ? '1' : '0').join(', ')}]`);
  
  return {
    id,
    expectedLabel,
    majorityVerdict,
    isCorrect,
    agreementRate,
    contaminationRate,
    runs: results.map((r, i) => ({
      run: i + 1,
      contaminated: r.is_developer_contaminated,
      type: r.contamination_type,
      confidence: r.confidence
    }))
  };
}

async function run() {
  const testSetPath = path.join(__dirname, 'test-sets', 'contamination-guard.json');
  const testSet = JSON.parse(fs.readFileSync(testSetPath, 'utf8'));
  
  console.log(`════════════════════════════════════════════════════════`);
  console.log(`  EXP-014E: Evaluator Repeatability & Test Set Validation`);
  console.log(`  Evaluator temp: 0.0, Repeats per case: ${REPEAT_COUNT}`);
  console.log(`════════════════════════════════════════════════════════`);
  
  const finalReport = {
    experiment: "EXP-014E",
    timestamp: new Date().toISOString(),
    cases: [] as any[]
  };
  
  let allCorrect = true;
  let allReliable = true;
  
  for (const item of testSet) {
    const res = await testRepeatability(item.id, item.text, item.label as 'clean' | 'contaminated');
    finalReport.cases.push(res);
    
    if (!res.isCorrect) allCorrect = false;
    if (res.agreementRate < 90) allReliable = false;
  }
  
  console.log(`\n════════════════════════════════════════════════════════`);
  console.log(`  SUMMARY`);
  console.log(`════════════════════════════════════════════════════════`);
  console.log(`  All Majority Verdicts Correct? ${allCorrect ? '✅ YES' : '❌ NO'}`);
  console.log(`  All Agreement Rates ≥ 90%?     ${allReliable ? '✅ YES' : '❌ NO'}`);
  
  const reportPath = path.join(__dirname, 'benchmark-reports', `exp-014E-baseline-${Date.now()}.json`);
  fs.writeFileSync(reportPath, JSON.stringify(finalReport, null, 2));
  console.log(`\n✅ Saved detailed report to ${reportPath}`);
}

run().catch(console.error);
