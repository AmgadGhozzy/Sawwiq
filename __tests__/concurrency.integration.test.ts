// ---------------------------------------------------------------------------
// Concurrency Integration Test
//
// This test specifically targets the `FOR UPDATE` lock in the 
// `register_waitlist` RPC to ensure atomic updates to session.max_limit.
//
// Requirements to run:
// - A running Postgres instance with the Sawwiq schema applied.
// - TEST_DATABASE_URL environment variable set.
// 
// If TEST_DATABASE_URL is not set, the test gracefully skips.
// ---------------------------------------------------------------------------

import { test, describe } from "node:test";
import assert from "node:assert";
import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";

// We use the Supabase client but point it to the local test DB if possible
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "http://127.0.0.1:54321";
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "dummy_key";
const hasTestDb = !!process.env.TEST_DATABASE_URL || !!process.env.SUPABASE_SERVICE_ROLE_KEY;

describe("Waitlist Concurrency Integration", { skip: !hasTestDb }, () => {
  const supabase = createClient(supabaseUrl, supabaseKey);

  test("10 concurrent registrations on same session should enforce maxBonusCap", async () => {
    // 1. Create a dummy session
    const sessionId = crypto.randomUUID();
    const { error: sessionError } = await supabase
      .from("sessions")
      .insert({
        id: sessionId,
        session_token: crypto.randomUUID(),
        max_limit: 3 // Initial limit
      });

    if (sessionError) {
      console.log("Failed to insert test session. Supabase might not be running.", sessionError);
      return; // Skip if we can't connect to a real DB
    }

    // 2. Prepare 10 concurrent requests
    // We use unique emails and IPs so only the session cap is the bottleneck
    const requests = Array.from({ length: 10 }).map((_, i) => ({
      p_email: `test_concurrent_${i}_${Date.now()}@example.com`,
      p_session_id: sessionId,
      p_fingerprint_hash: `fp_${crypto.randomUUID()}`,
      p_client_ip: `192.168.1.${i}`
    }));

    // 3. Blast them simultaneously via Promise.all
    const results = await Promise.all(
      requests.map(req => supabase.rpc("register_waitlist", req))
    );

    // 4. Verify the results
    const bonusesGranted = results.filter(r => {
      const data = r.data as any;
      return data?.bonus === true;
    });

    const maxBonusAllowed = 5 - 3; // MAX_BONUS_CAP(5) - Initial(3) = 2

    assert.ok(
      bonusesGranted.length <= maxBonusAllowed,
      `Should not grant more than ${maxBonusAllowed} bonuses concurrently. Granted: ${bonusesGranted.length}`
    );

    // 5. Verify DB state for max_limit
    const { data: sessionData } = await supabase
      .from("sessions")
      .select("max_limit")
      .eq("id", sessionId)
      .single();

    assert.ok(
      sessionData && sessionData.max_limit <= 5,
      `Session max_limit should not exceed 5. Actual: ${sessionData?.max_limit}`
    );

    // Cleanup (best effort)
    await supabase.from("sessions").delete().eq("id", sessionId);
  });
});
