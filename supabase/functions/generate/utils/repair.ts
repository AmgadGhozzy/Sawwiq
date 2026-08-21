export function repairVideoScriptTiming(body: string): string {
  // Pattern to match [Scene X — Ns] or [Scene X - Ns]
  const scenePattern = /\[Scene\s+(\d+)\s*([—–-])\s*(\d+)s?\]/gi;
  const matches = [...body.matchAll(scenePattern)];

  // Need at least 2 scenes to transfer the delta safely
  if (matches.length < 2) {
    return body; // Safe fallback
  }

  const scene1 = matches[0];
  const scene2 = matches[1];

  const s1Num = parseInt(scene1[1], 10);
  const s2Num = parseInt(scene2[1], 10);

  // Ensure they are actually Scene 1 and Scene 2
  if (s1Num !== 1 || s2Num !== 2) {
    return body; // Safe fallback
  }

  const s1Duration = parseInt(scene1[3], 10);
  const s2Duration = parseInt(scene2[3], 10);

  if (s1Duration <= 3) {
    return body; // Already valid
  }

  // Calculate delta to move to Scene 2
  const delta = s1Duration - 3;
  const newS1Duration = 3;
  const newS2Duration = s2Duration + delta;

  // Reconstruct exact strings preserving the original dash/hyphen spacing
  const newS1String = `[Scene 1 ${scene1[2]} ${newS1Duration}s]`;
  const newS2String = `[Scene 2 ${scene2[2]} ${newS2Duration}s]`;

  // Replace using precise offsets to avoid replacing unrelated text
  let newBody =
    body.substring(0, scene1.index) +
    newS1String +
    body.substring(scene1.index! + scene1[0].length, scene2.index) +
    newS2String +
    body.substring(scene2.index! + scene2[0].length);

  return newBody;
}
