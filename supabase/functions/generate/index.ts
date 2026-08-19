// =============================================================================
// Supabase Edge Function: generate (Modular Architecture)
// Runtime: Deno
// =============================================================================

import { createClient } from "npm:@supabase/supabase-js@2";
import { GoogleGenAI } from "npm:@google/genai";
import { CORS_HEADERS, corsResponse } from "./utils/cors.ts";
import { inputSchema, GEMINI_RESPONSE_SCHEMA } from "./validation/schema.ts";
import { buildSystemPrompt } from "./prompts/promptBuilder.ts";

Deno.serve(async (req: Request) => {
  // 1. CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: CORS_HEADERS });
  }

  if (req.method !== "POST") {
    return corsResponse(JSON.stringify({ error: "Method not allowed" }), 405);
  }

  try {
    // 2. Environment Variables
    const geminiApiKey = Deno.env.get("GEMINI_API_KEY");
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SERVICE_ROLE_KEY") ?? Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!geminiApiKey) {
      return corsResponse(JSON.stringify({ error: "GEMINI_API_KEY not configured" }), 503);
    }
    if (!supabaseUrl || !supabaseServiceKey) {
      return corsResponse(JSON.stringify({ error: "Supabase not configured" }), 503);
    }

    // 3. Parse & Validate Body
    const body = await req.json();
    const parseResult = inputSchema.safeParse(body);
    if (!parseResult.success) {
      return corsResponse(
        JSON.stringify({ error: "VALIDATION_ERROR", message: parseResult.error.issues[0]?.message }),
        400
      );
    }
    const input = parseResult.data;

    // 4. Session Token Validation
    const sessionToken =
      req.headers.get("x-session-token") ??
      (body as Record<string, string>).session_token ??
      null;

    if (!sessionToken) {
      return corsResponse(JSON.stringify({ error: "SESSION_MISSING" }), 400);
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
      return corsResponse(JSON.stringify({ error: "SESSION_ERROR" }), 500);
    }

    // 7. Rate Limit Check
    if (session.generations_count >= session.max_limit) {
      return corsResponse(
        JSON.stringify({
          error: "RATE_LIMIT_REACHED",
          message: "لقد استنفدت محاولاتك المجانية الثلاث! سجّل في قائمة الانتظار للحصول على المزيد.",
        }),
        403
      );
    }

    // 8. Gemini Generation
    const ai = new GoogleGenAI({ apiKey: geminiApiKey });
    const systemPrompt = buildSystemPrompt(input);

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-lite",
      contents: "اكتب المحتوى التسويقي بناءً على معلومات المستخدم المقدمة في سياق المحادثة.",
      config: {
        systemInstruction: systemPrompt,
        responseMimeType: "application/json",
        responseSchema: GEMINI_RESPONSE_SCHEMA,
        temperature: 0.7,
        topP: 0.9,
      },
    });

    const responseText = response.text;
    if (!responseText) {
      return corsResponse(JSON.stringify({ error: "EMPTY_RESPONSE" }), 502);
    }

    const result = JSON.parse(responseText);

    // 9. Persist & Increment (fire-and-forget)
    Promise.all([
      supabase.from("generations").insert({
        session_id: session.id,
        prompt: input.rawInput,
        platform: input.platform,
        content_type: input.contentType,
        arabic_style: input.arabicStyle,
        ai_response: result,
      }),
      supabase
        .from("sessions")
        .update({ generations_count: session.generations_count + 1 })
        .eq("id", session.id),
    ]).catch((err) => console.error("[Edge] Persist error:", err));

    const remaining = Math.max(0, session.max_limit - (session.generations_count + 1));

    // 10. Return Response
    return corsResponse(
      JSON.stringify({
        success: true,
        result,
        remainingGenerations: remaining,
      })
    );
  } catch (err) {
    console.error("[Edge] Unhandled error:", err);
    return corsResponse(
      JSON.stringify({ error: "INTERNAL_ERROR", message: "حدث خطأ غير متوقع." }),
      500
    );
  }
});
