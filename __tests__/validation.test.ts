import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { generateInputSchema, generatedContentSchema } from "../lib/validation/generation";
import { aiConfig } from "../lib/config";

describe("Validation Schemas - Edge Cases", () => {
  describe("generateInputSchema", () => {
    test("validates valid input for all valid styles and content types", () => {
      const input = {
        platform: "instagram",
        contentType: "sponsored_ad",
        arabicStyle: "white_arabic",
        rawInput: "شقة 180 متر في التجمع الخامس تشطيب سوبر لوكس",
      };
      assert.doesNotThrow(() => generateInputSchema.parse(input));
    });

    test("fails when contentType is invalid string", () => {
      const input = {
        contentType: "invalid_type",
        arabicStyle: "egyptian",
        rawInput: "شقة 180 متر في التجمع الخامس",
      };
      assert.throws(() => generateInputSchema.parse(input));
    });

    test("fails when arabicStyle is invalid string", () => {
      const input = {
        contentType: "social_post",
        arabicStyle: "french",
        rawInput: "شقة 180 متر في التجمع الخامس",
      };
      assert.throws(() => generateInputSchema.parse(input));
    });

    test("fails when rawInput is less than 10 chars", () => {
      const input = {
        platform: "instagram",
        contentType: "sponsored_ad",
        arabicStyle: "white_arabic",
        rawInput: "شقة صغيرة", // 9 chars
      };
      assert.throws(() => generateInputSchema.parse(input));
    });

    test("fails when rawInput exceeds maxInputLength", () => {
      const input = {
        platform: "instagram",
        contentType: "sponsored_ad",
        arabicStyle: "white_arabic",
        rawInput: "أ".repeat(aiConfig.maxInputLength + 1),
      };
      assert.throws(() => generateInputSchema.parse(input));
    });

    test("trims whitespace from rawInput", () => {
      const input = {
        platform: "instagram",
        contentType: "sponsored_ad",
        arabicStyle: "white_arabic",
        rawInput: "   شقة 180 متر في التجمع الخامس   ",
      };
      const parsed = generateInputSchema.parse(input);
      assert.strictEqual(parsed.rawInput, "شقة 180 متر في التجمع الخامس");
    });
  });

  describe("generatedContentSchema (Output Validation)", () => {
    test("validates complete structured marketing output", () => {
      const output = {
        title: "ساعة ذكية تواكب يومك",
        hook: "بطارية تدوم 10 أيام بدون توقف",
        body: "تصميم أنيق ومقاومة للماء تجعلها رفيقك المثالي في التمارين والعمل.",
        callToAction: "اطلب ساعتك اليوم واستمتع بالعرض",
        hashtags: ["ساعة_ذكية", "تكنولوجيا", "رياضة", "أناقة", "تقنية"],
      };
      assert.doesNotThrow(() => generatedContentSchema.parse(output));
    });

    test("fails when title is empty string", () => {
      const output = {
        title: "",
        hook: "بطارية تدوم 10 أيام",
        body: "محتوى",
        callToAction: "اطلب الآن",
        hashtags: ["تقنية", "ساعة", "ذكية", "رياضة", "ممتازة"],
      };
      assert.throws(() => generatedContentSchema.parse(output));
    });

    test("fails when hashtags array is empty", () => {
      const output = {
        title: "العنوان",
        hook: "الـ Hook",
        body: "المحتوى",
        callToAction: "اطلب الآن",
        hashtags: [],
      };
      assert.throws(() => generatedContentSchema.parse(output));
    });

    test("fails when hashtags array contains empty strings", () => {
      const output = {
        title: "العنوان",
        hook: "الـ Hook",
        body: "المحتوى",
        callToAction: "اطلب الآن",
        hashtags: ["تقنية", "ساعة", "ذكية", "رياضة", ""],
      };
      assert.throws(() => generatedContentSchema.parse(output));
    });

    test("fails when hashtags array contains less than 5 items", () => {
      const output = {
        title: "العنوان",
        hook: "الـ Hook",
        body: "المحتوى",
        callToAction: "اطلب الآن",
        hashtags: ["تقنية", "ساعة", "ذكية", "ممتازة"],
      };
      assert.throws(() => generatedContentSchema.parse(output));
    });

    test("fails when hashtags array contains more than 8 items", () => {
      const output = {
        title: "العنوان",
        hook: "الـ Hook",
        body: "المحتوى",
        callToAction: "اطلب الآن",
        hashtags: ["1", "2", "3", "4", "5", "6", "7", "8", "9"],
      };
      assert.throws(() => generatedContentSchema.parse(output));
    });

    test("fails when hashtags contain #", () => {
      const output = {
        title: "العنوان",
        hook: "الـ Hook",
        body: "المحتوى",
        callToAction: "اطلب الآن",
        hashtags: ["تقنية", "ساعة", "#ذكية", "رياضة", "ممتازة"],
      };
      assert.throws(() => generatedContentSchema.parse(output));
    });

    test("fails when hashtags are duplicated", () => {
      const output = {
        title: "العنوان",
        hook: "الـ Hook",
        body: "المحتوى",
        callToAction: "اطلب الآن",
        hashtags: ["تقنية", "ساعة", "تقنية", "رياضة", "ممتازة"],
      };
      assert.throws(() => generatedContentSchema.parse(output));
    });
  });
});
