import { NextRequest, NextResponse } from "next/server";
import { after } from "next/server";
import { ZodError } from "zod";
import { randomUUID } from "crypto";
import { generateInputSchema } from "@/lib/validation/generation";
import { getTracker } from "@/lib/analytics/tracker";
import { sessionConfig } from "@/lib/config";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import type { GenerateResponse } from "@/types/content";
import type { Json } from "@/lib/supabase/types";
import { ERROR_CODES } from "@/types/content";
import { extractPipelineBErrorCode, normalizePipelineBError } from "@/lib/utils/pipelineBErrors";

const MAX_BODY_SIZE = 10_240; // 10 KB hard ceiling

// Sentinel value written by claim_and_merge_session for auth users.
// If the pipeline leaks this (e.g. expired JWT → unauthenticated fallback),
// return null so the badge stays hidden rather than showing 2 billion.
const SESSION_UNLIMITED_SENTINEL = 2_147_483_647;
function sanitizeRemaining(raw: number | null | undefined): number | null {
  if (raw == null || raw >= SESSION_UNLIMITED_SENTINEL / 2) return null;
  return raw;
}

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
  const requestId = request.headers.get("x-request-id") || randomUUID();
  const tracker = getTracker();
  let userId: string | null = null;
  let userToken: string | null = null; // verified access token, forwarded to Edge for user attribution
  let creditDeducted = false; // tracks whether a credit was deducted so we can refund on failure

  // Refund helper — call before every failure return that occurs after deduction.
  // Sets creditDeducted = false after execution to prevent double-refunds.
  const refundIfNeeded = async () => {
    if (!creditDeducted || !userId) return;
    const supabase = getSupabaseAdmin();
    const { error: refundErr } = await supabase.rpc('refund_credit', {
      p_user_id: userId,
      p_request_id: requestId,
    });
    
    if (refundErr) {
      console.error(`[${requestId}] Credit refund failed for user ${userId}:`, refundErr);
      return; // Do NOT clear creditDeducted; allow potential retry
    }
    
    creditDeducted = false; // Successfully refunded, prevent double-refund
    tracker.track("credit_refunded", { requestId, userId });
  };

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
    const sanitized = (body && typeof body === "object" ? body : {}) as Record<string, unknown>;
    delete sanitized.session_token;
    delete sanitized.sessionToken;

    // On the very first request the browser hasn't stored the cookie yet.
    // The middleware injects the freshly-generated session ID as a request
    // header so we can use it as a fallback instead of returning 401.
    // As a last resort we self-heal by generating a new session ID so the
    // user is never blocked with a 401 on their very first generation.
    const cookieToken = request.cookies.get(sessionConfig.cookieName)?.value;
    const headerToken = request.headers.get("x-new-session-id");
    const sessionToken = cookieToken ?? headerToken ?? randomUUID();
    
    // ── Auth & Credit Deduction (if logged in) ─────────────────────────
    const authHeader = request.headers.get("Authorization");
    let isAuthenticated = false;
    let authRemainingCredits: number | undefined = undefined;
    const creditCost = Number(process.env.GENERATION_CREDIT_COST ?? "1");

    if (authHeader) {
      if (!authHeader.startsWith("Bearer ")) {
        return errorResponse("UNAUTHORIZED", requestId, 401);
      }

      const token = authHeader.split(" ")[1];
      const supabase = getSupabaseAdmin();
      const { data: { user }, error: userError } = await supabase.auth.getUser(token);
      
      if (userError || !user) {
        return errorResponse("UNAUTHORIZED", requestId, 401);
      }

      isAuthenticated = true;
      userId = user.id;
      userToken = token;

      // Ensure the session is linked to the user and unlimited (fixes edge case where session wasn't merged)
      await supabase.rpc('claim_and_merge_session', { p_user_id: user.id, p_session_token: sessionToken });
      
      // Deduct credit for this generation — fail-closed:
      // any result other than success === true blocks generation.
      const { data: creditRes, error: creditErr } = await supabase.rpc('deduct_credit', {
        p_user_id: user.id,
        p_request_id: requestId,
        p_credit_cost: creditCost
      });

      const creditData = creditRes as unknown as { success: boolean; duplicate?: boolean; balance: number; error?: string } | null;

      // RPC transport error — do not proceed
      if (creditErr) {
        console.error(`[${requestId}] Credit deduction RPC error:`, creditErr);
        return errorResponse(ERROR_CODES.INTERNAL_ERROR, requestId, 503);
      }

      // Deduction returned a non-success result
      if (!creditData?.success) {
        if (creditData?.error === 'INSUFFICIENT_CREDITS') {
          tracker.track("rate_limit_reached", { requestId, pipeline: "Auth" });
          return NextResponse.json(
            { success: false as const, error: { code: ERROR_CODES.RATE_LIMIT_REACHED }, meta: { requestId } },
            { status: 403 }
          );
        }
        // Any other DB-level error (INVALID_CREDIT_COST, IDEMPOTENCY_KEY_CONFLICT, null, etc.)
        // — fail closed, do not generate content without confirmed deduction.
        console.error(`[${requestId}] Credit deduction rejected:`, creditData?.error ?? "null response");
        return errorResponse(ERROR_CODES.INTERNAL_ERROR, requestId, 503);
      }

      // SECURITY FIX: Prevent reused request IDs from getting free generations.
      // If a request fails and is refunded, the deduction transaction remains.
      // A retry with the same request ID would return duplicate=true (no deduction).
      if (creditData.duplicate) {
        console.warn(`[${requestId}] Blocked reused request-id to prevent credit bypass`);
        return errorResponse("DUPLICATE_REQUEST_ID", requestId, 409);
      }

      authRemainingCredits = creditData.balance;
      creditDeducted = true; // confirmed — deduction succeeded
    }

    const edgeFunctionUrl = `${supabaseUrl}/functions/v1/generate`;
    const plannerUrl = `${supabaseUrl}/functions/v1/planner`;
    const shadowSecret = process.env.SHADOW_SECRET_KEY;
    const isPipelineBEnabled = process.env.NEXT_PUBLIC_PIPELINE_B_ENABLED === "true";
    const isE2EMode = process.env.PIPELINE_B_E2E_MODE === "true";
    const fallbackToA = isE2EMode ? false : process.env.NEXT_PUBLIC_PIPELINE_B_FALLBACK_TO_A === "true";
    const isShadowEnabled = process.env.NEXT_PUBLIC_PIPELINE_B_SHADOW_ENABLED === "true";

    const pipelineBPayload = {
      purpose: (sanitized.mode === "creator" || sanitized.mode === "personal_creator") ? "thought" : "marketing",
      persona:
        typeof sanitized.persona === "string"
          ? sanitized.persona
          : (sanitized.persona as Record<string, unknown> | undefined)?.id ??
            ((sanitized.metadata as Record<string, unknown> | undefined)?.persona as Record<string, unknown> | undefined)?.id ??
            "developer",
      topic:
        (sanitized.topic as string) ??
        (sanitized.rawInput as string) ??
        "",
      platform: sanitized.platform,
      objective:
        (sanitized.objective as string) ??
        (sanitized.marketingObjective as string) ??
        (sanitized.metadata as Record<string, unknown> | undefined)?.marketingObjective ??
        "awareness",
      language: (sanitized.language as string) ?? "ar",
      audience:
        (sanitized.audience as string) ??
        (sanitized.metadata as Record<string, unknown> | undefined)?.targetAudience,
      constraints: sanitized.constraints,
      tone: sanitized.tone,
      copyFramework: sanitized.copyFramework,
      keyMessage: sanitized.keyMessage,
      arabicStyle: sanitized.arabicStyle,
    };

    // ── PIPELINE B PRIMARY EXECUTION (Phase 3B.9) ─────────────────────
    if (isPipelineBEnabled && shadowSecret) {
      let bRes: Response | null = null;
      let bData: Record<string, unknown> | null = null;
      const bController = new AbortController();
      const bTimeoutId = setTimeout(() => bController.abort(), 35000);

      try {
        const bHeaders: Record<string, string> = {
          "Content-Type": "application/json",
          "x-session-token": sessionToken,
          "x-request-id": requestId,
          "x-shadow-secret": shadowSecret,
          "x-execution-mode": "primary",
          Authorization: `Bearer ${anonKey}`,
          apikey: anonKey,
        };

        const failureInject = request.headers.get("x-failure-inject");
        if (failureInject && (process.env.PIPELINE_B_FAILURE_INJECTION === "true" || isE2EMode)) {
          bHeaders["x-failure-inject"] = failureInject;
        }

        bRes = await fetch(plannerUrl, {
          method: "POST",
          headers: bHeaders,
          body: JSON.stringify(pipelineBPayload),
          signal: bController.signal,
        });
        clearTimeout(bTimeoutId);
        bData = (await bRes.json().catch(() => null)) as Record<string, unknown> | null;
      } catch (err: unknown) {
        clearTimeout(bTimeoutId);
        console.error(`[${requestId}] Pipeline B primary invocation error:`, err);
      }

      if (bRes && bData) {
        const bErrorCode = extractPipelineBErrorCode(bData);
        // Rate limit reached in Pipeline B -> Do NOT fallback to A (rate limit is an intentional business limit)
        if (bRes.status === 403 && bErrorCode === "RATE_LIMIT_REACHED") {
          tracker.track("rate_limit_reached", { requestId, pipeline: "B" });
          await refundIfNeeded();
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

        // Success in Pipeline B
        if (bRes.ok && bData.success && bData.result) {
          // ── Unify Pipeline B into generations (history single source of truth) ──
          // Counting + analytics were already handled by persist_planner_generation
          // inside the planner, so this insert is history-only: no counter, no
          // limit re-check (which would double-count or falsely rate-limit).
          // request_id UNIQUE makes retries idempotent (23505 = safe to ignore).
          // Fail closed + refund: no charge without a saved history row.
          try {
            const historyDb = getSupabaseAdmin();
            // Session row is guaranteed to exist here: the planner 401s when the
            // token resolves to no session, so B could not have succeeded otherwise.
            const { data: bSession } = await historyDb
              .from("sessions")
              .select("id")
              .eq("session_token", sessionToken)
              .single();
            if (!bSession) {
              throw new Error("SESSION_NOT_FOUND_FOR_HISTORY");
            }
            const bMetadata = {
              format: sanitized.format,
              mode: sanitized.mode,
              marketingObjective: sanitized.marketingObjective,
              persona: sanitized.persona,
              style: sanitized.style,
              intent: sanitized.intent,
              originality: sanitized.originality,
              tone: sanitized.tone,
              language: sanitized.language,
              keyMessage: sanitized.keyMessage,
              pipeline: "B",
            } as unknown as Json;
            const { error: bHistErr } = await historyDb.from("generations").insert({
              session_id: bSession.id,
              request_id: requestId,
              user_id: userId,
              prompt: String(sanitized.rawInput ?? ""),
              platform: String(sanitized.platform ?? ""),
              content_type: String(sanitized.contentType ?? ""),
              arabic_style: String(sanitized.arabicStyle ?? ""),
              ai_response: bData.result as Json,
              metadata: bMetadata,
            });
            if (bHistErr && bHistErr.code !== "23505") {
              throw bHistErr;
            }
          } catch (histErr) {
            console.error(`[${requestId}] Pipeline B history persist failed:`, histErr);
            await refundIfNeeded();
            return errorResponse(ERROR_CODES.PERSISTENCE_FAILED, requestId, 500);
          }
          tracker.track("generation_succeeded", {
            requestId,
            pipeline: "B",
            platform: sanitized.platform,
            remainingGenerations: authRemainingCredits ?? sanitizeRemaining(bData.remainingGenerations as number) ?? 0,
            is_authenticated: isAuthenticated
          });
          return NextResponse.json({
            success: true as const,
            data: bData.result as GenerateResponse extends { success: true } ? GenerateResponse["data"] : never,
            remainingGenerations: authRemainingCredits ?? sanitizeRemaining(bData.remainingGenerations as number) ?? 0,
            meta: { requestId },
          });
        }
      }

      // If Pipeline B failed and fallback is disabled, return error immediately.
      // A 401 from the planner is an internal secret/auth misconfiguration, not a
      // client auth error — never propagate it as 401 to the browser.
      if (!fallbackToA) {
        const rawCode = extractPipelineBErrorCode(bData);
        const code = rawCode ? normalizePipelineBError(rawCode) : ERROR_CODES.GENERATION_FAILED;
        
        console.error(`[${requestId}] Pipeline B primary error:`, {
          error_code: rawCode ?? "unknown",
          mapped_code: code,
          pipeline: "B",
          status: bRes?.status,
          details: (bData?.details as string | undefined) || ((bData?.error as Record<string, unknown> | undefined)?.details as string | undefined) || "No details",
        });

        // Map 401 → 502: planner auth failures are infra issues, not client errors.
        const upstreamStatus = bRes?.status ?? 500;
        const outStatus = upstreamStatus === 401 ? 502 : (upstreamStatus >= 400 ? upstreamStatus : 500);

        await refundIfNeeded();
        return NextResponse.json(
          { success: false as const, error: { code }, meta: { requestId } },
          { status: outStatus }
        );
      }

      // Fallback to Pipeline A enabled -> log warning and proceed to execute Pipeline A
      console.warn(`[${requestId}] Pipeline B primary failed (status: ${bRes?.status ?? "unknown"}). Falling back to Pipeline A.`);
    } else if (isShadowEnabled && shadowSecret) {
      const fireShadow = () => {
        fetch(plannerUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-session-token": sessionToken,
            "x-request-id": requestId,
            "x-shadow-secret": shadowSecret,
            "x-execution-mode": "shadow",
            Authorization: `Bearer ${anonKey}`,
            apikey: anonKey,
          },
          body: JSON.stringify(pipelineBPayload),
        }).catch(err => {
          console.error(`[${requestId}] Shadow evaluation failed to initiate:`, err);
        });
      };

      try {
        after(fireShadow);
      } catch {
        // Fallback for non-request test contexts where Next.js async storage is absent
        setTimeout(fireShadow, 0);
      }
    }

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
          // Verified server-side above: lets the Edge function attribute the
          // generations row to this user instantly. Absent for anonymous.
          ...(userToken ? { "x-user-jwt": userToken } : {}),
        },
        body: JSON.stringify(sanitized),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
    } catch (err: unknown) {
      clearTimeout(timeoutId);
      await refundIfNeeded();
      
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
      tracker.track("rate_limit_reached", { requestId, pipeline: "A" });
      await refundIfNeeded();
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
      await refundIfNeeded();
      return NextResponse.json(
        { success: false as const, error: { code }, meta: { requestId } },
        { status: edgeRes.status }
      );
    }

    tracker.track("generation_succeeded", {
      requestId,
      pipeline: "A",
      platform: sanitized.platform,
      remainingGenerations: authRemainingCredits ?? sanitizeRemaining(edgeData.remainingGenerations as number) ?? 0,
      is_authenticated: isAuthenticated
    });
    return NextResponse.json({
      success: true as const,
      data: edgeData.result as GenerateResponse extends { success: true } ? GenerateResponse["data"] : never,
      remainingGenerations: authRemainingCredits ?? sanitizeRemaining(edgeData.remainingGenerations as number) ?? 0,
      meta: { requestId },
    });

  } catch (error) {
    tracker.track("generation_failed", { requestId });

    // Refund credit only if it was successfully deducted before the failure.
    // Validation failures and 4xx before deduction never reach here with creditDeducted=true.
    await refundIfNeeded();

    if (error instanceof ZodError) {
      return errorResponse(ERROR_CODES.VALIDATION_ERROR, requestId, 400);
    }

    console.error(`[${requestId}] Generation proxy error:`, error);
    return errorResponse(ERROR_CODES.GENERATION_FAILED, requestId, 500);
  }
}
