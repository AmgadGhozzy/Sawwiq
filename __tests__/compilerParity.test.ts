import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  getPromptLayers as getProductionLayers,
} from "../supabase/functions/generate/prompts/promptBuilder";
import {
  getPromptLayers as getWrappedLayers,
  buildSystemPrompt,
} from "../lib/content/prompt/compiler";
import { buildPerspectiveConstraint } from "../lib/content/personas/perspectiveConstraint";

interface CaseInput {
  mode: string;
  platform: string;
  contentType: string;
  arabicStyle: string;
  rawInput: string;
  intent?: string;
  originality?: string;
  marketingObjective?: string;
  persona?: unknown;
  style?: unknown;
  metadata?: Record<string, unknown>;
  constraints?: { minLength?: number; maxLength?: number };
}

const baseCreator: CaseInput = {
  mode: "personal_creator",
  platform: "linkedin",
  contentType: "social_post",
  arabicStyle: "white_arabic",
  rawInput: "موضوع تجريبي لفحص التكافؤ بين المترجمين",
  intent: "education",
  originality: "creative",
  persona: { id: "developer", characteristics: ["تحليلي"], usePerspectiveConstraint: true },
  style: { name: "mystery", characteristics: ["تشويق"] },
};

const cases: Array<{
  name: string;
  raw: CaseInput;
  canon: CaseInput;
  expectConstraint: boolean;
}> = [
  {
    name: "creator with rich persona object",
    raw: baseCreator,
    canon: baseCreator,
    expectConstraint: true,
  },
  {
    name: "string persona + string style via metadata (lab dialect)",
    raw: {
      ...baseCreator,
      persona: undefined,
      style: undefined,
      metadata: { persona: "psychology", style: "storytelling", intent: "education" },
    },
    canon: {
      ...baseCreator,
      persona: { id: "psychology", name: "psychology" },
      style: { name: "storytelling" },
      intent: "education",
      originality: undefined,
    },
    expectConstraint: false, // String personas can't opt-in
  },
  {
    name: "opted-out persona (usePerspectiveConstraint=false)",
    raw: { ...baseCreator, persona: { id: "developer", usePerspectiveConstraint: false } },
    canon: { ...baseCreator, persona: { id: "developer", usePerspectiveConstraint: false } },
    expectConstraint: false,
  },
  {
    name: "unknown persona id",
    raw: { ...baseCreator, persona: { id: "no_such_persona", usePerspectiveConstraint: true } },
    canon: { ...baseCreator, persona: { id: "no_such_persona", usePerspectiveConstraint: true } },
    expectConstraint: false,
  },
  {
    name: "egyptian thread with constraints and brand context",
    raw: {
      ...baseCreator,
      platform: "x",
      contentType: "thread",
      arabicStyle: "egyptian",
      constraints: { minLength: 200, maxLength: 800 },
      metadata: { brandName: "علامة", targetAudience: "المطورون" },
    },
    canon: {
      ...baseCreator,
      platform: "x",
      contentType: "thread",
      arabicStyle: "egyptian",
      constraints: { minLength: 200, maxLength: 800 },
      metadata: { brandName: "علامة", targetAudience: "المطورون" },
    },
    expectConstraint: true,
  },
  {
    name: "marketing mode is never injected",
    raw: {
      mode: "marketing",
      platform: "linkedin",
      contentType: "social_post",
      arabicStyle: "white_arabic",
      rawInput: "عرض خدمة",
      marketingObjective: "leads",
      metadata: { brandName: "علامة" },
    },
    canon: {
      mode: "marketing",
      platform: "linkedin",
      contentType: "social_post",
      arabicStyle: "white_arabic",
      rawInput: "عرض خدمة",
      marketingObjective: "leads",
      metadata: { brandName: "علامة" },
    },
    expectConstraint: false,
  },
];

function insertBeforeLastRule(content: string, constraint: string): string {
  const idx = content.lastIndexOf("\n<rule>");
  if (idx === -1) return content;
  return content.slice(0, idx) + "\n" + constraint + content.slice(idx);
}

