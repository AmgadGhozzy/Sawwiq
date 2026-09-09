import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return NextResponse.json({ success: false, error: "Missing token" }, { status: 401 });
    }
    const token = authHeader.split(" ")[1];
    
    const supabase = getSupabaseAdmin();
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    
    if (userError || !user) {
      return NextResponse.json({ success: false, error: "Invalid token" }, { status: 401 });
    }

    const { data: creditRes, error: creditErr } = await supabase.rpc('get_credit_balance', {
      p_user_id: user.id
    });

    if (creditErr) {
      console.error("[balance] Failed to get credits:", creditErr);
      return NextResponse.json({ success: false, error: "Failed to load credits" }, { status: 500 });
    }

    const data = creditRes as unknown as { balance: number; exists: boolean };

    return NextResponse.json({ 
      success: true, 
      balance: data?.balance || 0
    });

  } catch (error) {
    console.error("[balance] Unexpected error:", error);
    return NextResponse.json({ success: false, error: "Internal Server Error" }, { status: 500 });
  }
}
