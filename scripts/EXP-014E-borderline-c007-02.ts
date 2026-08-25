import fs from 'fs';
import path from 'path';
import { evaluateIntellectualContamination } from '../lib/evaluation/intellectualContaminationGuard';

const delay = (ms: number) => new Promise(res => setTimeout(res, ms));

const REPEAT_COUNT = 10;
const MAX_CONCURRENT = 5;
let active = 0;
const queue: Array<() => void> = [];
function acquire() {
  return new Promise<void>(resolve => {
    if (active < MAX_CONCURRENT) { active++; resolve(); }
    else { queue.push(() => { active++; resolve(); }); }
  });
}
function release() {
  active--;
  if (queue.length) { const next = queue.shift()!; next(); }
}
async function limited<T>(fn: () => Promise<T>): Promise<T> {
  await acquire();
  try { return await fn(); }
  finally { release(); }
}
async function retry<T>(fn: () => Promise<T>, label: string): Promise<T> {
  const MAX_ATTEMPTS = 5;
  for (let i = 1; i <= MAX_ATTEMPTS; i++) {
    try { return await fn(); }
    catch (e: any) {
      if (i >= MAX_ATTEMPTS) throw e;
      const wait = 3000 * Math.pow(1.5, i - 1);
      console.error(`[Retry] ${label} failed (attempt ${i}). Waiting ${(wait / 1000).toFixed(1)}s...`);
      await delay(wait);
    }
  }
  throw new Error('Unreachable');
}

async function runCase(text: string, expected: 'clean' | 'contaminated') {
  const promises = [];
  for (let i = 1; i <= REPEAT_COUNT; i++) {
    promises.push(limited(() => retry(() => evaluateIntellectualContamination(text, { temperature: 0.0 }), `borderline-c007-02-${i}`)));
  }
  const results = await Promise.all(promises);
  const contaminated = results.filter(r => r.is_developer_contaminated).length;
  const clean = REPEAT_COUNT - contaminated;
  const majority = contaminated > REPEAT_COUNT / 2 ? 'contaminated' : 'clean';
  const agreement = majority === 'contaminated' ? contaminated : clean;
  console.log('--- Result for borderline-c007-02 ---');
  console.log(`Expected: ${expected}`);
  console.log(`Majority: ${majority}`);
  console.log(`Agreement: ${agreement}/${REPEAT_COUNT} (${((agreement / REPEAT_COUNT) * 100).toFixed(0)}%)`);
  console.log('Runs:', results.map(r => (r.is_developer_contaminated ? 1 : 0)));
}

async function main() {
  const testSetPath = path.join(__dirname, 'test-sets', 'contamination-guard.json');
  const testSet = JSON.parse(fs.readFileSync(testSetPath, 'utf8')) as any[];
  const item = testSet.find(i => i.id === 'borderline-c007-02');
  if (!item) {
    console.error('Item not found');
    return;
  }
  await runCase(item.text, item.label as 'clean' | 'contaminated');
}

main().catch(console.error);
