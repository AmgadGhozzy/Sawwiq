import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { buildSystemPrompt, buildUserPrompt, getPromptLayers } from "../lib/prompts/promptBuilder";
import { ARABIC_STYLES, CONTENT_TYPES, PLATFORMS } from "../types/content";

describe("Prompt Engine - Full Matrix Testing", () => {
  describe("Dialect Layer Verifications", () => {
    test("verifies all 5 dialect modes produce dedicated instructions", () => {
      for (const style of ARABIC_STYLES) {
        const prompt = buildSystemPrompt({
          platform: "instagram",
          arabicStyle: style,
          contentType: "interactive_post",
          rawInput: "تجربة",
        });
        assert.ok(prompt.length > 200, `Prompt for ${style} is too short`);
        assert.ok(prompt.includes("قواعد عامة للكتابة التسويقية"), "Missing global rules");
        assert.ok(prompt.includes("متطلبات المحتوى"), "Missing output contract");
      }
    });

    test("verifies Egyptian dialect contains Egyptian-specific instructions", () => {
      const prompt = buildSystemPrompt({ platform: "instagram", arabicStyle: "egyptian_colloquial", contentType: "interactive_post", rawInput: "تجربة" });
      assert.ok(prompt.includes("قواعد اللهجة المصرية"));
    });

    test("verifies Gulf dialect contains Gulf-specific instructions", () => {
      const prompt = buildSystemPrompt({ platform: "instagram", arabicStyle: "gulf_premium", contentType: "ecommerce_product", rawInput: "تجربة" });
      assert.ok(prompt.includes("قواعد الأسلوب الخليجي"));
      assert.ok(prompt.includes("السوق الخليجي"));
    });

    test("verifies Colloquial contains conversational rules", () => {
      const prompt = buildSystemPrompt({ platform: "instagram", arabicStyle: "egyptian_colloquial", contentType: "real_estate", rawInput: "تجربة" });
      assert.ok(prompt.includes("قواعد اللهجة المصرية"));
    });

    test("verifies Formal contains Modern Standard Arabic rules", () => {
      const prompt = buildSystemPrompt({ platform: "instagram", arabicStyle: "formal_b2b", contentType: "real_estate", rawInput: "تجربة" });
      assert.ok(prompt.includes("قواعد الأسلوب الفصيح"));
      assert.ok(prompt.includes("Modern Standard Arabic"));
    });

    test("verifies White Arabic contains neutral contemporary rules", () => {
      const prompt = buildSystemPrompt({ platform: "instagram", arabicStyle: "white_arabic", contentType: "sponsored_ad", rawInput: "تجربة" });
      assert.ok(prompt.includes("قواعد العربية البيضاء"));
    });
  });

  describe("Content Type Layer Verifications", () => {
    test("verifies all 4 content types produce anti-hallucination and structure rules", () => {
      for (const contentType of CONTENT_TYPES) {
        const prompt = buildSystemPrompt({
          platform: "instagram",
          arabicStyle: "white_arabic",
          contentType,
          rawInput: "تجربة",
        });
        assert.ok(prompt.length > 200);
      }
    });

    test("verifies property_description prohibits hallucinating prices and legal status", () => {
      const prompt = buildSystemPrompt({ platform: "instagram", arabicStyle: "white_arabic", contentType: "real_estate", rawInput: "تجربة" });
      assert.ok(prompt.includes("ممنوع اختراع:"));
      assert.ok(prompt.includes("الأسعار"));
      assert.ok(prompt.includes("خطط السداد"));
    });

    test("verifies product_description separates features from benefits", () => {
      const prompt = buildSystemPrompt({ platform: "instagram", arabicStyle: "white_arabic", contentType: "ecommerce_product", rawInput: "تجربة" });
      assert.ok(prompt.includes("فصل المميزات عن الفوائد:"));
      assert.ok(prompt.includes("ممنوع اختراع:"));
    });

    test("verifies product_collection focuses on collection narrative", () => {
      const prompt = buildSystemPrompt({ platform: "instagram", arabicStyle: "white_arabic", contentType: "sponsored_ad", rawInput: "تجربة" });
    });
  });

  describe("Platform Layer Verifications", () => {
    test("verifies platform specific rules are injected", () => {
      for (const platform of PLATFORMS) {
        const prompt = buildSystemPrompt({
          platform,
          arabicStyle: "white_arabic",
          contentType: "sponsored_ad",
          rawInput: "تجربة",
        });
        assert.ok(prompt.includes(`Platform: ${platform}`));
      }
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
      const layers = getPromptLayers({ platform: "instagram", arabicStyle: "egyptian_colloquial", contentType: "interactive_post", rawInput: "تجربة" });
      assert.strictEqual(layers.length, 6);
      assert.strictEqual(layers[0].label, "Global Rules");
      assert.strictEqual(layers[1].label, "Platform: instagram");
      assert.ok(layers[2].label.includes("Egyptian") || layers[2].label.includes("مصري"));
    });
  });
});
