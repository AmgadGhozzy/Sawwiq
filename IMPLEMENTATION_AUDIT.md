# SAWWIQ — IMPLEMENTATION AUDIT

**Repository:** `C:\Users\HP\Desktop\Sawwiq`
**Audit Date:** 2026-08-20
**Auditor:** Principal Staff Engineer + Security Engineer + QA Architect

---

## Production Path

```
Browser (ContentGenerator.tsx)
  → fetch("/api/generate") [cookie: sawwiq_session — BUT COOKIE IS NEVER SET]
  → /api/generate/route.ts
     → validate input (Zod generateInputSchema.parse)
     → read session_token from cookie
     → fetch Supabase Edge Function (service call with anon key + x-session-token)
     → Edge Function (supabase/functions/generate/index.ts)
        → inputSchema.safeParse(body)
        → session lookup or create (supabase service_role)
        → rate limit check (read generations_count vs max_limit)
        → Gemini API call (GoogleGenAI)
        → JSON.parse(response.text)
        → generatedContentSchema.safeParse (Zod output)
        → validateClaims (deterministic claim validation)
        → persist_generation RPC (atomic: lock → check → insert w/ idempotency → increment)
        → return { success, result, remainingGenerations }
     ← Edge response forwarded to browser
  ← API route forwards Edge response
Browser renders GenerationResult
```

## Benchmark Path

```
scripts/run-benchmark.ts
  → ProductionGenerationAdapter (lib/ai/productionAdapter.ts)
     → imports from supabase/functions/generate/prompts/promptBuilder.ts
     → imports from supabase/functions/generate/validation/claimValidator.ts
     → imports from supabase/functions/generate/validation/schema.ts (generatedContentSchema)
     → Gemini API (same config: model, temp, topP)
     → Zod parse → Claim validate → throw on failure
  → evaluateDeterministic (lib/evaluation/evaluator.ts)
  → evaluateSemantic (optional, LLM-as-judge)
  → computeCombinedScore
  → Report to JSON
```

**Architecture Status:** FUNCTIONALLY COMPLETE BUT BROKEN AT SESSION LAYER

---

## PHASE STATUS

```
P0 Audit                 ✅ COMPLETE
P1 Session + RLS         🔴 BROKEN (middleware dead, cookie never set)
P2 Output Validation     ✅ COMPLETE
P3 Persistence + Quota   ✅ COMPLETE
P4 Prompt Consolidation  🔴 DUPLICATE SYSTEMS
P5 Benchmark             🔴 BROKEN (dataset enum mismatch)
P6 Cleanup               🟡 IDENTIFIED (not executed)
P7 E2E Verification      🟡 PARTIAL (session broken, no E2E tests)
P8 Edge Hardening        🟡 PARTIAL (missing timeout, retry, CORS)
P9 Database              ✅ COMPLETE (minor type drift)
P10 i18n                 🟡 PARTIAL (depends on working middleware)
P11 SEO                  🔴 NOT IMPLEMENTED
P12 Testing              🟡 PARTIAL (3 unit test files only)
P13 Security             🟡 PARTIAL (RLS solid, middleware broken, CORS open)
```

---

## CRITICAL FINDINGS

1. **proxy.ts is DEAD CODE** — It contains the session cookie creation logic but is never executed. There is no `middleware.ts` file. The sawwiq_session cookie is NEVER set in the browser. This means every generation attempt from the UI will send a request without a session cookie, and the API route will return error 400. The Edge Function can partially work around this by creating sessions from the x-session-token header, but the cookie never exists to be sent.

2. **Benchmark dataset.json is BROKEN** — Uses contentType values (`property_description`, `social_post`, `product_description`, `product_collection`) and arabicStyle values (`egyptian`, `gulf`, `formal`) that do NOT match the actual enum definitions in `types/content.ts`. Every benchmark test case will fail at input validation. The benchmark has never successfully run with the current dataset.

