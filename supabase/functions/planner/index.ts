import { createClient } from "@supabase/supabase-js";
import { GoogleGenAI } from "@google/genai";
import { getFailureInjection } from "./utils/failureInjector.ts";
import { PlannerRequestSchema, normalizeAndEnforceInvariants, validateIRGraph, IR_SCHEMA_VERSION } from "../../../lib/planner/validation.ts";
import { buildPlannerPrompt as buildThoughtPlannerPrompt } from "../../../lib/planner/thought/plannerPrompt.ts";
import { buildRendererPrompt as buildThoughtRendererPrompt } from "../../../lib/planner/thought/thoughtRendererPrompt.ts";
import { buildMarketingPlannerPrompt } from "../../../lib/planner/marketing/marketingPlannerPrompt.ts";
import { buildMarketingRendererPrompt } from "../../../lib/planner/marketing/marketingRendererPrompt.ts";
import { parsePlannerOutput, parseRendererOutput } from "../../../lib/planner/output/parser.ts";
import { validateRenderedContent } from "../../../lib/planner/output/validator.ts";
import { compileIRGraph } from "../../../lib/planner/ir/compiler.ts";
import { TOPOLOGY_REQUIRED } from "../../../lib/content/personas/topologyDefinitions.ts";
import { MARKETING_TOPOLOGIES } from "../../../lib/planner/marketing/topologies.ts";
import { evaluateShadowRun } from "./utils/evaluator.ts";

// Effective length budget per platform — mirrors rendererPrompt.ts
// Source of truth for hard enforcement in parseRendererOutput.
const PLATFORM_MAX_LENGTHS: Record<string, number> = {
  x: 280,
  instagram: 2200,
  facebook: 1500,
  linkedin: 2800,
};

export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-failure-inject, x-shadow-secret, x-execution-mode, x-session-id, x-session-token, x-request-id",
};

