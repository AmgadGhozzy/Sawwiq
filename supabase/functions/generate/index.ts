// =============================================================================
// Supabase Edge Function: generate (Modular Architecture)
// Runtime: Deno
// =============================================================================

import { createClient } from "@supabase/supabase-js";
import { GoogleGenAI } from "@google/genai";
import { getCorsHeaders, corsResponse } from "./utils/cors.ts";
import { inputSchema, GEMINI_RESPONSE_SCHEMA, generatedContentSchema } from "./validation/schema.ts";
import { buildSystemPrompt } from "./prompts/promptBuilder.ts";
import { validateClaims } from "./validation/claimValidator.ts";

Deno.serve(async (req: Request) => {
  // 1. CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: getCorsHeaders(req) });
  }

  if (req.method !== "POST") {
    return corsResponse(JSON.stringify({ error: "Method not allowed" }), 405, req);
  }

  try {
    // 2. Environment Variables
    const geminiApiKey = Deno.env.get("GEMINI_API_KEY");
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SERVICE_ROLE_KEY") ?? Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!geminiApiKey) {
      return corsResponse(JSON.stringify({ error: "SERVICE_UNAVAILABLE" }), 503, req);
    }
    if (!supabaseUrl || !supabaseServiceKey) {
      return corsResponse(JSON.stringify({ error: "Supabase not configured" }), 503, req);
    }

    // 3. Parse & Validate Body
    const body = await req.json();
    const parseResult = inputSchema.safeParse(body);
    if (!parseResult.success) {
      return corsResponse(
        JSON.stringify({ error: "VALIDATION_ERROR", message: parseResult.error.issues[0]?.message }),
        400,
        req
      );
    }
    const input = parseResult.data;

    // 4. Session Token & Request ID Validation (header-only — body fallback removed for security)
    const sessionToken = req.headers.get("x-session-token");
    const requestId = req.headers.get("x-request-id") ?? crypto.randomUUID();

    if (!sessionToken) {
      return corsResponse(JSON.stringify({ error: "SESSION_MISSING" }), 401, req);
    }

    // 5. Supabase Client
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { persistSession: false },
    });

    // 6. Fetch / Create Session
    let session: { id: string; generations_count: number; max_limit: number } | null = null;

    const { data: existing } = await supabase
      .from("sessions")
      .select("id, generations_count, max_limit")
      .eq("session_token", sessionToken)
      .single();

    if (existing) {
      session = existing;
    } else {
      const { data: created } = await supabase
        .from("sessions")
        .insert({ session_token: sessionToken, generations_count: 0, max_limit: 3 })
        .select("id, generations_count, max_limit")
        .single();
      session = created;
    }

    if (!session) {
      return corsResponse(JSON.stringify({ error: "SESSION_ERROR" }), 500, req);
    }

    // 7. Rate Limit Check
    if (session.generations_count >= session.max_limit) {
      return corsResponse(
        JSON.stringify({
          error: "RATE_LIMIT_REACHED",
          message: "لقد استنفدت محاولاتك المجانية الثلاث! سجّل في قائمة الانتظار للحصول على المزيد.",
        }),
        403,
        req
      );
    }

    // 8. Gemini Generation (with timeout + retry)
    const ai = new GoogleGenAI({ apiKey: geminiApiKey });
    const systemPrompt = buildSystemPrompt(input);

    const GENERATION_TIMEOUT_MS = 30_000;
    const MAX_RETRIES = 2;

    let response;

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), GENERATION_TIMEOUT_MS);

        response = await ai.models.generateContent({
          model: "gemini-2.5-flash-lite",
          contents: "اكتب المحتوى التسويقي بناءً على معلومات المستخدم المقدمة في سياق المحادثة.",
          config: {
            systemInstruction: systemPrompt,
            responseMimeType: "application/json",
            responseSchema: GEMINI_RESPONSE_SCHEMA,
            temperature: 0.7,
            topP: 0.9,
            abortSignal: controller.signal,
          },
        });

        clearTimeout(timeoutId);
        break; // Success — exit retry loop
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        const isRateLimit = msg.includes("429") || msg.includes("RESOURCE_EXHAUSTED") || msg.includes("rate");
        const isTimeout = err instanceof DOMException && err.name === "AbortError";

        if (attempt < MAX_RETRIES && (isRateLimit || isTimeout)) {
          const delay = Math.min(1000 * Math.pow(2, attempt), 8000);
          console.warn(`[Edge] Retry ${attempt + 1}/${MAX_RETRIES} after ${delay}ms: ${msg}`);
          await new Promise((r) => setTimeout(r, delay));
          continue;
        }
        throw err;
      }
    }

    if (!response) {
      return corsResponse(JSON.stringify({ error: "GEMINI_ERROR", message: "فشل الاتصال بخدمة الذكاء الاصطناعي." }), 502, req);
    }

    const responseText = response.text;
    if (!responseText) {
      return corsResponse(JSON.stringify({ error: "EMPTY_RESPONSE" }), 502, req);
    }

    const rawResult = JSON.parse(responseText);
    const outputParse = generatedContentSchema.safeParse(rawResult);

    if (!outputParse.success) {
      return corsResponse(
        JSON.stringify({ 
          error: "OUTPUT_SCHEMA_INVALID", 
          message: "فشل التحقق من المخرجات المستلمة من الذكاء الاصطناعي.",
          details: outputParse.error.errors
        }),
        502,
        req
      );
    }

    const result = outputParse.data;

    const claimValidation = validateClaims(result, input);
    if (!claimValidation.passed) {
      return corsResponse(
        JSON.stringify({
          error: "CLAIM_VALIDATION_FAILED",
          message: "يحتوي المحتوى على ادعاءات غير مسموح بها أو مخالفات هيكلية.",
          details: claimValidation.violations
        }),
        400,
        req
      );
    }

    // 9. Persist & Increment (Awaited + Atomic RPC)
    const { data: rpcResult, error: rpcError } = await supabase.rpc("persist_generation", {
      p_session_id: session.id,
      p_request_id: requestId,
      p_prompt: input.rawInput,
      p_platform: input.platform,
      p_content_type: input.contentType,
      p_arabic_style: input.arabicStyle,
      p_ai_response: result,
    });

    if (rpcError || !rpcResult) {
      console.error("[Edge] Persistence RPC error:", rpcError);
      return corsResponse(
        JSON.stringify({ error: "PERSISTENCE_FAILED", message: "حدث خطأ أثناء حفظ النتيجة." }),
        500,
        req
      );
    }

    if (!rpcResult.success) {
      return corsResponse(
        JSON.stringify({
          error: rpcResult.error ?? "RATE_LIMIT_REACHED",
          message: "لقد استنفدت محاولاتك المجانية الثلاث! سجّل في قائمة الانتظار للحصول على المزيد.",
        }),
        403,
        req
      );
    }

    // 10. Return Response
    return corsResponse(
      JSON.stringify({
        success: true,
        result,
        remainingGenerations: rpcResult.remainingGenerations,
      }),
      200,
      req
    );
  } catch (err) {
    console.error("[Edge] Unhandled error:", err);
    return corsResponse(
      JSON.stringify({ error: "INTERNAL_ERROR", message: "حدث خطأ غير متوقع." }),
      500,
      req
    );
  }
});