3. **.env.local committed with LIVE API keys** — Contains `GEMINI_API_KEY`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY` with real values. While `.env*` is in `.gitignore`, the file exists in the working tree with production credentials.

---

## HIGH PRIORITY FINDINGS

1. **Two complete parallel systems** — `lib/prompts/`, `lib/validation/claimValidator.ts`, and `lib/ai/gemini.ts` are independent copies of the Edge Function code. They serve different consumers (test-scenarios.ts uses lib/ai/gemini.ts, benchmark uses productionAdapter → Edge copies). The lib/ copies are NOT used in production but create maintenance burden and drift risk.

2. **CORS `*` on Edge Function** — Any website can call the Edge Function directly. The service_role key is only in the Edge Function environment, but this widens the attack surface.

3. **No Gemini timeout or retry** — The Edge Function has no AbortController, no generationTimeoutMs (defined in config.ts but never used), and no 429 retry. Gemini rate limits or slow responses will hang the request.

4. **supabase/types.ts has schema drift** — Missing `request_id` column on generations table, missing `persist_generation` RPC function definition.

5. **Error codes not normalized** — Edge Function returns SESSION_MISSING, EMPTY_RESPONSE, OUTPUT_SCHEMA_INVALID, CLAIM_VALIDATION_FAILED, PERSISTENCE_FAILED but API route only knows about a generic set from `types/content.ts`. Client receives raw strings.

6. **Output Contract layer in lib/ version contradicts its own comment** — Comment says "no JSON format instructions" but the content includes explicit JSON field names: `{ "title", "hook", "body", "callToAction", "hashtags" }`. The Edge Function version correctly omits this.

7. **lib/ai/productionAdapter.ts named misleadingly** — "ProductionAdapter" but is NOT used in production. It's used only by the benchmark script. The production path goes through the Edge Function directly.

---

## DEAD CODE

1. **proxy.ts** — Contains middleware logic (i18n + session cookie). Never imported, never executed. Should be renamed to `middleware.ts` or deleted.

2. **lib/prompts/promptBuilder.ts** — Complete 8-layer prompt builder. Only imported by `lib/ai/gemini.ts` which is itself dead for production.

3. **lib/prompts/contentTypes.ts** — Content type rules. Only imported by lib/prompts/promptBuilder.ts and lib/validation/claimValidator.ts (both dead for production).

4. **lib/prompts/dialects.ts** — Dialect rules. Only imported by lib/prompts/promptBuilder.ts.

5. **lib/validation/claimValidator.ts** — Claim validator. Only imported by lib/ai/gemini.ts. Edge Function has its own copy.

6. **lib/ai/gemini.ts** — GeminiProvider class. Only imported by `scripts/test-scenarios.ts`. NOT used in production path.

7. **lib/ai/types.ts** — AIProvider interface. Only imported by lib/ai/gemini.ts and lib/ai/productionAdapter.ts.

---

## DUPLICATE SYSTEMS

1. **Prompt Builder** — `lib/prompts/promptBuilder.ts` vs `supabase/functions/generate/prompts/promptBuilder.ts`. Same architecture, slight content drift (JSON format instructions).

2. **Claim Validator** — `lib/validation/claimValidator.ts` vs `supabase/functions/generate/validation/claimValidator.ts`. Same logic, independent copies.

3. **Content Type Rules** — `lib/prompts/contentTypes.ts` vs `supabase/functions/generate/prompts/contentTypes.ts`. Same data, different structure (lib/ uses `forbiddenClaims` typed as `ClaimClass[]`, Edge uses `string[]`).

4. **Dialect Rules** — `lib/prompts/dialects.ts` vs `supabase/functions/generate/prompts/dialects.ts`. Same data, different format (lib/ uses objects with `systemInstructions`, Edge uses raw strings).

5. **Input Schema** — `lib/validation/generation.ts` vs `supabase/functions/generate/validation/schema.ts`. Same validation, Edge adds `marketingObjective` and `session_token` optional fields.

6. **Output Schema** — Same in both locations, near-identical Zod schemas.

7. **Gemini Response Schema** — `lib/ai/gemini.ts` has field descriptions from CONTENT_FIELD_DESCRIPTIONS. Edge Function version has NO descriptions.

8. **Platform Rules** — Only in Edge Function (no lib/ copy). lib/ version has inline platform logic.

---

## WHAT IS ACTUALLY WORKING

1. **Edge Function core pipeline** — Input validation → session management → rate limiting → Gemini → output validation → claim validation → atomic persistence → response. All implemented and structurally sound.

2. **Database architecture** — 3 tables, proper RLS on all, atomic RPC with row locking and idempotency, proper indexes, triggers.

3. **RLS policies** — All 3 tables have RLS enabled with NO anon policies. Confirmed in SQL. Anon key cannot read/write any data.

4. **Client UI** — Full React UI with form validation (react-hook-form + Zod), loading states, error handling, result display, copy functionality, waitlist CTA. RTL support. Responsive.

5. **i18n framework** — next-intl configured with ar/en locales, complete translation files, language switcher, locale-aware layout.

6. **Deterministic evaluator** — 10+ checks including Arabic normalization, mustContain/mustNotContain with OR logic, hashtag validation, structural hygiene.

7. **Unit tests** — Validation schema edge cases, prompt builder layer verification, evaluator OR logic.

---

## WHAT IS NOT WORKING

1. **Session cookie creation** — proxy.ts is dead code, no middleware.ts exists. Cookie never set in browser.

2. **Benchmark execution** — dataset.json uses wrong enum values. Every test case fails validation.

3. **SEO** — No canonical, no OG, no JSON-LD, no sitemap, no robots.txt, no hreflang.

4. **Gemini timeout/retry** — No AbortController, no retry on 429, no backoff strategy.

5. **Error code normalization** — Edge-specific errors not typed in API route; client receives raw strings.

6. **TypeScript type drift** — supabase/types.ts missing request_id and persist_generation RPC.

---

## WHAT IS UNVERIFIABLE

1. **Whether benchmark can actually run** — Would need to verify if ProductionGenerationAdapter correctly handles the Edge Function imports at runtime. TypeScript compilation might fail due to Deno-style imports in the Edge Function files (`.ts` extensions in imports).

2. **Whether Edge Function is deployed and healthy** — Cannot verify Supabase deployment status.

3. **Whether RLS policies are actually applied** — SQL exists in migration files but cannot verify they were executed against the live database without running a query.

4. **Whether the app builds successfully** — `npm run build` was not run (prohibited by audit rules).

5. **Whether test-scenarios.ts works** — Needs live GEMINI_API_KEY (which exists in .env.local).

---

## DETAILED PHASE ANALYSIS

### PHASE 0 — FULL REPOSITORY AUDIT

**Status: ✅ COMPLETE**

- Production call graph: traced — session creation path is broken
- Benchmark call graph: traced — uses production-identical pipeline via productionAdapter
- Duplicate systems: **YES — 2 prompt builders, 2 claim validators, 2 input schemas, 2 output schemas, 2 Gemini response schemas**
- Dead code: proxy.ts, lib/ai/gemini.ts (for prod), lib/ai/types.ts (for prod), lib/validation/claimValidator.ts (for prod), all lib/prompts/* (for prod), lib/ai/productionAdapter.ts (for prod)
- Security issues: .env.local committed with live keys, CORS * on Edge Function, no middleware
- Migration dependencies: 3 migrations, all applied (assuming Supabase connected)

### PHASE 1 — SESSION + RLS

**Status: 🔴 BROKEN (middleware) / ✅ COMPLETE (RLS)**

1. **sawwiq_session created?** — NO middleware creates it. Edge Function creates sessions table rows, but no cookie is set.
2. **Where?** — Edge Function creates DB session rows on demand (line 77-83 of index.ts)
3. **middleware.ts runs it?** — middleware.ts does not exist. proxy.ts is dead code.
4. **proxy.ts used?** — Dead code — not imported anywhere, not named middleware.ts
5. **proxy.ts dead code?** — YES — 100% dead
6. **Cookie security:** HttpOnly ✓, Secure ✓ (production), SameSite lax ✓, Path=/ ✓ — **BUT COOKIE IS NEVER SET** so these settings are theoretical
7. **/api/generate reads it?** — YES (line 52) — but gets undefined since never set
8. **Edge Function receives it?** — Via x-session-token header (line 50) OR body.session_token fallback (line 51)
9. **session token in localStorage?** — No — good

**Supabase RLS:**

| Table | RLS Enabled | anon SELECT | anon INSERT | anon UPDATE | anon DELETE |
|-------|------------|-------------|-------------|-------------|-------------|
| sessions | ✅ (002) | ❌ denied | ❌ denied | ❌ denied | ❌ denied |
| generations | ✅ (002) | ❌ denied | ❌ denied | ❌ denied | ❌ denied |
| waitlist | ✅ (002) | ❌ denied | ❌ denied | ❌ denied | ❌ denied |

service_role paths continue working (bypasses RLS). **CONFIRMED in SQL.**

### PHASE 2 — PRODUCTION OUTPUT VALIDATION

**Status: ✅ COMPLETE**

Path verified in Edge Function (index.ts:100-147):
```
Gemini → response.text → JSON.parse → generatedContentSchema.safeParse → validateClaims → persist
```

- Output schema exists? ✅ `supabase/functions/generate/validation/schema.ts`
- Edge Function uses it? ✅ Line 9, 122
- JSON.parse protected? ✅ Inside try/catch (line 23)
- Zod parse/safeParse? ✅ Line 122
- ClaimValidator in production? ✅ Line 137
- Deterministic evaluator in production? ❌ (Not needed — claim validator is sufficient for prod)
- Validation BEFORE DB insert? ✅ Lines 122-147 before line 150
- Validation BEFORE response? ✅ Same

**Error Codes:**

| Code | In Edge Function | In API route (types) |
|------|-----------------|---------------------|
| INVALID_INPUT | ✅ (as VALIDATION_ERROR) | ✅ |
| SESSION_MISSING | ✅ | ❌ (uses INTERNAL_ERROR) |
| RATE_LIMITED | ❌ | ✅ (unused) |
| RATE_LIMIT_REACHED | ✅ | ✅ |
| GEMINI_TIMEOUT | ❌ | ❌ |
| GEMINI_RATE_LIMITED | ❌ | ❌ |
| GEMINI_ERROR | ❌ | ❌ |
| EMPTY_RESPONSE | ✅ | ❌ |
| OUTPUT_SCHEMA_INVALID | ✅ | ❌ |
| CLAIM_VALIDATION_FAILED | ✅ | ❌ |
| PERSISTENCE_FAILED | ✅ | ❌ |

### PHASE 3 — PERSISTENCE + ATOMIC QUOTA

**Status: ✅ COMPLETE**

- Generation insert awaited? ✅ `await supabase.rpc("persist_generation", ...)` (Edge line 150)
- Fire-and-forget? ❌ No — fully awaited
- RPC exists? ✅ `persist_generation` (003_generation_atomicity.sql)
- Atomic? ✅ `FOR UPDATE` row lock + insert + increment in single transaction
- Idempotency key? ✅ `request_id` column with `UNIQUE` constraint
- Race condition protection? ✅ `SELECT ... FOR UPDATE` prevents concurrent increment
- Retry → duplicate? ❌ UNIQUE violation caught → returns existing state (line 38-40)
- DB failure behavior? ✅ Returns error response (line 160-165)

**Gap:** `supabase/types.ts` does not include `request_id` column in the generations type definition. Schema drift.

### PHASE 4 — PROMPT CONSOLIDATION

**Status: 🔴 NOT IMPLEMENTED (duplicated)**

**Prompt Systems:**

| File | Used By | Production | Benchmark | Tests |
|------|---------|-----------|-----------|-------|
| `lib/prompts/promptBuilder.ts` | lib/ai/gemini.ts | ❌ | ❌ | ❌ |
| `supabase/functions/generate/prompts/promptBuilder.ts` | Edge Function + productionAdapter | ✅ | ✅ | ✅ (promptBuilder.test.ts) |

Both are complete, 8-layer prompt engines with near-identical content. They have **drifted**:
- lib/ version: output contract includes explicit JSON field names example
- Edge version: output contract says "no JSON format instructions"

The lib/ prompts, claimValidator, contentTypes, dialects are **NOT used in production**.

**Source of truth:** Edge Function copy (`supabase/functions/generate/prompts/*`)

**Edge Function prompt layers verified:**
1. ✅ Global Rules
2. ✅ Language/Dialect
3. ✅ Content Type
4. ✅ Input Context (with `<user_input>` tags)
5. ✅ Fact Boundary
6. ✅ Marketing Objective (optional)
7. ✅ Output Contract

### PHASE 5 — BENCHMARK

**Status: 🔴 BROKEN**

- Uses same production pipeline? ✅ Via `ProductionGenerationAdapter`
- Same input schema? ✅
- Same prompt builder? ✅
- Same Gemini config? ✅
- Same output schema? ✅
- Same claim validator? ✅

**CRITICAL: dataset.json uses wrong enum values:**

| Dataset value | Expected (ContentType) | Status |
|---------------|----------------------|--------|
| `property_description` | `real_estate` | ❌ MISMATCH |
| `social_post` | `interactive_post` | ❌ MISMATCH |
| `product_description` | `ecommerce_product` | ❌ MISMATCH |
| `product_collection` | (not in enum) | ❌ MISSING |

| Dataset value | Expected (ArabicStyle) | Status |
|---------------|----------------------|--------|
| `egyptian` | `egyptian_colloquial` | ❌ MISMATCH |
| `gulf` | `gulf_premium` | ❌ MISMATCH |
| `white_arabic` | `white_arabic` | ✅ OK |
| `formal` | `formal_b2b` | ❌ MISMATCH |

**The benchmark WILL FAIL on every test case** because input validation will reject invalid contentType/arabicStyle.

Also: benchmark hardcodes `platform: "tiktok"` for all test cases (line 70).

### PHASE 6 — DEAD CODE / CLEANUP

**Status: 🟡 IDENTIFIED (not executed)**

| File | Used by Production | Used by Benchmark | Used by Tests | Safe to Delete |
|------|-------------------|-------------------|---------------|---------------|
| `proxy.ts` | ❌ | ❌ | ❌ | ✅ SAFE |
| `lib/ai/gemini.ts` | ❌ | ❌ | ✅ test-scenarios.ts | ❌ KEEP (tests) |
| `lib/ai/types.ts` | ❌ | ❌ | ✅ via gemini.ts | ❌ KEEP |
| `lib/ai/productionAdapter.ts` | ❌ | ✅ | ❌ | ❌ KEEP (benchmark) |
| `lib/validation/claimValidator.ts` | ❌ | ❌ | ❌ | ✅ SAFE (Edge copy used) |
| `lib/prompts/promptBuilder.ts` | ❌ | ❌ | ❌ | ✅ SAFE (Edge copy used) |
| `lib/prompts/contentTypes.ts` | ❌ | ❌ | ❌ | ✅ SAFE (Edge copy used) |
| `lib/prompts/dialects.ts` | ❌ | ❌ | ❌ | ✅ SAFE (Edge copy used) |
| `lib/config.ts` | ✅ | ✅ | ✅ | ❌ MUST KEEP |
| `lib/analytics/*` | ✅ | ❌ | ❌ | ❌ MUST KEEP |
| `lib/supabase/*` | ✅ | ❌ | ❌ | ❌ MUST KEEP |
| `lib/evaluation/*` | ❌ | ✅ | ✅ | ❌ MUST KEEP |
| `supabase/functions/generate/*` | ✅ | ✅ | ✅ | ❌ MUST KEEP |
| `scripts/test-concurrency.ts` | ❌ | ❌ | ✅ | ❌ KEEP |

### PHASE 7 — E2E PIPELINE

**Status: 🟡 PARTIAL (session creation broken)**

| Step | Implemented? | Actually Called? | Tested? |
|------|-------------|-----------------|---------|
| Browser → Middleware → Session Cookie | ❌ proxy.ts dead, no middleware.ts | ❌ | ❌ |
| /api/generate input validation | ✅ | ✅ | ✅ |
| Session token extraction from cookie | ✅ | ✅ (gets undefined) | ❌ |
| Edge Function call | ✅ | ✅ | ❌ (no live E2E test) |
| Edge input validation | ✅ | ✅ | ❌ |
| Edge rate limit check | ✅ | ✅ | ❌ |
| Edge prompt build | ✅ | ✅ | ✅ (unit) |
| Edge Gemini call | ✅ | ✅ | ❌ (needs API) |
| Edge JSON.parse | ✅ | ✅ | ❌ |
| Edge Zod output validation | ✅ | ✅ | ✅ (unit) |
| Edge claim validation | ✅ | ✅ | ❌ |
| Edge persistence (RPC) | ✅ | ✅ | ❌ (needs DB) |
| Edge atomic quota | ✅ | ✅ | ❌ (needs DB) |
| Response → Browser UI | ✅ | ✅ | ❌ |

**Scenario Coverage:**

| # | Scenario | Path Works? | Error Handled? |
|---|----------|------------|----------------|
| 1 | Happy path | ❌ No session cookie → Edge creates session → succeeds | Partial |
| 2 | Invalid input | ✅ Zod rejects | ✅ |
| 3 | Missing session | ⚠️ Cookie never set → always triggers | ✅ |
| 4 | Invalid session | Edge creates new session | ✅ |
| 5 | Quota exhausted | ✅ RPC returns RATE_LIMIT_REACHED | ✅ |
| 6 | Malformed Gemini JSON | ✅ try/catch around JSON.parse | ✅ |
| 7 | Invalid output schema | ✅ safeParse rejects | ✅ |
| 8 | Forbidden claim | ✅ validateClaims catches | ✅ |
| 9 | Missing required field | ✅ Zod catches | ✅ |
| 10 | Invalid hashtag count | ✅ Zod catches | ✅ |
| 11 | Gemini timeout | ❌ No AbortController | ❌ |
| 12 | Gemini 429 | ❌ No retry/backoff | ❌ |
| 13 | Gemini 500 | ✅ try/catch | ✅ |
| 14 | DB failure | ✅ RPC error handling | ✅ |
| 15 | Duplicate request | ✅ Idempotency via UNIQUE request_id | ✅ |
| 16 | Concurrent generation | ✅ Row-level locking | ✅ |
| 17 | Direct anon DB access | ✅ RLS blocks all anon | ✅ |
| 18 | Arabic locale | ✅ i18n configured | ✅ |
| 19 | English locale | ✅ i18n configured | ✅ |

### PHASE 8 — EDGE FUNCTION QUALITY

**Status: 🟡 PARTIAL**

| Aspect | Status | Notes |
|--------|--------|-------|
| Deno compatibility | ✅ | Uses Deno.serve, Deno.env.get |
| Secrets isolation | ✅ | GEMINI_API_KEY, SERVICE_ROLE_KEY via Deno.env |
| Stateless | ✅ | No in-memory state between requests |
| Gemini init | ✅ | Per-request client creation |
| Timeout | ❌ | No AbortController, no generationTimeoutMs used |
| 429 handling | ❌ | No retry/backoff for Gemini 429 |
| Retry strategy | ❌ | No retry at all |
| Error normalization | ✅ | All errors → structured JSON responses |
| CORS | ⚠️ | `Access-Control-Allow-Origin: *` — allows ANY origin |
| Structured logging | ✅ | `[Edge]` prefix, console.error for failures |
| Correlation/request ID | ✅ | x-request-id header (passed from API route) |
| Scalability | ✅ | Stateless Deno, no shared state |
| Idempotency | ✅ | Via request_id UNIQUE constraint |
| Persistence | ✅ | Atomic RPC |
| Validation | ✅ | Input + output + claim validation |

**CORS Risk:** `Access-Control-Allow-Origin: *` means any website can call the Edge Function directly. With service_role key, the Edge Function protects itself, but this is still a risk vector.

### PHASE 9 — DATABASE ARCHITECTURE

**Status: ✅ COMPLETE (with minor drift)**

**sessions table:**
- Schema: ✅ UUID PK, TEXT session_token UNIQUE, INTEGER generations_count, INTEGER max_limit, TIMESTAMPTZ created_at/updated_at
- Index: ✅ idx_sessions_token
- RLS: ✅ Enabled, no anon policies
- Trigger: ✅ auto-update updated_at

**generations table:**
- Schema: ✅ UUID PK, FK→sessions, TEXT prompt/platform/content_type/arabic_style, JSONB ai_response, TIMESTAMPTZ created_at
- Added: ✅ UUID request_id UNIQUE (migration 003)
- Index: ✅ idx_generations_session
- RLS: ✅ Enabled, no anon policies

**waitlist table:**
- Schema: ✅ UUID PK, FK→sessions, TEXT email UNIQUE, TIMESTAMPTZ created_at
- Index: ✅ idx_waitlist_email
- RLS: ✅ Enabled, no anon policies

**Schema Drift:**
- `supabase/types.ts` missing `request_id` column in generations type ❌
- `supabase/types.ts` has `Functions: Record<string, never>` — doesn't include `persist_generation` RPC ❌

### PHASE 10 — i18n

**Status: 🟡 PARTIAL**

- next-intl installed? ✅ (v4.13.7)
- routing.ts? ✅ locales: [ar, en], default: ar
- request.ts? ✅ getRequestConfig with locale validation
- messages/ar.json? ✅ Complete
- messages/en.json? ✅ Complete
- app/[locale]/layout.tsx? ✅ locale validation + notFound()
- app/[locale]/page.tsx? ✅ Server component using useTranslations
- RTL? ✅ `dir={locale === "ar" ? "rtl" : "ltr"}`
- LTR? ✅ Same
- Language switcher? ✅ LanguageSwitcher.tsx
- Server translations? ✅ getTranslations in layout
- Client translations? ✅ useTranslations in components
- API routes outside locale routing? ✅ /api/generate, /api/waitlist

**Missing:**
- middleware.ts for i18n routing? ❌ proxy.ts has next-intl middleware but is dead code

### PHASE 11 — SEO

**Status: 🔴 NOT IMPLEMENTED**

| Aspect | Status |
|--------|--------|
| Metadata (title, description) | ✅ Via generateMetadata |
| Canonical | ❌ |
| hreflang | ❌ |
| robots.txt | ❌ |
| sitemap | ❌ |
| JSON-LD | ❌ |
| OpenGraph | ❌ |
| Twitter/X metadata | ❌ |
| Semantic HTML | 🟡 Some (h1, header, main, section) |
| Heading hierarchy | ✅ h1 → h2 → h3 proper |
| Internal linking | ❌ Single page |
| Indexability | ❌ No controls |
| Duplicate content | ❌ /ar and /en same content, no canonical |
| URL architecture | ✅ /ar, /en clean |
| Arabic SEO | ❌ No hreflang, no Arabic-specific meta |
| English SEO | ❌ Same |
| Core Web Vitals | ❌ Not measured |
| Image optimization | 🟡 next/image used for logo |
| Font optimization | ✅ next/font/google (IBM Plex Sans Arabic, Inter) |
| Mobile | ✅ Responsive layout |
| Accessibility | 🟡 aria-labels, role="alert" on some |

### PHASE 12 — TESTING

**Status: 🟡 PARTIAL**

| Test Type | Files | Coverage |
|-----------|-------|----------|
| Unit (validation) | __tests__/validation.test.ts | Input + output schema edge cases ✅ |
| Unit (promptBuilder) | __tests__/promptBuilder.test.ts | All layers, all styles, all platforms ✅ |
| Unit (evaluator) | __tests__/evaluator.test.ts | mustContain OR logic ✅ |
| Integration | scripts/test-scenarios.ts | 5 scenarios (needs API key) |
| Concurrency | scripts/test-concurrency.ts | 4 tests (needs DB) |
| E2E | ❌ None | — |
| Edge Function | ❌ None (no Deno test) | — |
| Database | ❌ None (only concurrency script) | — |
| Security | ❌ None | — |

### PHASE 13 — SECURITY AUDIT

| # | Finding | Severity |
|---|---------|----------|
| 1 | `.env.local` committed with LIVE GEMINI_API_KEY and SUPABASE keys | **CRITICAL** |
| 2 | No middleware — session cookie never created, so session-based auth is broken | **CRITICAL** |
| 3 | CORS `Access-Control-Allow-Origin: *` on Edge Function | **HIGH** |
| 4 | No AbortController / timeout on Gemini calls (Edge Function) | **HIGH** |
| 5 | No Gemini 429 retry/backoff (production loses requests) | **MEDIUM** |
| 6 | No rate limiting middleware (all rate limiting is DB-based, single layer) | **MEDIUM** |
| 7 | Prompt injection boundary is soft (`<user_input>` tags, acknowledged in code) | **MEDIUM** |
| 8 | Error codes from Edge Function not typed in API route (raw string passthrough) | **LOW** |
| 9 | No HTML/Markdown/JSON artifact leaking (caught by claim validator) | ✅ OK |
| 10 | No SQL injection (Supabase client + parameterized RPC) | ✅ OK |
| 11 | No XSS (React auto-escapes, no dangerouslySetInnerHTML) | ✅ OK |
| 12 | No secret leakage to client bundle (GEMINI_API_KEY only server-side) | ✅ OK |
| 13 | Session token opaque UUID (no enumeration possible) | ✅ OK |
| 14 | Cross-user access blocked (RLS + service_role isolation) | ✅ OK |
| 15 | Waitlist abuse mitigated (UNIQUE email, idempotent upsert) | ✅ OK |
| 16 | Quota manipulation blocked (atomic RPC with row locking) | ✅ OK |

---

## RECOMMENDED NEXT ORDER

1. **[CRITICAL] Fix session middleware** — Rename `proxy.ts` to `middleware.ts` at project root. This single change fixes the session cookie creation, enables i18n routing middleware, and unblocks the entire generation flow.

2. **[CRITICAL] Fix benchmark dataset** — Update `lib/evaluation/dataset.json` contentType values to match `CONTENT_TYPES` enum (`real_estate`, `interactive_post`, `ecommerce_product`) and arabicStyle values to match `ARABIC_STYLES` enum (`egyptian_colloquial`, `gulf_premium`, `formal_b2b`).

3. **[HIGH] Consolidate prompt systems** — Delete `lib/prompts/*` and `lib/validation/claimValidator.ts`. Update `lib/ai/gemini.ts` and `lib/ai/productionAdapter.ts` to import from Edge Function copies. This eliminates drift risk.

4. **[HIGH] Add Gemini timeout and retry** — Add AbortController with 30s timeout to Edge Function. Add exponential backoff retry for 429 responses.

5. **[HIGH] Restrict CORS** — Change Edge Function CORS from `*` to specific allowed origins (your Vercel domain).

6. **[HIGH] Update supabase/types.ts** — Add `request_id` to generations type, add `persist_generation` RPC function type.

7. **[MEDIUM] Remove dead code** — Delete proxy.ts (after renaming), clean up unused lib/ files.

8. **[MEDIUM] Normalize error codes** — Add Edge-specific error codes to `types/content.ts` and map them properly in the API route.

9. **[MEDIUM] Commit .env.local to .gitignore** — Verify .gitignore properly excludes it (it does in the list, but file is already tracked). Run `git rm --cached .env.local`.

10. **[LOW] SEO implementation** — Add canonical, OG, JSON-LD, sitemap, robots.txt, hreflang after core stability.

---

## PRODUCTION READINESS SCORE

| Axis | Score | Notes |
|------|-------|-------|
| Architecture | 7/10 | Edge Function pipeline solid, session layer broken |
| Security | 6/10 | RLS + atomic quota excellent, middleware + CORS gaps |
| Data Integrity | 9/10 | Atomic RPC, idempotency, row locking |
| AI Validation | 8/10 | Zod + claim validator + output schema. Gemini timeout missing |
| Persistence | 9/10 | Atomic, idempotent, awaited. Type drift minor |
| Scalability | 7/10 | Stateless Deno, but no retry/timeout |
| Testing | 3/10 | 3 unit test files, no E2E, no Edge tests |
| i18n | 6/10 | Framework complete, depends on broken middleware |
| SEO | 1/10 | Only basic metadata |
| Observability | 5/10 | Request IDs, console logging, analytics noop |

**Overall: NOT READY**

**Reason:** The session middleware is non-functional (proxy.ts is dead code, no middleware.ts exists), which means the sawwiq_session cookie is never created in the browser. This breaks the core generation flow because the API route cannot extract a session token from the cookie. Additionally, the benchmark is broken due to dataset enum mismatches, and there are significant duplicate systems creating maintenance and drift risk. The Edge Function pipeline itself is architecturally solid with proper validation, atomic persistence, and RLS protection — but the surrounding infrastructure (middleware, benchmark, error normalization, CORS, timeout) needs remediation before production deployment.
