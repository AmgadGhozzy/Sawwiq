import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { sessionConfig } from "@/lib/config";
import type { HistoryResponse, HistoryErrorResponse, GenerationHistoryItem } from "@/types/history";
import type { Json } from "@/lib/supabase/types";

// ---------------------------------------------------------------------------
// GET /api/history?limit=20
//
// Security model:
//   1. Session identity comes ONLY from the httpOnly cookie — never from
//      query params, headers, or body sent by the client.
//   2. We do NOT return `prompt` — the UI doesn't need it.
//   3. The `limit` query param is clamped server-side to [1, 50].
//   4. Uses service-role client which bypasses RLS (RLS blocks anon access).
// ---------------------------------------------------------------------------

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 50;
const MIN_LIMIT = 1;

function clampLimit(raw: string | null): number {
  if (!raw) return DEFAULT_LIMIT;
  const parsed = parseInt(raw, 10);
  if (isNaN(parsed)) return DEFAULT_LIMIT;
  return Math.max(MIN_LIMIT, Math.min(MAX_LIMIT, parsed));
}

interface AiResponseShape {
  title?: string;
  hook?: string;
  body?: string;
  callToAction?: string;
  hashtags?: string[];
}

function parseAiResponse(val: Json): AiResponseShape | null {
  if (val !== null && typeof val === "object" && !Array.isArray(val)) {
    return val as unknown as AiResponseShape;
  }
  return null;
}

export async function GET(
  request: NextRequest
): Promise<NextResponse<HistoryResponse | HistoryErrorResponse>> {
  try {
    // 1. Extract session token from cookie ONLY
    const sessionToken = request.cookies.get(sessionConfig.cookieName)?.value;
    if (!sessionToken) {
      return NextResponse.json(
        { success: false as const, error: { code: "SESSION_MISSING" } },
        { status: 401 }
      );
    }

    const limit = clampLimit(request.nextUrl.searchParams.get("limit"));
    const supabase = getSupabaseAdmin();

    // 2. Resolve session_id from token — server-side only
    const { data: session, error: sessionError } = await supabase
      .from("sessions")
      .select("id")
      .eq("session_token", sessionToken)
      .single();

    if (sessionError || !session) {
      return NextResponse.json(
        { success: false as const, error: { code: "SESSION_MISSING" } },
        { status: 401 }
      );
    }

    // 3. Fetch generations for THIS session only — no prompt in select
    const { data: generations, error: genError } = await supabase
      .from("generations")
      .select("id, platform, content_type, arabic_style, ai_response, created_at")
      .eq("session_id", session.id)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (genError) {
      console.error("[history] Failed to fetch generations:", genError.message);
      return NextResponse.json(
        { success: false as const, error: { code: "INTERNAL_ERROR" } },
        { status: 500 }
      );
    }

    // 4. Map DB rows to response shape — sanitize ai_response
    const items: GenerationHistoryItem[] = (generations ?? []).map((row) => {
      const parsed = parseAiResponse(row.ai_response);
      const aiResponse = parsed
        ? {
            title: String(parsed.title ?? ""),
            hook: String(parsed.hook ?? ""),
            body: String(parsed.body ?? ""),
            callToAction: String(parsed.callToAction ?? ""),
            hashtags: Array.isArray(parsed.hashtags)
              ? parsed.hashtags.map(String)
              : [],
          }
        : { title: "", hook: "", body: "", callToAction: "", hashtags: [] as string[] };

      return {
        id: row.id,
        platform: row.platform,
        contentType: row.content_type,
        arabicStyle: row.arabic_style,
        aiResponse,
        createdAt: row.created_at,
      };
    });

    return NextResponse.json({
      success: true as const,
      data: items,
      count: items.length,
    });
  } catch (error) {
    console.error("[history] Unexpected error:", error);
    return NextResponse.json(
      { success: false as const, error: { code: "INTERNAL_ERROR" } },
      { status: 500 }
    );
  }
}