function toPrompt(layers: Array<{ tag: string; content: string }>): string {
  return layers.map((l) => `<${l.tag}>\n${l.content}\n</${l.tag}>`).join("\n\n");
}

function assertParity(name: string, input: CaseInput, envOff = false): void {
  const prod = getProductionLayers(input as never);
  const wrap = getWrappedLayers(input as never);

  assert.deepEqual(
    wrap.map((l) => l.tag),
    prod.map((l) => l.tag),
    `[${name}] layer sequence diverged from production`
  );

  const src = (input.persona ?? input.metadata?.persona) as
    | string
    | { id?: string; usePerspectiveConstraint?: boolean }
    | undefined;
  const opts = typeof src === "string" ? {} : (src ?? {});
  const pid = typeof src === "string" ? src : ((opts.id ?? "") as string);
  const willInject =
    !envOff &&
    input.mode !== "marketing" &&
    pid !== "" &&
    (opts as { usePerspectiveConstraint?: boolean }).usePerspectiveConstraint === true;
  const constraint = willInject ? buildPerspectiveConstraint(pid, "v2") : "";

  prod.forEach((prodLayer, i) => {
    const wrapLayer = wrap[i];
    if (prodLayer.tag === "persona" && constraint) {
      assert.equal(
        wrapLayer.content,
        insertBeforeLastRule(prodLayer.content, constraint),
        `[${name}] persona layer must equal production + inserted constraint`
      );
    } else {
      assert.equal(wrapLayer.content, prodLayer.content, `[${name}] layer '${prodLayer.tag}' diverged`);
    }
  });
}

describe("Compiler/Production Parity", () => {
  for (const c of cases) {
    test(`parity: ${c.name}`, () => {
      assertParity(c.name, c.canon, false);

      const prompt = buildSystemPrompt(c.raw as never);
      assert.equal(
        prompt.includes("<reasoning_contract>"),
        c.expectConstraint,
        `[${c.name}] injection presence mismatch on the raw lab input`
      );
    });
  }

  test("SAWWIQ_PERSPECTIVE_OFF=1 yields byte-identical output to production", () => {
    const previous = process.env.SAWWIQ_PERSPECTIVE_OFF;
    process.env.SAWWIQ_PERSPECTIVE_OFF = "1";
    try {
      for (const c of cases) {
        assertParity(`${c.name} [env off]`, c.canon, true);
        if (c.expectConstraint) {
          const prompt = buildSystemPrompt(c.raw as never);
          assert.ok(
            !prompt.includes("<reasoning_contract>") && !prompt.includes("<perspective_constraint>"),
            `[${c.name}] constraint must vanish under the kill switch`
          );
        }
      }
    } finally {
      if (previous === undefined) delete process.env.SAWWIQ_PERSPECTIVE_OFF;
      else process.env.SAWWIQ_PERSPECTIVE_OFF = previous;
    }
  });

  test("wrapper adds exactly the constraint bytes (deterministic delta)", () => {
    const prodPrompt = toPrompt(getProductionLayers(baseCreator as never));
    const wrapPrompt = buildSystemPrompt(baseCreator as never);
    const constraint = buildPerspectiveConstraint("developer", "v2");
    assert.equal(
      wrapPrompt.length - prodPrompt.length,
      constraint.length + "\n".length,
      "delta must be exactly the injected block plus one newline"
    );
  });

  test("prompt growth report for EXP cells", () => {
    const growths: string[] = [];
    for (const c of cases.filter((x) => x.expectConstraint)) {
      const prodPrompt = toPrompt(getProductionLayers(c.canon as never));
      const wrapPrompt = buildSystemPrompt(c.raw as never);
      const pct = (((wrapPrompt.length - prodPrompt.length) / prodPrompt.length) * 100).toFixed(1);
      growths.push(`${c.name}: ${pct}%`);
    }
    console.log("[parity] measured prompt growth per cell:\n  " + growths.join("\n  "));
  });
});
