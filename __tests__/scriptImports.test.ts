import { test, describe } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";

const ROOT = process.cwd();
const SCRIPTS_DIR = path.join(ROOT, "scripts");

const CRITICAL_SCRIPTS = [
  "run-benchmark.ts",
  "EXP-004-creator-quality.ts",
  "EXP-005-perspective-ablation.ts",
  "EXP-006-perspective-v2.ts",
  "re-evaluate-exp-006.ts",
];

interface NamedImport {
  spec: string;
  names: string[];
}

async function localNamedImports(scriptRel: string): Promise<NamedImport[]> {
  const src = await readFile(path.join(SCRIPTS_DIR, scriptRel), "utf8");
  const out: NamedImport[] = [];
  const re = /import\s+(type\s+)?\{([^}]+)\}\s+from\s+["'](\.[^"']+)["']/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(src)) !== null) {
    if (m[1]) continue; // `import type {...}` — erased at runtime, nothing to resolve
    const names = m[2]
      .split(",")
      .map((raw) => raw.replace(/\/\*[\s\S]*?\*\//g, "").trim())
      .filter(Boolean)
      .filter((raw) => !/^type\s/.test(raw)) // inline `type X` members are also erased
      .map((raw) => raw.split(/\s+as\s+/)[0].trim());
    if (names.length > 0) out.push({ spec: m[3], names });
  }
  return out;
}

describe("Script import health (guards against deleted-export regressions)", () => {
  for (const rel of CRITICAL_SCRIPTS) {
    test(`${rel}: every local named import resolves`, async () => {
      const imports = await localNamedImports(rel);
      assert.ok(imports.length > 0, `${rel}: expected at least one relative named import`);

      for (const { spec, names } of imports) {
        const target = pathToFileURL(path.resolve(SCRIPTS_DIR, spec)).href;
        let mod: Record<string, unknown>;
        try {
          mod = (await import(target)) as Record<string, unknown>;
        } catch (e) {
          assert.fail(`${rel}: failed to import '${spec}': ${(e as Error).message}`);
        }
        for (const name of names) {
          assert.notEqual(
            mod[name],
            undefined,
            `${rel}: '${name}' does not exist in '${spec}' — a deleted/renamed export would crash this script at runtime`
          );
        }
      }
    });
  }
});
