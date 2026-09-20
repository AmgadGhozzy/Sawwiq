# Pipeline B — Supabase Edge Function Contract

**Version**: 1.0.0  
**Status**: DESIGN — pre-implementation  
**Runtime**: Deno (Supabase Edge Functions)  
**Path**: `supabase/functions/planner/index.ts`

> [!IMPORTANT]
> هذا الملف هو العقد الرسمي للـEdge Function.
> لا يُكتب كود قبل اعتماده.

---

## 1. الهيكل الداخلي للـEdge Function

```
supabase/functions/planner/
├── index.ts                 ← Deno.serve — orchestrator فقط
├── validation/
│   └── schema.ts            ← Zod schema للـbody (مكافئ لـlib/planner/validation)
├── planner/
│   └── plannerCall.ts       ← Gemini call للـplanning step
├── renderer/
│   └── rendererCall.ts      ← Gemini call للـrendering step
├── ir/
│   ├── compiler.ts          ← يُضيف edges حتميًا من topology
│   └── validator.ts         ← port مبسط من lib/planner/validation.ts
└── utils/
    ├── cors.ts              ← نفس نمط generate/utils/cors.ts
    └── observability.ts     ← structured logging helpers
```

> [!NOTE]
> `ir/validator.ts` هو port مبسط من `lib/planner/validation.ts` لأن الـDeno runtime لا يستطيع استيراد ملفات Next.js مباشرة. يشارك نفس المنطق، لكنه ملف مستقل. يُحافظ على تزامنه مع `lib/planner/validation.ts` يدويًا في كل تغيير.

---

## 2. Environment Variables المطلوبة

| Variable | الوصف | موجودة في A؟ |
|---|---|---|
| `VERTEX_AI_API_KEY` | Gemini API key للـplanner | ✅ نفس المتغير |
| `PLANNER_GEMINI_MODEL` | model للـplanning step | ❌ جديد |
| `RENDERER_GEMINI_MODEL` | model للـrendering step | ❌ جديد |
| `SUPABASE_URL` | Supabase URL | ✅ نفس المتغير |
| `SERVICE_ROLE_KEY` | Service role للـRPC | ✅ نفس المتغير |

> [!WARNING]
> `PLANNER_GEMINI_MODEL` و`RENDERER_GEMINI_MODEL` قابلان للتغيير بشكل مستقل عن Pipeline A.
> هذا يسمح باختبار نماذج مختلفة للـplanning مقابل الـrendering.
> القيمة الافتراضية لكليهما: `"gemini-2.5-flash-lite"` حتى تُحدَّد من benchmark.

---

## 3. تسلسل التنفيذ

```
[1] CORS preflight check
      ↓
[2] Env vars validation
      ↓
[3] Parse & validate body (Zod)
      ↓
[4] Extract session token + request ID from headers
      ↓
[5] Session lookup / creation (Supabase RPC)
      ↓
[6] Rate limit check (generations_count >= max_limit)
      ↓
[7] ── PLANNER CALL ──────────────────────────────────────
      Gemini call: buildPlannerPrompt(request) → IR nodes
      Log: planner_request (attempt-level)
      Log: planner_complete (run-level)
      ↓
[8] ── IR COMPILATION ───────────────────────────────────
      ir/compiler.ts: inject edges from topology (deterministic)
      No LLM call — pure computation
      ↓
[9] ── IR VALIDATION ────────────────────────────────────
      ir/validator.ts: validateIRGraph(ir, persona)
      If FAIL → log planner_validation_failure → return 502
      ↓
[10] ── RENDERER CALL ───────────────────────────────────
      Gemini call: buildRendererPrompt(ir, request) → GeneratedContent
      Log: renderer_request (attempt-level)
      Log: renderer_complete (run-level)
      ↓
[11] ── OUTPUT VALIDATION ───────────────────────────────
      Validate GeneratedContent shape (Zod)
      If FAIL → return 502
      ↓
[12] ── PERSIST ─────────────────────────────────────────
      Supabase RPC: persist_planner_generation
      Atomic: persist + increment generations_count
      ↓
[13] ── ASYNC EVALUATION TRIGGER ────────────────────────
      Fire-and-forget (no await)
      Only on sample rate (e.g. 5% of requests)
      ↓
[14] Return PlannerResponse
```

---

## 4. Planner Call Contract

### Input

```typescript
buildPlannerPrompt(request: PlannerRequest): string
// Returns system prompt with:
//   - persona semantic constraints (from buildSemanticPlannerConstraints)
//   - required node IDs from TOPOLOGY_REQUIRED[persona].nodes
//   - topic + platform + objective + language + constraints
//   - explicit instruction: generate ONLY node content, NO edges, NO extra nodes
```

### Output (raw from Gemini — JSON)

```json
{
  "nodes": [
    { "id": "system",       "content": "..." },
    { "id": "constraint",   "content": "..." },
    { "id": "mechanism",    "content": "..." },
    { "id": "intervention", "content": "..." },
    { "id": "consequence",  "content": "..." }
  ]
}
```

الـPlanner **لا يُنتج edges**. Edges تُضاف حتميًا في الخطوة التالية.

---

## 5. IR Compiler Contract

```typescript
// ir/compiler.ts
function compileIRGraph(
  plannerNodes: { id: string; content: string }[],
  personaId: PersonaId
): IRGraph {
  // Takes nodes from Planner
  // Injects edges deterministically from TOPOLOGY_REQUIRED[personaId].edges
  // Sets version = IR_SCHEMA_VERSION
  // Returns IRGraph ready for validation
}
```

