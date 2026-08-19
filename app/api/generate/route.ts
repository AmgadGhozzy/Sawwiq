import { NextRequest, NextResponse } from "next/server";
import { ZodError } from "zod";
import { randomUUID } from "crypto";
import { generateInputSchema } from "@/lib/validation/generation";
import { getTracker } from "@/lib/analytics/tracker";
import { sessionConfig } from "@/lib/config";
import type { GenerateResponse } from "@/types/content";
import { ERROR_CODES } from "@/types/content";

const MAX_BODY_SIZE = 10_240; // 10 KB hard ceiling

function errorResponse(
  code: string,
  requestId: string,
  status: number
): NextResponse<GenerateResponse> {
  return NextResponse.json(
    { success: false as const, error: { code }, meta: { requestId } },
    { status }
  );
}

export async function POST(
  request: NextRequest
): Promise<NextResponse<GenerateResponse>> {
  const requestId = randomUUID();
  const tracker = getTracker();

  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !anonKey || supabaseUrl.includes("your-project")) {
      console.error(`[${requestId}] Supabase is not configured properly`);
      return errorResponse(
        ERROR_CODES.INTERNAL_ERROR,
        requestId,
        503
      );
    }

    // ── Body size protection ─────────────────────────────────────────
    // Early reject via Content-Length header (if present)
    const contentLength = parseInt(request.headers.get("content-length") ?? "0", 10);
    if (contentLength > MAX_BODY_SIZE) {
      return errorResponse(ERROR_CODES.VALIDATION_ERROR, requestId, 413);
    }

    // Hard ceiling: read body as text first, enforce size limit regardless
    // of Content-Length accuracy (clients can omit or lie about it)
    let rawBody: string;
    try {
      rawBody = await request.text();
    } catch {
      return errorResponse(ERROR_CODES.VALIDATION_ERROR, requestId, 400);
    }

    if (rawBody.length > MAX_BODY_SIZE) {
      return errorResponse(ERROR_CODES.VALIDATION_ERROR, requestId, 413);
    }

    let body: unknown;
    try {
      body = JSON.parse(rawBody);
    } catch {
      return errorResponse(ERROR_CODES.VALIDATION_ERROR, requestId, 400);
    }

    // Validate the input before forwarding
    generateInputSchema.parse(body);

    // Defense-in-depth: strip session identity from body before forwarding.
    // The Edge Function reads session exclusively from x-session-token header,
    // but we remove these keys to prevent regression-based identity spoofing.
    if (body && typeof body === "object") {
      const sanitized = body as Record<string, unknown>;
      delete sanitized.session_token;
      delete sanitized.sessionToken;
    }

    const sessionToken = request.cookies.get(sessionConfig.cookieName)?.value;
    if (!sessionToken) {
      return errorResponse(
        ERROR_CODES.SESSION_MISSING,
        requestId,
        401
      );
    }

    const edgeFunctionUrl = `${supabaseUrl}/functions/v1/generate`;

    let edgeRes: Response;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 35000); // 35s timeout

    try {
      edgeRes = await fetch(edgeFunctionUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-session-token": sessionToken,
          "x-request-id": requestId,
          Authorization: `Bearer ${anonKey}`,
          apikey: anonKey,
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
    } catch (err: unknown) {
      clearTimeout(timeoutId);
      if (err instanceof DOMException && err.name === "AbortError") {
        console.error(`[${requestId}] Edge function fetch timed out after 35s`);
        return errorResponse(ERROR_CODES.TIMEOUT, requestId, 504);
      }
      console.error(`[${requestId}] Edge function fetch failed:`, err);
      return errorResponse(ERROR_CODES.GENERATION_FAILED, requestId, 502);
    }

    const edgeData = await edgeRes.json() as Record<string, unknown>;

    // Rate limit reached
    if (edgeRes.status === 403 && edgeData.error === "RATE_LIMIT_REACHED") {
      return NextResponse.json(
        {
          success: false as const,
          error: {
            code: ERROR_CODES.RATE_LIMIT_REACHED,
          },
          meta: { requestId },
        },
        { status: 403 }
      );
    }

    if (!edgeRes.ok || !edgeData.success) {
      const rawCode = (edgeData.error as string) ?? ERROR_CODES.GENERATION_FAILED;
      const code = rawCode in ERROR_CODES
        ? rawCode as keyof typeof ERROR_CODES
        : ERROR_CODES.GENERATION_FAILED;
      return NextResponse.json(
        { success: false as const, error: { code }, meta: { requestId } },
        { status: edgeRes.status }
      );
    }

    return NextResponse.json({
      success: true as const,
      data: edgeData.result as GenerateResponse extends { success: true } ? GenerateResponse["data"] : never,
      remainingGenerations: (edgeData.remainingGenerations as number) ?? 0,
      meta: { requestId },
    });

  } catch (error) {
    tracker.track("generation_failed", { requestId });

    if (error instanceof ZodError) {
      return errorResponse(ERROR_CODES.VALIDATION_ERROR, requestId, 400);
    }

    console.error(`[${requestId}] Generation proxy error:`, error);
    return errorResponse(ERROR_CODES.GENERATION_FAILED, requestId, 500);
  }
}
