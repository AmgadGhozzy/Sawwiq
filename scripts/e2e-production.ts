// scripts/e2e-production.ts
import { randomUUID } from "crypto";
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });
dotenv.config({ path: ".env" });

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

async function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function runE2E() {
  console.log("🚀 Starting Production E2E Audit...");
  
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    console.error("❌ Missing Supabase credentials in .env");
    process.exit(1);
  }

  const sessionToken = randomUUID();
  const fingerprint = randomUUID();
  const emailA = `e2e-a-${Date.now()}@example.com`;
  const emailB = `e2e-b-${Date.now()}@example.com`;

  const results = {
    sessionCreated: false,
    generations: { "1": "failed", "2": "failed", "3": "failed", "4": "failed" },
    historyCount: 0,
    waitlist: { firstBonus: false, secondBonus: false },
  };

  const headers = {
    "Content-Type": "application/json",
    "Cookie": `sawwiq_session=${sessionToken}`,
  };

  const payload = {
    platform: "instagram",
    arabicStyle: "egyptian_colloquial",
    contentType: "interactive_post",
    rawInput: "اختبار E2E للنظام الإنتاجي لضمان الجودة",
  };

  try {
    // 1. Generations
    for (let i = 1; i <= 4; i++) {
      console.log(`⏳ Generation #${i}...`);
      const res = await fetch(`${BASE_URL}/api/generate`, {
        method: "POST",
        headers,
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      
      if (i <= 3) {
        if (res.ok && data.success) {
          results.generations[i.toString() as keyof typeof results.generations] = "passed";
          results.sessionCreated = true;
        } else {
          console.error(`❌ Generation #${i} failed:`, data);
        }
      } else {
        if (res.status === 403 && data.error?.code === "RATE_LIMIT_REACHED") {
          results.generations["4"] = "blocked";
          console.log("✅ Generation #4 successfully blocked.");
        } else {
          console.error("❌ Generation #4 returned unexpected result:", data);
        }
      }
      
      await sleep(1000); // Small delay to simulate user behavior
    }

    // 2. History Check (Direct via DB)
    console.log("⏳ Checking history via Supabase...");
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
    
    // Get session ID by token
    const { data: session } = await supabase
      .from("sessions")
      .select("id")
      .eq("session_token", sessionToken)
      .single();

    if (session) {
      const { data: generations } = await supabase
        .from("generations")
        .select("id")
        .eq("session_id", session.id);
        
      results.historyCount = generations?.length || 0;
      if (results.historyCount === 3) {
        console.log("✅ History count is exactly 3.");
      } else {
        console.error(`❌ Expected 3 history records, got ${results.historyCount}`);
      }
    } else {
      console.error("❌ Session not found in DB for token:", sessionToken.substring(0, 8) + "...");
    }

    // 3. Waitlist Bonus Anti-Abuse
    console.log("⏳ Submitting Waitlist A...");
    const waitlistResA = await fetch(`${BASE_URL}/api/waitlist`, {
      method: "POST",
      headers,
      body: JSON.stringify({ email: emailA, fingerprint }),
    });
    const waitlistDataA = await waitlistResA.json();
    if (waitlistResA.ok && waitlistDataA.success && waitlistDataA.bonus) {
      results.waitlist.firstBonus = true;
      console.log("✅ First waitlist registration received bonus.");
    }

    console.log("⏳ Submitting Waitlist B (Same Fingerprint)...");
    const waitlistResB = await fetch(`${BASE_URL}/api/waitlist`, {
      method: "POST",
      headers,
      body: JSON.stringify({ email: emailB, fingerprint }),
    });
    const waitlistDataB = await waitlistResB.json();
    if (waitlistResB.ok && waitlistDataB.success && !waitlistDataB.bonus) {
      results.waitlist.secondBonus = false;
      console.log("✅ Second waitlist registration (same fingerprint) correctly denied bonus.");
    }

    console.log("\n🎯 Final Results:");
    console.log(JSON.stringify(results, null, 2));

  } catch (err) {
    console.error("❌ E2E Script Failed with Exception:", err);
  }
}

runE2E();
