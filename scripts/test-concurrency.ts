import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "crypto";
import * as dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing Supabase credentials in .env.local");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function runTests() {
  console.log("🚀 Starting Data Integrity & Concurrency Tests...\n");

  // 1. Create a fresh session for testing
  const sessionToken = `test_session_${randomUUID()}`;
  const { data: session, error: sessionError } = await supabase
    .from("sessions")
    .insert({ session_token: sessionToken, generations_count: 0, max_limit: 5 })
    .select("id")
    .single();

  if (sessionError || !session) {
    console.error("Failed to create test session:", sessionError);
    return;
  }
  const sessionId = session.id;

  const mockPayload = {
    p_session_id: sessionId,
    p_prompt: "Test prompt",
    p_platform: "tiktok",
    p_content_type: "sponsored_ad",
    p_arabic_style: "egyptian_colloquial",
    p_ai_response: { title: "Test", hook: "Hook", body: "Body", callToAction: "CTA", hashtags: ["#1"] }
  };

  // Test 1: Single Request
  console.log("📌 Test 1: Single Request → count +1");
  const req1 = randomUUID();
  const res1 = await supabase.rpc("persist_generation", { ...mockPayload, p_request_id: req1 });
  console.log("Result:", res1.data);
  const { data: check1 } = await supabase.from("sessions").select("generations_count").eq("id", sessionId).single();
  console.log(`Expected Count: 1 | Actual Count: ${check1?.generations_count}\n`);

  // Test 2: Idempotency (Same Request ID)
  console.log("📌 Test 2: Idempotency (Same Request ID) → count should remain 1");
  const res2 = await supabase.rpc("persist_generation", { ...mockPayload, p_request_id: req1 });
  console.log("Result (Should be success but no increment):", res2.data);
  const { data: check2 } = await supabase.from("sessions").select("generations_count").eq("id", sessionId).single();
  console.log(`Expected Count: 1 | Actual Count: ${check2?.generations_count}\n`);

  // Test 3: Concurrent Requests
  console.log("📌 Test 3: Two Concurrent Requests → count should be 3");
  const req3 = randomUUID();
  const req4 = randomUUID();
  
  await Promise.all([
    supabase.rpc("persist_generation", { ...mockPayload, p_request_id: req3 }),
    supabase.rpc("persist_generation", { ...mockPayload, p_request_id: req4 }),
  ]);

  const { data: check3 } = await supabase.from("sessions").select("generations_count").eq("id", sessionId).single();
  console.log(`Expected Count: 3 | Actual Count: ${check3?.generations_count}\n`);

  // Test 4: Quota Limit Reached
  console.log("📌 Test 4: Reaching Quota Limit");
  await supabase.rpc("persist_generation", { ...mockPayload, p_request_id: randomUUID() }); // Count = 4
  await supabase.rpc("persist_generation", { ...mockPayload, p_request_id: randomUUID() }); // Count = 5
  
  const reqLimit = randomUUID();
  const resLimit = await supabase.rpc("persist_generation", { ...mockPayload, p_request_id: reqLimit });
  console.log("Result over limit (Should fail):", resLimit.data);
  
  const { data: check4 } = await supabase.from("sessions").select("generations_count").eq("id", sessionId).single();
  console.log(`Expected Count: 5 | Actual Count: ${check4?.generations_count}\n`);

  // Clean up
  await supabase.from("sessions").delete().eq("id", sessionId);
  console.log("✅ Tests Completed and cleaned up.");
}

runTests().catch(console.error);
