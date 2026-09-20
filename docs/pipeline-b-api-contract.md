# Pipeline B — API Contract

**Version**: 1.0.0  
**Status**: DESIGN — pre-implementation  
**Scope**: `app/api/planner/route.ts` ↔ `supabase/functions/planner/`

> [!IMPORTANT]
> هذا الملف هو العقد الرسمي للـAPI. لا يُكتب كود قبل اعتماده.
> أي انحراف عن هذا العقد أثناء التنفيذ يستلزم تحديث هذا الملف أولًا.

---

## 1. المبادئ المعمارية

```
Client
  │
  ▼
app/api/planner/route.ts          ← Next.js route, Node.js runtime
  │  validates + sanitizes + auth
  │  forwards x-session-token header
  │
  ▼
supabase/functions/planner/       ← Deno Edge Function
  │  session check + rate limit
  │  Planner LLM call
  │  IR Validation (validateIRGraph)
  │  Renderer LLM call
  │  async evaluation trigger
  │
  ▼
PlannerResponse
```

**قواعد صارمة**:
- `app/api/planner` لا يستورد من `app/api/generate` ولا العكس.
- `supabase/functions/planner` لا يستورد من `supabase/functions/generate` ولا العكس.
- كلا الـroutes يشتركان فقط في الأنواع من `lib/planner/*` و`types/content`.
- Pipeline A لا يُعدَّل، لا يُلمس، لا يُعاد توجيهه.

---

## 2. HTTP Request

```
POST /api/planner
Content-Type: application/json
Cookie: sawwiq_session=<token>         ← نفس cookie Pipeline A
x-request-id: <uuid>                   ← اختياري من العميل، يُولَّد إذا غاب
```

### Request Body

```json
{
  "persona":   "developer",
  "topic":     "لماذا تفشل فرق العمل في التواصل؟",
  "platform":  "linkedin",
  "objective": "education",
  "language":  "ar",
  "audience":  "مطورو البرمجيات",
  "constraints": {
    "forbiddenTerms":      ["تحديات"],
    "requiredTerms":       ["إنتاجية"],
    "maxLength":           800,
    "customInstructions":  "ابدأ بسؤال."
  }
}
```

**حدود الـbody**: `MAX_BODY_SIZE = 10,240 bytes` (نفس Pipeline A).

---

## 3. HTTP Responses

### 200 — Success

```json
{
  "success": true,
  "data": {
    "title":         "...",
    "hook":          "...",
    "body":          "...",
    "callToAction":  "...",
    "hashtags":      ["..."]
  },
  "remainingGenerations": 2,
  "meta": {
    "requestId":      "uuid",
    "pipelineVersion": "B-1.0.0"
  }
}
```

> [!NOTE]
> `data` shape مطابق لـ`GeneratedContent` من `types/content.ts` — نفس شكل Pipeline A.  
> هذا مقصود لتسهيل الـA/B comparison في Shadow Mode.

### 400 — Validation Error

```json
{
  "success": false,
  "error":   { "code": "PLANNER_INVALID_REQUEST" },
  "meta":    { "requestId": "uuid" }
}
```

### 401 — No Session

```json
{
  "success": false,
  "error":   { "code": "SESSION_MISSING" },
  "meta":    { "requestId": "uuid" }
}
```

### 403 — Rate Limit

```json
{
  "success": false,
  "error":   { "code": "RATE_LIMIT_REACHED" },
  "meta":    { "requestId": "uuid" }
}
```

### 502 — Planner or Renderer Failure

```json
{
  "success": false,
  "error":   { "code": "PLANNER_FAILURE" },
  "meta":    { "requestId": "uuid" }
}
```

### 504 — Timeout

```json
{
  "success": false,
  "error":   { "code": "PLANNER_TIMEOUT" },
  "meta":    { "requestId": "uuid" }
}
```

### 503 — Service Unavailable (misconfigured env)

```json
{
  "success": false,
  "error":   { "code": "PLANNER_INTERNAL_ERROR" },
  "meta":    { "requestId": "uuid" }
}
```

---

## 4. HTTP Status Mapping

| الحالة | HTTP Status | الكود |
|---|---|---|
| نجاح | 200 | — |
| validation error (request) | 400 | `PLANNER_INVALID_REQUEST` |
| body too large | 413 | `PLANNER_INVALID_REQUEST` |
| لا session | 401 | `SESSION_MISSING` |
| rate limit | 403 | `RATE_LIMIT_REACHED` |
| IR validation failed | 502 | `PLANNER_INVALID_IR` |
| planner LLM failed | 502 | `PLANNER_FAILURE` |
| renderer LLM failed | 502 | `PLANNER_RENDER_FAILURE` |
| timeout (route → edge) | 504 | `PLANNER_TIMEOUT` |
| env not configured | 503 | `PLANNER_INTERNAL_ERROR` |
| unhandled error | 500 | `PLANNER_INTERNAL_ERROR` |

---

## 5. Headers المُمرَّرة من Route إلى Edge Function

```
Content-Type:     application/json
Authorization:    Bearer <NEXT_PUBLIC_SUPABASE_ANON_KEY>
apikey:           <NEXT_PUBLIC_SUPABASE_ANON_KEY>
x-session-token:  <من cookie>
x-request-id:     <requestId>
x-pipeline:       B
```

`x-pipeline: B` يسمح للـEdge Function بالتمييز بين الاستدعاءين في الـlogs دون الحاجة لـURL inspection.

---

## 6. Route Timeout

| Timeout | القيمة |
|---|---|
| Route → Edge Function | 40,000 ms |
| Edge Function internal budget | 35,000 ms |

الـroute timeout أكبر بـ5 ثوانٍ للسماح بـoverhad الـfetch نفسه.

---

## 7. ما لا يفعله route.ts

- لا يستدعي Gemini مباشرة.
- لا يفعل IR validation.
- لا يستدعي `lib/content/personas/semanticConstraints.ts` (I1 frozen).
- لا يُعدّل session count (ذلك مسؤولية Edge Function عبر RPC).
- لا يُعيد تشغيل Pipeline A أو يُحيل إليه.

---

## 8. Shadow Mode — الإضافة المستقبلية (لم يُبنَ بعد)

عند تفعيل Shadow Mode، سيكون `app/api/generate/route.ts` هو من يُشغّل B بالتوازي، وليس `/api/planner`. هذا خارج نطاق PHASE 2 ويستلزم قرار منتج منفصل.

```
[FUTURE — NOT IN PHASE 2]
POST /api/generate
  ├── → supabase/functions/generate (Pipeline A) → user response
  └── → supabase/functions/planner  (Pipeline B) → async evaluation
```
