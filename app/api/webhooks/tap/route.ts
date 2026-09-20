import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/server";

export async function POST(req: NextRequest) {
  try {
    const tapKey = process.env.TAP_SECRET_KEY;
    // Tap uses a Hashstring or Signature header for verification, NOT Bearer token.
    // The exact header name depends on the Tap API version (e.g., 'hashstring' or 'x-tap-signature').
    const hashStringHeader = req.headers.get("hashstring"); 

    if (tapKey !== "mock") {
      // TODO: (LIVE MODE) Implement HMAC-SHA256 validation here.
      // Example:
      // const rawBody = await req.text(); // Must read raw body for signature
      // const expectedHash = crypto.createHmac("sha256", tapKey).update(rawBody).digest("hex");
      // if (hashStringHeader !== expectedHash) { return 401; }
      
      console.warn("[TAP WEBHOOK] ⚠️ WARNING: HMAC Signature validation is not enforced yet.");
    }

    const body = await req.json();
    
    // Tap payload structure
    const { id, status, metadata } = body;

    if (!id || !status) {
      return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
    }

    // Rule 1: Only process CAPTURED (successful) payments
    if (status !== "CAPTURED") {
      console.log(`[TAP WEBHOOK] Ignoring status: ${status} for charge: ${id}`);
      return NextResponse.json({ received: true, ignored: true });
    }

    if (!metadata || !metadata.user_id || !metadata.credits) {
      console.error(`[TAP WEBHOOK] Missing metadata for charge: ${id}`);
      return NextResponse.json({ error: "Missing metadata" }, { status: 400 });
    }

    const supabaseAdmin = getSupabaseAdmin();

    // Rule 2: Idempotent credit awarding
    const { error } = await supabaseAdmin.rpc('award_credits', {
      p_user_id: metadata.user_id,
      p_amount: Number(metadata.credits),
      p_reason: 'purchase',
      p_idempotency_key: id
    });

    if (error) {
      // If the error is a unique constraint violation on idempotency key, it means we already processed this.
      if (error.code === '23505' || error.message?.includes('duplicate key') || error.message?.includes('idempotency')) {
        console.log(`[TAP WEBHOOK] Webhook already processed (idempotent): ${id}`);
        return NextResponse.json({ received: true, already_processed: true });
      }

      console.error(`[TAP WEBHOOK] Failed to award credits for charge ${id}:`, error);
      return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }

    console.log(`[TAP WEBHOOK] Successfully awarded ${metadata.credits} credits to user ${metadata.user_id} for charge ${id}`);
    
    return NextResponse.json({ received: true });
  } catch (err) {
    console.error("[TAP WEBHOOK] Error processing webhook:", err);
    return NextResponse.json({ error: "Webhook handler failed" }, { status: 500 });
  }
}
