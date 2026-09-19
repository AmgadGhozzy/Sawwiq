import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { sessionConfig } from "@/lib/config";
import type { HistoryResponse, HistoryErrorResponse, GenerationHistoryItem } from "@/types/history";
import type { Json } from "@/lib/supabase/types";
import { normalizePlatform } from "@/lib/content/formats";

// ---------------------------------------------------------------------------
// GET /api/history?limit=20
//
// Security model:
//   1. Session identity comes ONLY from the httpOnly cookie - never from
//      query params or body sent by the client.
//   2. User identity comes ONLY from a server-verified Bearer JWT
//      (supabase.auth.getUser) - never trusted from client input.
//   3. Authenticated callers get rows WHERE user_id = uid OR session_id = cookie
//      session, so wiping cookies never empties a logged-in user's history.
//      Anonymous callers get session rows only (unchanged behavior).
//   4. We DO return `prompt` so the UI can reconstruct the settings panel and regenerate.
//   5. The `limit` query param is clamped server-side to [1, 50].
//   6. Uses service-role client which bypasses RLS (RLS blocks anon access).
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
    const supabase = getSupabaseAdmin();
    const limit = clampLimit(request.nextUrl.searchParams.get("limit"));

    // 1. Session identity from cookie ONLY (optional now — an authenticated
    //    user with no cookie still gets history via user_id below)
    let sessionId: string | null = null;
    const sessionToken = request.cookies.get(sessionConfig.cookieName)?.value;
    if (sessionToken) {
      const { data: session } = await supabase
        .from("sessions")
        .select("id")
        .eq("session_token", sessionToken)
        .single();
      sessionId = session?.id ?? null;
    }

    // 2. User identity from server-verified Bearer JWT ONLY
    let userId: string | null = null;
    const authHeader = request.headers.get("Authorization");
    if (authHeader?.startsWith("Bearer ")) {
      const { data: { user } } = await supabase.auth.getUser(authHeader.split(" ")[1]);
      userId = user?.id ?? null;
    }

    // 3. At least one identity is required. Logged-in + cookieless passes here
    //    on user_id alone — this is what kills the cookie-wipe churn.
    if (!sessionId && !userId) {
      return NextResponse.json(
        { success: false as const, error: { code: "SESSION_MISSING" } },
        { status: 401 }
      );
    }

    // 4. Fetch generations: user rows UNION session rows for authenticated
    //    callers (OR is deduplicated by row), session rows only for anonymous.
    const selectColumns =
      "id, platform, content_type, arabic_style, prompt, ai_response, metadata, created_at";
    const { data: generations, error: genError } = userId && sessionId
      ? await supabase
          .from("generations")
          .select(selectColumns)
          .or(`user_id.eq.${userId},session_id.eq.${sessionId}`)
          .order("created_at", { ascending: false })
          .limit(limit)
      : userId
        ? await supabase
            .from("generations")
            .select(selectColumns)
            .eq("user_id", userId)
            .order("created_at", { ascending: false })
            .limit(limit)
        : await supabase
            .from("generations")
            .select(selectColumns)
            .eq("session_id", sessionId as string)
            .order("created_at", { ascending: false })
            .limit(limit);

    if (genError) {
      console.error("[history] Failed to fetch generations:", genError.message);
      return NextResponse.json(
        { success: false as const, error: { code: "INTERNAL_ERROR" } },
        { status: 500 }
      );
    }

    // 4. Map DB rows to response shape - sanitize ai_response and restore metadata
    const items: GenerationHistoryItem[] = (generations ?? []).map((row) => {
      const parsed = parseAiResponse(row.ai_response);
      const meta = (row.metadata && typeof row.metadata === "object" && !Array.isArray(row.metadata))
        ? (row.metadata as Record<string, any>)
        : {};

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

      const normalizedPlatform = normalizePlatform(row.platform);

      return {
        id: row.id,
        platform: normalizedPlatform,
        contentType: row.content_type,
        arabicStyle: row.arabic_style,
        prompt: row.prompt,
        format: meta.format,
        mode: meta.mode,
        marketingObjective: meta.marketingObjective,
        persona: meta.persona,
        style: meta.style,
        intent: meta.intent,
        originality: meta.originality,
        tone: typeof meta.tone === "string" ? meta.tone : undefined,
        language:
          typeof meta.language === "string"
            ? (meta.language as "ar" | "en" | "bilingual")
            : undefined,
        keyMessage: typeof meta.keyMessage === "string" ? meta.keyMessage : undefined,
        metadata: meta,
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