Deno.serve(async (req) => {
  // 1. CORS Preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // 2. HTTP Method Validation
    if (req.method !== "POST") {
      return new Response("Method not allowed", { status: 405, headers: corsHeaders });
    }

    // 2a. Pre-Auth Failure Injection: infrastructure-level scenarios (kill_switch, timeout)
    //     These fire before Auth because they model "service is down", not user-specific failures.
    const earlyFailureHeader = req.headers.get("x-failure-inject");
    const earlyInjectionEnabled = Deno.env.get("PIPELINE_B_FAILURE_INJECTION") === "true";
    if (earlyInjectionEnabled && earlyFailureHeader === "kill_switch") {
      return new Response(JSON.stringify({ error: "Pipeline B is currently disabled" }), {
        status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }
    if (earlyInjectionEnabled && earlyFailureHeader === "timeout") {
      await new Promise(resolve => setTimeout(resolve, 3000));
      return new Response(JSON.stringify({ error: "Request timeout" }), {
        status: 504, headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // 3. Auth & Session Lookup (Strictly from JWT or Shadow Bypass)
    const authHeader = req.headers.get("Authorization");
    const shadowSecret = req.headers.get("x-shadow-secret");
    
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? Deno.env.get("SERVICE_ROLE_KEY") ?? "";
    const gcpServiceAccountKey = Deno.env.get("GCP_SERVICE_ACCOUNT_KEY");

    if (!supabaseUrl || !supabaseServiceKey || !gcpServiceAccountKey) {
      return new Response(JSON.stringify({ error: "SERVICE_UNAVAILABLE" }), { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const validShadowSecret = Deno.env.get("SHADOW_SECRET_KEY");
    
    // If a shadow secret is provided in the request, it MUST be valid.
    if (shadowSecret) {
      if (!validShadowSecret || shadowSecret !== validShadowSecret) {
        return new Response(JSON.stringify({ error: "Invalid shadow secret" }), { 
          status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } 
        });
      }
    }
    
    const isInternalAuth = !!shadowSecret && !!validShadowSecret && shadowSecret === validShadowSecret;
    const executionMode = req.headers.get("x-execution-mode") || "shadow";

    if (!isInternalAuth) {
      if (!authHeader) {
        return new Response(JSON.stringify({ error: "Missing Authorization header" }), { 
          status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } 
        });
      }

      const supabase = createClient(supabaseUrl, supabaseAnonKey, { 
        global: { headers: { Authorization: authHeader } } 
      });

      // Pass the JWT token explicitly — Deno edge functions do not auto-read global headers.
      const jwtToken = authHeader.replace(/^Bearer\s+/i, "");
      const { data: { user }, error: userError } = await supabase.auth.getUser(jwtToken);
      if (userError || !user) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), { 
          status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } 
        });
      }
    }

    // The session lookup should verify the user has a valid session.
    // For this edge function, we require `sessionId` to be passed in the body, BUT we must verify it belongs to the user.
    // Alternatively, Pipeline A uses `x-session-token` or similar. We will parse body to get session_id, then verify.

    // 4. Request Validation
    const body = await req.json();
    const parsedBody = PlannerRequestSchema.safeParse(body);
    if (!parsedBody.success) {
      return new Response(JSON.stringify({ error: "Invalid request payload", details: parsedBody.error.errors }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }
    const requestDataRaw = parsedBody.data;

    let requestData;
    try {
      requestData = normalizeAndEnforceInvariants(requestDataRaw);
    } catch (e: any) {
      return new Response(JSON.stringify({ error: "Invariant violation", details: e.message }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // Wait, we need a session_id. Pipeline B payload doesn't inherently have session_id in PlannerRequestDTO?
    // Let's assume requestData has session_id, or we pull it from headers.
    let sessionId = req.headers.get("x-session-id");
    const sessionToken = req.headers.get("x-session-token");
    
    if (!sessionId && !sessionToken) {
      return new Response(JSON.stringify({ error: "Missing x-session-id or x-session-token header" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // Verify session exists
    const supabaseService = createClient(supabaseUrl, supabaseServiceKey);
    
    let sessionQuery = supabaseService.from('sessions').select('id');
    if (sessionId) {
      sessionQuery = sessionQuery.eq('id', sessionId);
    } else {
      sessionQuery = sessionQuery.eq('session_token', sessionToken);
    }
    
    const { data: sessionInfo, error: sessionError } = await sessionQuery.single();

    if (!sessionInfo) {
      // If using session token in Shadow Mode, automatically create session if not exists
      // to mimic Pipeline A's behavior
      if (executionMode === "shadow" && sessionToken && !sessionId) {
        const { data: created } = await supabaseService
          .from("sessions")
          .insert({ session_token: sessionToken, generations_count: 0, max_limit: 3 })
          .select("id")
          .single();
          
        if (created) {
          sessionId = created.id;
        } else {
           return new Response(JSON.stringify({ error: "Failed to create shadow session" }), { 
            status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } 
          });
        }
      } else {
        return new Response(JSON.stringify({ error: "Invalid session" }), { 
          status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } 
        });
      }
    } else {
      sessionId = sessionInfo.id;
    }

    // 4.5 Early Idempotency Check
    const idempotencyKey = req.headers.get("x-request-id") || crypto.randomUUID();

    if (executionMode === "primary") {
      const { data: existingRun } = await supabaseService
        .from("planner_runs")
        .select("id, status, remainingGenerations:sessions(max_limit, generations_count)")
        .eq("request_id", idempotencyKey)
        .maybeSingle();

      if (existingRun) {
        return new Response(JSON.stringify({ 
          error: "DUPLICATE_REQUEST", 
          message: "This request has already been processed." 
        }), { 
          status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } 
        });
      }
    }

    // 5. Budget Check
    // If budget reaches hard limit, or kill switch is active in DB, we block.
    // For MVP, we'll just check a flag if needed.
    const isPipelineBEnabled = Deno.env.get("PIPELINE_B_ENABLED") === "true";
    if (!isPipelineBEnabled) {
      return new Response(JSON.stringify({ error: "Pipeline B is currently disabled" }), {
        status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // Request budget lock (atomic decrement/check via RPC)
    const budgetTarget = parseInt(Deno.env.get("PIPELINE_B_BUDGET_TARGET") || "500", 10);
    
    // Instead of locking, we just query the current budget for logging.
    // Use supabaseService (service-role, always defined) — supabase (anon) is only
    // initialised for non-shadow requests.
    const { data: budgetData } = await supabaseService
      .from("planner_budget")
      .select("request_count")
      .eq("budget_date", new Date().toISOString().split("T")[0])
      .maybeSingle();

    if (budgetData && budgetData.request_count >= budgetTarget) {
      // User directive: over target -> log/alert, but continue (Soft Limit)
      console.warn(`[ALERT] Pipeline B operational budget target exceeded. Target: ${budgetTarget}, Current: ${budgetData.request_count}`);
    }

    // 6. Failure Injection Check
    const failureHeader = req.headers.get("x-failure-inject");
    const isInjectionEnabled = Deno.env.get("PIPELINE_B_FAILURE_INJECTION") === "true";
    const injectedScenario = getFailureInjection(failureHeader, isInjectionEnabled);

    // kill_switch and timeout are handled pre-auth above; skip here.

    // LLM Client setup
    const ai = new GoogleGenAI({ vertexai: true, project: 'gen-lang-client-0841388254', location: 'us-central1', googleAuthOptions: { credentials: JSON.parse(gcpServiceAccountKey) } });
    const plannerModel  = Deno.env.get("GEMINI_MODEL") ?? "gemini-2.5-flash-lite";
    const rendererModel = Deno.env.get("GEMINI_MODEL") ?? "gemini-2.5-flash-lite";
    
    let totalPromptTokens = 0;
    let totalCompletionTokens = 0;
    const startTime = Date.now();

    // 7. Planner (Phase 3B.6.3)
    if (injectedScenario === "planner_429") {
      return new Response(JSON.stringify({ error: "Rate limit exceeded" }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    } else if (injectedScenario === "UNKNOWN_INTERNAL_ERROR") {
      return new Response(JSON.stringify({ error: "UNKNOWN_INTERNAL_ERROR" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    let rawPlannerOutput = "";
    if (injectedScenario === "planner_malformed_json") {
      rawPlannerOutput = "```json { \"nodes\": [missing bracket ```";
    } else if (injectedScenario === "planner_forbidden_node") {
      rawPlannerOutput = JSON.stringify({ nodes: [{ id: "forbidden", content: "evil" }] });
    } else if (injectedScenario === "planner_topology_violation") {
      rawPlannerOutput = JSON.stringify({ nodes: [{ id: "wrong_node", content: "bad topology" }] });
    } else if (["renderer_malformed_json", "renderer_length_violation", "db_persistence_failure", "persistence_duplicate"].includes(injectedScenario)) {
      const requiredNodes = requestData.purpose === "marketing" 
        ? MARKETING_TOPOLOGIES[requestData.copyFramework ?? "benefit_led"].nodes 
        : TOPOLOGY_REQUIRED[requestData.persona! as keyof typeof TOPOLOGY_REQUIRED].nodes;
      const nodes = requiredNodes.map(id => ({ id, content: `Mock content for ${id}` }));
      rawPlannerOutput = JSON.stringify({ nodes });
    } else {
      const plannerPrompt = requestData.purpose === "marketing" 
        ? buildMarketingPlannerPrompt(requestData) 
        : buildThoughtPlannerPrompt(requestData);
      
      const plannerRes = await ai.models.generateContent({
        model: plannerModel,
        contents: plannerPrompt,
        config: { temperature: 0.7 }
      });
      totalPromptTokens += plannerRes.usageMetadata?.promptTokenCount || 0;
      totalCompletionTokens += plannerRes.usageMetadata?.candidatesTokenCount || 0;
      rawPlannerOutput = plannerRes.text || "";
    }

    let plannerParsed: { nodes: any[], angles?: any[] };
    let irGraph = null;
    let finalContent = null;
    let pipelineError: Error | null = null;
    let errorResponse: Response | null = null;

    try {
      plannerParsed = parsePlannerOutput(rawPlannerOutput);
    } catch (e: any) {
      console.error("Planner Parse Error:", e);
      pipelineError = new Error(`Planner Parse Error: ${e.message}`);
      errorResponse = new Response(JSON.stringify({ error: "Planner LLM Output Validation Failed", details: e.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (!pipelineError && plannerParsed) {
      // 8. Compiler (Phase 3B.6.4)
      try {
        if (requestData.purpose === "marketing") {
          // benefit_led is the validated production default (benchmark-backed).
          // "auto" is not a valid override — it maps to the evidence-based default.
          const framework = (requestData.copyFramework && requestData.copyFramework !== "auto")
            ? requestData.copyFramework
            : "benefit_led";
          
          const topology = MARKETING_TOPOLOGIES[framework as keyof typeof MARKETING_TOPOLOGIES];
          
          irGraph = {
            personaId: "marketing",
            version: IR_SCHEMA_VERSION,
            nodes: plannerParsed.nodes,
            angles: plannerParsed.angles || [],
            edges: topology.nodes.slice(0, -1).map((n: string, i: number) => ({
              from: n,
              to: topology.nodes[i + 1],
              rel: "leads_to"
            })),
          };
        } else {
          irGraph = compileIRGraph(plannerParsed.nodes, requestData.persona as any);
        }
      } catch (e: any) {
        console.error("IR Compiler Error:", e);
        pipelineError = new Error(`Compiler Error: ${e.message}`);
        errorResponse = new Response(JSON.stringify({ error: "IR Compiler Validation Failed", details: e.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
    }

    // ── IR Validation Gate (Phase 3B.6.4b) ─────────────────────────────────────
    // Must run BEFORE renderer. An invalid IR must never reach the renderer.
    // Schema/version errors → hard failure (not retryable: structural mismatch).
    // Topology/sourceNodes errors → retry planner once (recoverable: LLM output issue).
    if (!pipelineError && irGraph) {
      const HARD_FAILURE_CODES = new Set([
        "PLANNER_PERSONA_MISMATCH", "PLANNER_IR_VERSION_MISMATCH"
      ]);
      const SOFT_CODES_FOR_RETRY = new Set([
        "PLANNER_TOPOLOGY_VIOLATION", "PLANNER_DUPLICATE_NODES", "PLANNER_DUPLICATE_EDGES",
        "PLANNER_MISSING_NODES", "PLANNER_FORBIDDEN_NODES", "PLANNER_EMPTY_NODE_CONTENT",
        "PLANNER_INVALID_CONFIDENCE"
      ]);

      const doValidateIR = (graph: typeof irGraph) =>
        validateIRGraph(graph!, requestData.purpose === "marketing" ? "marketing" : requestData.persona as any);

      let irVal = doValidateIR(irGraph);

      if (!irVal.valid) {
        const hardIssues = irVal.issues.filter(i => HARD_FAILURE_CODES.has(i.code as string));
        const softIssues = irVal.issues.filter(i => !HARD_FAILURE_CODES.has(i.code as string) && SOFT_CODES_FOR_RETRY.has(i.code as string));

        if (hardIssues.length > 0) {
          // Not retryable — structural contract violation.
          console.error("[IR Gate] Hard IR validation failure:", hardIssues);
          pipelineError = new Error("IR_SCHEMA_VIOLATION");
          errorResponse = new Response(JSON.stringify({
            error: "IR_SCHEMA_VIOLATION",
            details: hardIssues.map(i => i.detail),
          }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        } else if (softIssues.length > 0) {
          // Recoverable — retry the planner once with repair hint.
          console.warn("[IR Gate] Soft IR validation failure, retrying planner:", softIssues);
          const repairHint = [
            "المحاولة السابقة أنتجت IR غير صالح للأسباب التالية. يجب إصلاحها بدقة:",
            ...softIssues.map(i => `- ${i.detail}`),
            "لا تضف أي معلومات جديدة. حافظ على نفس المنتج والمنصة والهدف.",
          ].join("\n");

          const retryRequestData = {
            ...requestData,
            constraints: { ...requestData.constraints, customInstructions: repairHint },
          };

          try {
            const retryPlannerPrompt = requestData.purpose === "marketing"
              ? buildMarketingPlannerPrompt(retryRequestData)
              : buildThoughtPlannerPrompt(retryRequestData);
            
            let retryRaw = "";
            if (injectedScenario === "planner_topology_violation") {
              retryRaw = JSON.stringify({ nodes: [{ id: "wrong_node_again", content: "still bad" }] });
            } else {
              const retryRes = await ai.models.generateContent({
                model: plannerModel,
                contents: retryPlannerPrompt,
                config: { temperature: 0.7 },
              });
              totalPromptTokens += retryRes.usageMetadata?.promptTokenCount || 0;
              totalCompletionTokens += retryRes.usageMetadata?.candidatesTokenCount || 0;
              retryRaw = retryRes.text || "";
            }
            const retryParsed = parsePlannerOutput(retryRaw);

            if (requestData.purpose === "marketing") {
              const fw = (requestData.copyFramework && requestData.copyFramework !== "auto") ? requestData.copyFramework : "benefit_led";
              const topo = MARKETING_TOPOLOGIES[fw as keyof typeof MARKETING_TOPOLOGIES];
              irGraph = {
                personaId: "marketing",
                version: IR_SCHEMA_VERSION,
                nodes: retryParsed.nodes,
                angles: retryParsed.angles || [],
                edges: topo.nodes.slice(0, -1).map((n: string, i: number) => ({ from: n, to: topo.nodes[i + 1], rel: "leads_to" })),
              };
            } else {
              irGraph = compileIRGraph(retryParsed.nodes, requestData.persona as any);
            }

            // Validate the retry result — if still invalid, hard fail.
            irVal = doValidateIR(irGraph);
            if (!irVal.valid) {
              console.error("[IR Gate] Retry IR still invalid:", irVal.issues);
              pipelineError = new Error("IR_VALIDATION_FAILED_AFTER_RETRY");
              errorResponse = new Response(JSON.stringify({
                error: "IR_VALIDATION_FAILED_AFTER_RETRY",
                details: irVal.issues.map(i => i.detail),
              }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
            }
          } catch (retryErr: any) {
            console.error("[IR Gate] Planner retry failed:", retryErr);
            pipelineError = new Error(`IR_RETRY_PLANNER_FAILED: ${retryErr.message}`);
            errorResponse = new Response(JSON.stringify({
              error: "IR_RETRY_PLANNER_FAILED",
              details: retryErr.message,
            }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
          }
        }
        // Confidence-only issues (INVALID_CONFIDENCE): log and continue — not a pipeline blocker.
        const confOnlyIssues = irVal.issues.filter(i => i.code === "INVALID_CONFIDENCE");
        if (confOnlyIssues.length > 0) {
          console.warn("[IR Gate] Non-blocking confidence issues:", confOnlyIssues);
        }
      }
    }

    if (!pipelineError && irGraph) {
      // 9. Renderer (Phase 3B.6.5)
      let rawRendererOutput = "";
      const MAX_RETRIES = 1;
      let lastValidationSignals: any[] = [];

      for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
        // Construct targeted retry instructions if previous attempt failed
        let retryInstructions = requestData.constraints?.customInstructions ?? "";
        if (attempt > 0 && lastValidationSignals.length > 0) {
          const repairStrategies = lastValidationSignals
            .filter(s => s.severity === "hard")
            .map(s => `- ${s.repair_strategy}`)
            .join("\n");
          
          retryInstructions = [
            requestData.constraints?.customInstructions ?? "",
            "المحاولة السابقة فشلت للأسباب التالية. يجب إصلاح هذه الأخطاء بدقة:",
            repairStrategies,
            "حافظ على الفكرة الأساسية والمنصة. لا تضف أي معلومات جديدة."
          ].filter(Boolean).join("\n\n");
        }

        const currentRequestData = {
          ...requestData,
          constraints: {
            ...requestData.constraints,
            customInstructions: retryInstructions,
          }
        };

        if (injectedScenario === "renderer_malformed_json") {
          rawRendererOutput = "invalid json";
        } else if (injectedScenario === "renderer_length_violation" || (injectedScenario === "renderer_length_violation_retry_success" && attempt === 0)) {
          rawRendererOutput = JSON.stringify({
            title: "Long Title Passes", hook: "Long Hook Passes", callToAction: "Long CTA Passes", hashtags: [],
            body: "Long Body Passes".repeat((currentRequestData.constraints?.maxLength || 100) + 10)
          });
        } else if (injectedScenario === "renderer_length_violation_retry_success" && attempt > 0) {
          rawRendererOutput = JSON.stringify({
            title: "Long Title Passes", hook: "Long Hook Passes", callToAction: "Long CTA Passes", hashtags: ["#success"], body: "Long Body Passes That Is Definitely Longer Than Ten Chars"
          });
        } else if (["db_persistence_failure", "persistence_duplicate"].includes(injectedScenario)) {
          rawRendererOutput = JSON.stringify({
            title: "Long Title Passes", hook: "Long Hook Passes", callToAction: "Long CTA Passes", hashtags: ["#test"], body: "Long Body Passes That Is Definitely Longer Than Ten Chars"
          });
        } else {
          const rendererPrompt = requestData.purpose === "marketing"
            ? buildMarketingRendererPrompt(irGraph, currentRequestData)
            : buildThoughtRendererPrompt(irGraph, currentRequestData);
            
          const rendererRes = await ai.models.generateContent({
            model: rendererModel,
            contents: rendererPrompt,
            config: { temperature: 0.7 }
          });
          totalPromptTokens += rendererRes.usageMetadata?.promptTokenCount || 0;
          totalCompletionTokens += rendererRes.usageMetadata?.candidatesTokenCount || 0;
          rawRendererOutput = rendererRes.text || "";
        }

        try {
          // Parse JSON without hard length constraint (validator will handle it gracefully)
          finalContent = parseRendererOutput(rawRendererOutput);
          
          const effectiveMaxLength =
            currentRequestData.constraints?.maxLength ??
            PLATFORM_MAX_LENGTHS[currentRequestData.platform?.toLowerCase() ?? ""];
            
          const validation = validateRenderedContent(finalContent, currentRequestData, effectiveMaxLength);
          
          if (!validation.passed) {
             lastValidationSignals = validation.signals;
             throw new Error("CONTENT_VALIDATION_FAILED");
          }

          pipelineError = null;
          errorResponse = null;
          break; // Success, break the loop
        } catch (error: any) {
          console.error(`Renderer Parse/Validation Error (Attempt ${attempt + 1}):`, error);
          
          if (attempt >= MAX_RETRIES) {
             if (error.message === "CONTENT_VALIDATION_FAILED") {
                const hardSignals = lastValidationSignals.filter(s => s.severity === "hard");
                const isLengthOnly = hardSignals.every(s => s.reason.includes("تجاوز الحد الأقصى"));
                
                pipelineError = new Error(isLengthOnly ? "RENDERER_LENGTH_VIOLATION" : "CONTENT_VALIDATION_FAILED");
                errorResponse = new Response(JSON.stringify({
                  error: {
                    code: isLengthOnly ? "RENDERER_LENGTH_VIOLATION" : "VALIDATION_ERROR",
                    message: hardSignals.map(s => s.reason).join(" | ")
                  }
                }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
             } else {
                pipelineError = new Error(`Renderer Parse Error: ${error.message}`);
                errorResponse = new Response(JSON.stringify({ error: "Renderer LLM Output Validation Failed", details: error.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
             }
          }
          // If we haven't reached MAX_RETRIES, loop continues with targeted repair prompt
        }
      }
    }

    // 10. Persistence (Phase 3B.6.6)

    if (!pipelineError) {
      if (injectedScenario === "db_persistence_failure") {
        pipelineError = new Error("Internal Database Error");
        errorResponse = new Response(JSON.stringify({ error: "Internal Database Error" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      } else if (injectedScenario === "persistence_duplicate") {
        pipelineError = new Error("DUPLICATE_REQUEST");
        errorResponse = new Response(JSON.stringify({ error: "DUPLICATE_REQUEST", message: "Request has already been processed" }), { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
    }

    // Shadow Mode Evaluation Persist (Background Traffic)
    if (isInternalAuth && executionMode !== "primary") {
      const evaluation = evaluateShadowRun(requestData, irGraph, finalContent, pipelineError);
      
      const { error: persistErr } = await supabaseService.rpc("persist_shadow_run", {
        p_request_id: idempotencyKey,
        p_session_id: sessionId,
        p_persona: requestData.persona,
        p_platform: requestData.platform,
        p_objective: requestData.objective,
        p_ir_graph: irGraph || {},
        p_rendered_content: finalContent || {},
        p_token_usage: { prompt_tokens: totalPromptTokens, completion_tokens: totalCompletionTokens, total_tokens: totalPromptTokens + totalCompletionTokens },
        p_latency_ms: Date.now() - startTime,
        p_pipeline_version: "B-1.0.0",
        p_status: pipelineError ? "error" : "success",
        p_total_tokens: totalPromptTokens + totalCompletionTokens,
        p_planner_status: evaluation.planner_status,
        p_compiler_status: evaluation.compiler_status,
        p_renderer_status: evaluation.renderer_status,
        p_failure_code: evaluation.failure_code,
        p_constraint_res: evaluation.constraint_results,
        p_execution_mode: "shadow"
      });
      
      if (persistErr) console.error("Failed to persist shadow run:", persistErr);

      // In shadow mode, we can always just return 200 since the caller doesn't use the result.
      return new Response(JSON.stringify({ success: true, evaluation }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Primary Mode via Trusted Internal Call (User-facing, limits enforced)
    if (isInternalAuth && executionMode === "primary") {
      const evaluation = evaluateShadowRun(requestData, irGraph, finalContent, pipelineError);

      if (pipelineError || errorResponse) {
        // Record failure in shadow_evaluations with execution_mode = 'primary'
        const { error: persistErr } = await supabaseService.rpc("persist_shadow_run", {
          p_request_id: idempotencyKey,
          p_session_id: sessionId,
          p_persona: requestData.persona || "marketing",
          p_platform: requestData.platform,
          p_objective: requestData.objective,
          p_ir_graph: irGraph || {},
          p_rendered_content: finalContent || {},
          p_token_usage: { prompt_tokens: totalPromptTokens, completion_tokens: totalCompletionTokens, total_tokens: totalPromptTokens + totalCompletionTokens },
          p_latency_ms: Date.now() - startTime,
          p_pipeline_version: "B-1.0.0",
          p_status: "error",
          p_total_tokens: totalPromptTokens + totalCompletionTokens,
          p_planner_status: evaluation.planner_status,
          p_compiler_status: evaluation.compiler_status,
          p_renderer_status: evaluation.renderer_status,
          p_failure_code: evaluation.failure_code,
          p_constraint_res: evaluation.constraint_results,
          p_execution_mode: "primary"
        });

        if (persistErr) console.error("Failed to persist failed primary run:", persistErr);

        if (errorResponse) return errorResponse;
        return new Response(JSON.stringify({ 
          error: "GENERATION_FAILED", 
          message: pipelineError?.message || "Pipeline B generation failed",
          evaluation 
        }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      // Atomic persistence + usage limit check & decrement
      const { data: dbResult, error: dbError } = await supabaseService.rpc("persist_planner_generation", {
        p_request_id: idempotencyKey,
        p_session_id: sessionId,
        p_persona: requestData.persona || "marketing",
        p_platform: requestData.platform,
        p_objective: requestData.objective,
        p_ir_graph: irGraph || {},
        p_rendered_content: finalContent || {},
        p_token_usage: { prompt_tokens: totalPromptTokens, completion_tokens: totalCompletionTokens, total_tokens: totalPromptTokens + totalCompletionTokens },
        p_latency_ms: Date.now() - startTime,
        p_pipeline_version: "B-1.0.0",
        p_status: "success",
        p_total_tokens: totalPromptTokens + totalCompletionTokens,
        p_planner_status: evaluation.planner_status,
        p_compiler_status: evaluation.compiler_status,
        p_renderer_status: evaluation.renderer_status,
        p_failure_code: evaluation.failure_code,
        p_constraint_res: evaluation.constraint_results
      });

      if (dbError || !dbResult) {
        console.error("DB Persistence Error in primary mode:", dbError);
        return new Response(JSON.stringify({ error: "PERSISTENCE_FAILED", message: "Failed to persist generation" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }

      if (!dbResult.success) {
        return new Response(JSON.stringify({
          error: dbResult.error ?? "RATE_LIMIT_REACHED",
          message: "لقد استنفدت محاولاتك المجانية الثلاث! سجّل في قائمة الانتظار للحصول على المزيد.",
        }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }

      return new Response(JSON.stringify({
        success: true,
        result: finalContent,
        remainingGenerations: dbResult.remainingGenerations,
        metadata: {
          model: plannerModel + " + " + rendererModel,
          provider: "gemini",
          latencyMs: Date.now() - startTime,
          requestId: idempotencyKey,
          tokenUsage: {
            promptTokens: totalPromptTokens,
            completionTokens: totalCompletionTokens,
            totalTokens: totalPromptTokens + totalCompletionTokens
          }
        }
      }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    if (errorResponse) return errorResponse;

    const runPayload = {
      p_request_id: idempotencyKey,
      p_session_id: sessionId,
      p_persona: requestData.persona || "marketing",
      p_platform: requestData.platform,
      p_objective: requestData.objective,
      p_ir_graph: irGraph,
      p_rendered_content: finalContent,
      p_token_usage: { prompt_tokens: totalPromptTokens, completion_tokens: totalCompletionTokens, total_tokens: totalPromptTokens + totalCompletionTokens },
      p_latency_ms: Date.now() - startTime,
      p_pipeline_version: "B-1.0.0",
      p_status: "success",
      p_total_tokens: totalPromptTokens + totalCompletionTokens
    };

    if (injectedScenario === "persistence_duplicate") {
      // Handled above
    }

    const { data: dbResult, error: dbError } = await supabaseService.rpc("persist_planner_run", runPayload);

    if (dbError) {
      console.error("DB Persistence Error:", dbError);
      return new Response(JSON.stringify({ error: "Failed to persist planner run" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (dbResult && dbResult.duplicate) {
      return new Response(JSON.stringify({ error: "DUPLICATE_REQUEST", message: "Request has already been processed" }), { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // 11. Response
    return new Response(JSON.stringify({
      content: finalContent,
      metadata: {
        model: plannerModel + " + " + rendererModel,
        provider: "gemini",
        latencyMs: runPayload.p_latency_ms,
        requestId: idempotencyKey,
        tokenUsage: {
          promptTokens: totalPromptTokens,
          completionTokens: totalCompletionTokens,
          totalTokens: runPayload.p_total_tokens
        }
      }
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error: any) {
    console.error("Pipeline B Fatal Error:", error);
    return new Response(JSON.stringify({ error: "Internal Server Error", details: error.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
});