**لا decisions**، لا Gemini، لا randomness — pure function.

---

## 6. Renderer Call Contract

### Input

```typescript
buildRendererPrompt(ir: IRGraph, request: PlannerRequest): string
// Takes a VALIDATED IRGraph (not raw planner output)
// If IR is invalid → error thrown before this function is called
// Returns system prompt that instructs Gemini to:
//   - render the node contents into a coherent GeneratedContent
//   - respect platform, language, objective, constraints
//   - maintain persona voice (from ir.personaId)
//   - produce title + hook + body + callToAction + hashtags
```

> [!IMPORTANT]
> Renderer يستقبل فقط IR صالحًا.
> `validateIRGraph()` يجب أن تُنفَّذ وتنجح **قبل** استدعاء الـRenderer.
> Renderer ليس طريقة ملتوية لتجاوز I1.

### Output (raw from Gemini — JSON)

```json
{
  "title":        "...",
  "hook":         "...",
  "body":         "...",
  "callToAction": "...",
  "hashtags":     ["..."]
}
```

نفس shape `GeneratedContent` من `types/content.ts`.

---

## 7. Session & Quota — الفصل الحتمي

### Authentication

Pipeline B يشارك **هوية الـsession فقط** مع A:
- نفس `sawwiq_session` cookie للتحقق من هوية الطلب.
- نفس `sessions` table للـsession lookup.

### Quota — فصل كامل

> [!IMPORTANT]
> **Pipeline B لا يستهلك `generations_count` للمستخدم أبدًا.**
> Shadow Mode قد يُشغّل B تلقائيًا على طلبات A — لو شاركا نفس العداد:
> طلب واحد من المستخدم → A + B → `generations_count += 2`. غير مقبول.

```
Authentication / Session
        │
        ├──────────► A → يستهلك generations_count
        │
        └──────────► B → لا يمس generations_count

B Usage
        │
        └──────────► internal evaluation budget (منفصل)
```

### B Internal Budget

Pipeline B في الـinternal alpha يخضع لـbudget داخلي مستقل:

| الحد | القيمة الافتراضية | المتغير |
|---|---|---|
| Max requests / day | 500 | `PLANNER_DAILY_BUDGET` |
| Max concurrent requests | 10 | `PLANNER_MAX_CONCURRENT` |
| Max tokens / day | 500,000 | `PLANNER_TOKEN_BUDGET` |
| Kill switch | false | `PLANNER_ENABLED` |

إذا وصل أي حد:
```
B → disabled (يعيد 503 داخليًا)
A → continues normally — لا تأثير
```

> [!CAUTION]
> تعطل B أو استنفاد الـbudget **يجب ألا يمنع Pipeline A أو يؤثر عليه بأي شكل.**
> الـkill switch هو متغير Supabase Edge Function secret — يُغيَّر بدون deploy.
> الـRPC (`persist_planner_run`) **يُسجّل الاستهلاك فقط ولا يفرض الحد.**
> تطبيق حد الـ500 طلب يتم داخل الـEdge Function عبر فحص جدول `planner_budget` قبل التوليد.
> **توضيح التزامن:** حد الـ 500/day هو **Operational Target / Alert Threshold** وليس Maximum Guaranteed. تحت التزامن العالي قد تتجاوز الطلبات 500 بقليل لأن التحقق ليس Atomic Hard Gate، وذلك لتجنب تعقيد الـLocks على مستوى قاعدة البيانات لغرض اختباري (Alpha). إذا احتجنا لاحقًا إلى سقف صارم (Hard Ceiling)، سنضيف RPC منفصل للحجز المسبق (Reservation).

### لا يستدعي `persist_generation` الحالي

Pipeline B يستخدم RPC جديدًا منفصلًا (يُنشأ في PHASE 3):
```sql
-- persist_planner_run (جديد)
-- يسجّل: request_id, persona_id, ir_version, pipeline_version
-- يُحدّث: b_usage_count (في جدول منفصل، ليس sessions)
-- لا يمس: generations_count في sessions
```

---

## 8. Timeout Policy

| الخطوة | Budget |
|---|---|
| Planner LLM call | 20,000 ms |
| Renderer LLM call | 20,000 ms |
| Total Edge Function | 35,000 ms |
| Route → Edge timeout | 40,000 ms |

إذا تجاوزت الـtotal 35,000 ms → `PLANNER_TIMEOUT`.

---

## 9. Retry Policy

| الخطأ | Retry |
|---|---|
| 429 (rate limit) | نعم — exponential backoff، max 2 retries، max delay 8s |
| timeout | نعم — مرة واحدة فقط |
| 5xx من Gemini | لا — fail fast |
| IR validation failure | لا — fail fast (إعادة المحاولة لن تُصلح IR فاسد) |

---

## 10. Supabase RPC المطلوب

```sql
-- جديد: persist_planner_generation
-- يُنشأ في supabase/migrations/ في PHASE 2 التنفيذي
-- نفس منطق persist_generation لكن مع metadata يشمل pipeline + IR
```

> [!WARNING]
> لا تعديل على `persist_generation` الحالية — هي خاصة بـPipeline A.
> Pipeline B يستخدم RPC جديدًا أو نفس الـRPC مع parameter إضافي — يُقرَّر في PHASE 2.

---

## 11. CORS

نفس `cors.ts` من `supabase/functions/generate/utils/cors.ts` — يُنسخ (لا يُستورد) إلى `supabase/functions/planner/utils/cors.ts`.
