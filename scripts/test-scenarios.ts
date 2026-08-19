// ---------------------------------------------------------------------------
// Standalone Verification Runner: 5 Real Production Scenarios
//
// Run with: npx tsx scripts/test-scenarios.ts
// ---------------------------------------------------------------------------

import { config } from "dotenv";
config({ path: ".env.local" });
config({ path: ".env" });

import { GeminiProvider } from "../lib/ai/gemini";
import type { GenerationInput } from "../types/content";

const SCENARIOS: { name: string; input: GenerationInput }[] = [
  {
    name: "1. مصري + بوست سوشيال ميديا",
    input: {
      platform: "instagram",
      contentType: "interactive_post",
      arabicStyle: "egyptian_colloquial",
      rawInput: "ساعة ذكية رياضية، بطارية 10 أيام، مقاومة للماء، شحن سريع في ساعة واحدة",
    },
  },
  {
    name: "2. خليجي + وصف منتج",
    input: {
      platform: "tiktok",
      contentType: "ecommerce_product",
      arabicStyle: "gulf_premium",
      rawInput: "ساعة ذكية رياضية، بطارية 10 أيام، مقاومة للماء حتى عمق 50 متر، شحن سريع",
    },
  },
  {
    name: "3. فصحى + وصف عقار",
    input: {
      platform: "linkedin",
      contentType: "real_estate",
      arabicStyle: "formal_b2b",
      rawInput: "شقة 3 غرف في التجمع الخامس، 180 متر، تشطيب كامل سوبر لوكس، قريبة من الجامعة الأمريكية",
    },
  },
  {
    name: "4. عربية بيضاء + إعلان ممول",
    input: {
      platform: "x_twitter",
      contentType: "sponsored_ad",
      arabicStyle: "white_arabic",
      rawInput: "مجموعة ساعات رياضية ذكية، 4 ألوان مختلفة، تدعم أندرويد وiOS، بطارية طويلة الأمد",
    },
  },
  {
    name: "5. مدخلات ناقصة/أولية جداً (Anti-hallucination check)",
    input: {
      platform: "tiktok",
      contentType: "real_estate",
      arabicStyle: "white_arabic",
      rawInput: "مكتب إداري 70 متر في العاصمة الإدارية",
    },
  },
];

async function runVerification() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error("\n❌ Error: GEMINI_API_KEY is not set in environment or .env.local");
    console.log("Please create a .env.local file with: GEMINI_API_KEY=your_key_here\n");
    process.exit(1);
  }

  console.log("\n🚀 Starting Production AI Verification across 5 Scenarios...\n");
  const provider = new GeminiProvider();

  for (const scenario of SCENARIOS) {
    console.log("=".repeat(70));
    console.log(`📌 Scenario: ${scenario.name}`);
    console.log(`Input: "${scenario.input.rawInput}"`);
    console.log("-".repeat(70));

    try {
      const result = await provider.generateContent(scenario.input);
      console.log(`⏱️ Latency: ${result.metadata.latencyMs}ms | Model: ${result.metadata.model}`);
      console.log(`🏷️ Title: ${result.content.title}`);
      console.log(`🎣 Hook: ${result.content.hook}`);
      console.log(`📝 Body:\n${result.content.body}`);
      console.log(`🎯 CTA: ${result.content.callToAction}`);
      console.log(`#️⃣ Hashtags: ${result.content.hashtags.map((t) => `#${t}`).join(" ")}`);
      console.log("✅ Passed validation & schema check\n");
    } catch (err) {
      console.error("❌ Failed scenario:", err);
    }
  }
}

runVerification();
