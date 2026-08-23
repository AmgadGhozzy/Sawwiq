import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { buildSystemPrompt, USER_PROMPT, getPromptLayers } from "../supabase/functions/generate/prompts/promptBuilder.ts";
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
        assert.ok(prompt.includes("Write strictly in Arabic"), "Missing global rules");
        assert.ok(prompt.includes("FIELD REQUIREMENTS"), "Missing output contract");
      }
    });

    test("verifies Egyptian dialect contains Egyptian-specific instructions", () => {
      const prompt = buildSystemPrompt({
        platform: "instagram",
        arabicStyle: "egyptian_colloquial",
        contentType: "interactive_post",
        rawInput: "تجربة محتوى تسويقي طويل",
      });
      assert.ok(prompt.includes("DIALECT: Egyptian Colloquial"));
    });

    test("verifies Gulf dialect contains Gulf-specific instructions", () => {
      const prompt = buildSystemPrompt({
        platform: "instagram",
        arabicStyle: "gulf_premium",
        contentType: "ecommerce_product",
        rawInput: "تجربة محتوى تسويقي طويل",
      });
      assert.ok(prompt.includes("DIALECT: Premium Gulf"));
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
        assert.ok(prompt.includes("PLATFORM:"), `Missing platform rules for ${platform}`);
        assert.ok(prompt.includes("PLATFORM RULES:"), `Missing platform rule text for ${platform}`);
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
      assert.ok(prompt.includes("<allowed>"));
      assert.ok(prompt.includes("<forbidden>"));
      assert.ok(prompt.includes("<creative_language>"));
    });
  });

  describe("User Prompt Builder", () => {
    test("formats user prompt properly", () => {
      assert.strictEqual(
        USER_PROMPT,
        "اكتب المحتوى التسويقي بناءً على معلومات المستخدم المقدمة في سياق المحادثة."
      );
    });
  });

  describe("Alias Equivalence", () => {
    test("legacy content types resolve to identical prompts as canonical twins", () => {
      const pairs: [InputDTO["contentType"], InputDTO["contentType"]][] = [
        ["sponsored_ad", "advertisement"],
        ["interactive_post", "social_post"],
        ["ecommerce_product", "product_description"],
        ["real_estate", "real_estate_listing"],
        ["short_video_script", "video_script"],
        ["marketing_email", "email"],
      ];
      for (const [legacy, canonical] of pairs) {
        const legacyPrompt = buildSystemPrompt({
          platform: "instagram",
          arabicStyle: "white_arabic",
          contentType: legacy,
          rawInput: "تجربة محتوى تسويقي طويل",
        });
        const canonicalPrompt = buildSystemPrompt({
          platform: "instagram",
          arabicStyle: "white_arabic",
          contentType: canonical,
          rawInput: "تجربة محتوى تسويقي طويل",
        });
        assert.strictEqual(legacyPrompt, canonicalPrompt, `${legacy} !== ${canonical}`);
      }
    });

    test("x_twitter resolves to the same rules as x", () => {
      const build = (platform: InputDTO["platform"]) =>
        buildSystemPrompt({
          platform,
          arabicStyle: "white_arabic",
          contentType: "social_post",
          rawInput: "تجربة محتوى تسويقي طويل",
        }).replace("PLATFORM: x_twitter", "PLATFORM: x");
      assert.strictEqual(build("x_twitter"), build("x"));
    });
  });

  describe("Context Layer", () => {
    test("injects brand and audience as a dedicated context layer", () => {
      const layers = getPromptLayers({
        platform: "instagram",
        arabicStyle: "saudi_marketing",
        contentType: "product_description",
        metadata: { brandName: "عطر نجد", targetAudience: "محبو العود" },
        rawInput: "دهن عود معتق طبيعي بثبات وفوحان مميزين",
      });
      const context = layers.find((l) => l.tag === "context");
      assert.ok(context, "missing context layer");
      assert.ok(context.content.includes("<brand_name>عطر نجد</brand_name>"));
      assert.ok(context.content.includes("<target_audience>محبو العود</target_audience>"));
    });

    test("omits context layer when brand and audience are absent", () => {
      const layers = getPromptLayers({
        platform: "instagram",
        arabicStyle: "saudi_marketing",
        contentType: "product_description",
        rawInput: "دهن عود معتق طبيعي بثبات وفوحان مميزين",
      });
      assert.strictEqual(layers.find((l) => l.tag === "context"), undefined);
    });
  });

  describe("Type-Specific Fact Restrictions", () => {
    test("injects forbidden claims of the content type into fact_boundary", () => {
      const prompt = buildSystemPrompt({
        platform: "instagram",
        arabicStyle: "white_arabic",
        contentType: "real_estate_listing",
        rawInput: "فيلا مستقلة في دبي هيلز مع مسبح خاص",
      });
      assert.ok(prompt.includes("<type_restrictions>"));
      assert.ok(prompt.includes("وعود بعوائد أو أرباح استثمارية"));
    });

    test("includes missing-fact behavior guidance", () => {
      const prompt = buildSystemPrompt({
        platform: "instagram",
        arabicStyle: "white_arabic",
        contentType: "email",
        rawInput: "تجربة محتوى تسويقي طويل",
      });
      assert.ok(prompt.includes("<behavior>"));
      assert.ok(prompt.includes("Never invent it."));
    });
  });

  describe("Length Constraints", () => {
    test("renders length constraint line when constraints provided", () => {
      const prompt = buildSystemPrompt({
        platform: "x",
        arabicStyle: "white_arabic",
        contentType: "social_post",
        constraints: { maxLength: 280 },
        rawInput: "تجربة محتوى تسويقي طويل",
      });
      assert.ok(prompt.includes("حد أقصى 280 حرف"));
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
      assert.strictEqual(layers.length, 9); // SystemPersona, GlobalRules, Platform, AntiGenericness, Dialect, ContentType, FactBoundary, OutputContract, UserInput
      assert.strictEqual(layers[0].tag, "system_persona");
      assert.strictEqual(layers[1].tag, "global_rules");
      assert.strictEqual(layers[2].tag, "platform_context");
    });
  });
});
