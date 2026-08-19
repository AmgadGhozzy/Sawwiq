import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { PLATFORMS, CONTENT_TYPES, ARABIC_STYLES } from "../types/content";
import dataset from "../lib/evaluation/dataset.json";

const platformSet = new Set(PLATFORMS);
const contentTypeSet = new Set(CONTENT_TYPES);
const arabicStyleSet = new Set(ARABIC_STYLES);

type DatasetEntry = (typeof dataset)[number] & { input?: Record<string, unknown> };

describe("Dataset Enum Validation", () => {
  test("dataset is non-empty", () => {
    assert.ok(dataset.length > 0, "Dataset should contain at least one entry");
  });

  test("every dataset entry input.contentType is a valid ContentType", () => {
    const invalid = (dataset as DatasetEntry[]).filter(
      (e) => !contentTypeSet.has((e.input?.contentType as string) as typeof CONTENT_TYPES[number])
    );
    assert.deepStrictEqual(
      invalid.map((e) => ({ id: e.id, contentType: e.input?.contentType })),
      [],
      `Invalid contentTypes: ${invalid.map((e) => `${e.id}="${String(e.input?.contentType)}"`).join(", ")}`
    );
  });

  test("every dataset entry input.arabicStyle is a valid ArabicStyle", () => {
    const invalid = (dataset as DatasetEntry[]).filter(
      (e) => !arabicStyleSet.has((e.input?.arabicStyle as string) as typeof ARABIC_STYLES[number])
    );
    assert.deepStrictEqual(
      invalid.map((e) => ({ id: e.id, arabicStyle: e.input?.arabicStyle })),
      [],
      `Invalid arabicStyles: ${invalid.map((e) => `${e.id}="${String(e.input?.arabicStyle)}"`).join(", ")}`
    );
  });

  test("every dataset entry input.platform (if present) is a valid Platform", () => {
    const invalid = (dataset as DatasetEntry[]).filter(
      (e) => e.input?.platform && !platformSet.has((e.input.platform as string) as typeof PLATFORMS[number])
    );
    assert.deepStrictEqual(
      invalid.map((e) => ({ id: e.id, platform: e.input?.platform })),
      [],
      `Invalid platforms: ${invalid.map((e) => `${e.id}="${String(e.input?.platform)}"`).join(", ")}`
    );
  });
});
