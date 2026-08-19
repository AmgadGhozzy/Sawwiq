import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { buildSystemPrompt, buildUserPrompt, getPromptLayers } from "../supabase/functions/generate/prompts/promptBuilder.ts";
import { ARABIC_STYLES, CONTENT_TYPES, PLATFORMS } from "../types/content";
import type { InputDTO } from "../supabase/functions/generate/validation/schema.ts";

describe("Prompt Engine - Full Matrix Testing (Edge Builder)", () => {
  describe("Dialect Layer Verifications", () => {
    test("verifies all 5 dialect modes produce dedicated instructions", () => {
      for (const style of ARABIC_STYLES) {
        const prompt = buildSystemPrompt({
          platform: "instagram",
          arabicStyle: style as InputDTO["arabicStyle"],
          contentType: "interactive_post",
          rawInput: "تجربة محتوى تسويقي طويل",
        });
        assert.ok(prompt.length > 200, `Prompt for ${style} is too short`);
        assert.ok(prompt.includes("قواعد عامة للكتابة التسويقية"), "Missing global rules");
        assert.ok(prompt.includes("متطلبات المحتوى"), "Missing output contract");
      }
    });

    test("verifies Egyptian dialect contains Egyptian-specific instructions", () => {
      const prompt = buildSystemPrompt({
        platform: "instagram",
        arabicStyle: "egyptian_colloquial",
        contentType: "interactive_post",
        rawInput: "تجربة محتوى تسويقي طويل",
      });
      assert.ok(prompt.includes("قواعد اللهجة المصرية"));
    });

    test("verifies Gulf dialect contains Gulf-specific instructions", () => {
      const prompt = buildSystemPrompt({
        platform: "instagram",
        arabicStyle: "gulf_premium",
        contentType: "ecommerce_product",
        rawInput: "تجربة محتوى تسويقي طويل",
      });
      assert.ok(prompt.includes("قواعد الأسلوب الخليجي الفخم"));
    });
  });

  describe("Content Type Layer Verifications", () => {
    test("verifies all 4 content types produce rules", () => {
      for (const contentType of CONTENT_TYPES) {
        const prompt = buildSystemPrompt({
          platform: "instagram",
          arabicStyle: "white_arabic",
          contentType: contentType as InputDTO["contentType"],
          rawInput: "تجربة محتوى تسويقي طويل",
        });
        assert.ok(prompt.length > 200);
      }
    });
  });

  describe("Platform Layer Verifications", () => {
    test("verifies platform specific rules are injected", () => {
      for (const platform of PLATFORMS) {
        const prompt = buildSystemPrompt({
          platform: platform as InputDTO["platform"],
          arabicStyle: "white_arabic",
          contentType: "sponsored_ad",
          rawInput: "تجربة محتوى تسويقي طويل",
        });
        assert.ok(prompt.includes("قواعد المنصة المستهدفة"), `Missing platform rules for ${platform}`);
        assert.ok(prompt.includes("STRICT RULE:"), `Missing STRICT RULE for ${platform}`);
      }
    });
  });

  describe("Fact Boundary Verifications", () => {
    test("verifies fact boundary rules are injected", () => {
      const prompt = buildSystemPrompt({
        platform: "instagram",
        arabicStyle: "white_arabic",
        contentType: "real_estate",
        rawInput: "تجربة محتوى تسويقي طويل",
      });
      assert.ok(prompt.includes("حدود الحقائق"));
      assert.ok(prompt.includes("EXPLICIT"));
      assert.ok(prompt.includes("SAFE_INFERENCE"));
      assert.ok(prompt.includes("UNSUPPORTED"));
    });
  });

  describe("User Prompt Builder", () => {
    test("formats user prompt properly", () => {
      const userPrompt = buildUserPrompt();
      assert.strictEqual(userPrompt, "اكتب المحتوى التسويقي بناءً على معلومات المستخدم المقدمة في سياق المحادثة.");
    });
  });

  describe("Prompt Layers Introspection", () => {
    test("returns discrete layers with labels for observability", () => {
      const layers = getPromptLayers({
        platform: "instagram",
        arabicStyle: "egyptian_colloquial",
        contentType: "interactive_post",
        rawInput: "تجربة محتوى تسويقي طويل",
      });
      assert.strictEqual(layers.length, 7); // Global, Platform, Dialect, ContentType, InputContext, FactBoundary, OutputContract
      assert.strictEqual(layers[0].label, "Global Rules");
      assert.strictEqual(layers[1].label, "Platform: instagram");
      assert.strictEqual(layers[2].label, "Arabic Style: egyptian_colloquial");
    });
  });
});
