import { NextRequest, NextResponse } from "next/server";
import { ZodError } from "zod";
import { randomUUID } from "crypto";
import { generateInputSchema } from "@/lib/validation/generation";
import { getTracker } from "@/lib/analytics/tracker";
import { sessionConfig } from "@/lib/config";
import type { GenerateResponse } from "@/types/content";
import { ERROR_CODES, ERROR_MESSAGES } from "@/types/content";

function errorResponse(
  code: string,
  message: string,
  requestId: string,
  status: number
): NextResponse<GenerateResponse> {
  return NextResponse.json(
    { success: false as const, error: { code, message }, meta: { requestId } },
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
        "لم يتم تكوين قاعدة البيانات بشكل صحيح.",
        requestId,
        503
      );
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return errorResponse(ERROR_CODES.VALIDATION_ERROR, ERROR_MESSAGES.VALIDATION_ERROR, requestId, 400);
    }

    // Validate the input before forwarding
    generateInputSchema.parse(body);

    const sessionToken = request.cookies.get(sessionConfig.cookieName)?.value;
    if (!sessionToken) {
      return errorResponse(
        ERROR_CODES.INTERNAL_ERROR,
        "جلسة غير صالحة. أعد تحميل الصفحة وحاول مرة أخرى.",
        requestId,
        400
      );
    }

    const edgeFunctionUrl = `${supabaseUrl}/functions/v1/generate`;

    let edgeRes: Response;
    try {
      edgeRes = await fetch(edgeFunctionUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-session-token": sessionToken,
          Authorization: `Bearer ${anonKey}`,
          apikey: anonKey,
        },
        body: JSON.stringify(body),
      });
    } catch (err) {
      console.error(`[${requestId}] Edge function fetch failed:`, err);
      return errorResponse(ERROR_CODES.GENERATION_FAILED, ERROR_MESSAGES.GENERATION_FAILED, requestId, 502);
    }

    const edgeData = await edgeRes.json() as Record<string, unknown>;

    // Rate limit reached
    if (edgeRes.status === 403 && edgeData.error === "RATE_LIMIT_REACHED") {
      return NextResponse.json(
        {
          success: false as const,
          error: {
            code: ERROR_CODES.RATE_LIMIT_REACHED,
            message: (edgeData.message as string) ?? ERROR_MESSAGES.RATE_LIMIT_REACHED,
          },
          meta: { requestId },
        },
        { status: 403 }
      );
    }

    if (!edgeRes.ok || !edgeData.success) {
      const code = (edgeData.error as string) ?? ERROR_CODES.GENERATION_FAILED;
      const message = (edgeData.message as string) ?? ERROR_MESSAGES.GENERATION_FAILED;
      return NextResponse.json(
        { success: false as const, error: { code, message }, meta: { requestId } },
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
      const firstMessage = error.issues[0]?.message ?? ERROR_MESSAGES.VALIDATION_ERROR;
      return errorResponse(ERROR_CODES.VALIDATION_ERROR, firstMessage, requestId, 400);
    }

    console.error(`[${requestId}] Generation proxy error:`, error);
    return errorResponse(ERROR_CODES.GENERATION_FAILED, ERROR_MESSAGES.GENERATION_FAILED, requestId, 500);
  }
}
