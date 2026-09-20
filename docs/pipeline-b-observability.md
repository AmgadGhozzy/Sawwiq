# Pipeline B — Observability Contract

**Version**: 1.0.0  
**Status**: DESIGN — pre-implementation

> [!IMPORTANT]
> كل الـlogs structured JSON على `console.log`.
> لا API keys، لا prompt content، لا user content، لا stack traces في الـlogs.
> لا أسرار داخلية تُكشف في أي log event.

---

## 1. مبادئ الـObservability

1. **Structured only** — كل event هو JSON object، لا free-text logging.
2. **Pipeline-tagged** — كل event يحمل `"pipeline": "B"` للتمييز عن A في Supabase Logs.
3. **Request-scoped** — كل event يحمل `request_id` لتتبع رحلة request واحد.
4. **No secrets** — لا API keys، لا session tokens، لا prompts، لا user content.
5. **Async evaluation لا تُضاف إلى latency المستخدم** — تُطلق fire-and-forget بعد إرسال الـresponse.
6. **Cost accounting مدمج** — tokens مُسجَّلة في كل LLM event لحساب التكلفة لاحقًا.

---

## 2. Events المطلوبة

### 2a. `planner_request` (attempt-level)

يُصدَر عند **كل محاولة** Planner LLM call (بما في ذلك retries).

```json
{
  "event":           "planner_request",
  "pipeline":        "B",
  "pipeline_version": "B-1.0.0",
  "model":           "gemini-2.5-flash-lite",
  "key_pool_slot":   "PRIMARY",
  "request_id":      "uuid",
  "persona_id":      "developer",
  "platform":        "linkedin",
  "attempt":         1,
  "status":          "success",
  "retry":           false,
  "latency_ms":      1234,
  "timestamp":       "2026-08-27T17:00:00.000Z"
}
```

`status` قيم: `"success"` | `429` | `"timeout"` | `"error"`

---

### 2b. `planner_complete` (run-level)

يُصدَر **مرة واحدة** بعد انتهاء كل retries للـPlanner.

```json
{
  "event":           "planner_complete",
  "pipeline":        "B",
  "pipeline_version": "B-1.0.0",
  "model":           "gemini-2.5-flash-lite",
  "request_id":      "uuid",
  "persona_id":      "developer",
  "attempts":        1,
  "total_429":       0,
  "final_status":    "success",
  "total_latency_ms": 1234,
  "tokens": {
    "prompt_tokens":      450,
    "completion_tokens":  180,
    "total_tokens":       630,
    "thoughts_tokens":    0
  },
  "timestamp": "2026-08-27T17:00:00.000Z"
}
```

---

### 2c. `ir_compiled` (مرة واحدة)

يُصدَر بعد نجاح IR Compilation (قبل الـvalidation).

```json
{
  "event":        "ir_compiled",
  "pipeline":     "B",
  "request_id":   "uuid",
  "persona_id":   "developer",
  "node_count":   5,
  "edge_count":   4,
  "ir_version":   "1.0.0",
  "timestamp":    "2026-08-27T17:00:00.000Z"
}
```

لا يحتوي على node content — حجم الـlog يبقى ثابتًا.

---

### 2d. `ir_validation_result` (مرة واحدة)

يُصدَر بعد `validateIRGraph()`.

```json
{
  "event":       "ir_validation_result",
  "pipeline":    "B",
  "request_id":  "uuid",
  "persona_id":  "developer",
  "valid":       true,
  "issue_count": 0,
  "issue_codes": [],
  "timestamp":   "2026-08-27T17:00:00.000Z"
}
```

إذا فشل:

```json
{
  "event":       "ir_validation_result",
  "pipeline":    "B",
  "request_id":  "uuid",
  "persona_id":  "developer",
  "valid":       false,
  "issue_count": 2,
  "issue_codes": ["PLANNER_MISSING_NODES", "PLANNER_FORBIDDEN_NODE"],
  "timestamp":   "2026-08-27T17:00:00.000Z"
}
```

`issue_codes` فقط — لا `detail` (قد يحتوي على محتوى المستخدم).

---

### 2e. `renderer_request` (attempt-level)

نفس هيكل `planner_request` مع `"event": "renderer_request"`.

```json
{
  "event":           "renderer_request",
  "pipeline":        "B",
  "pipeline_version": "B-1.0.0",
  "model":           "gemini-2.5-flash-lite",
  "key_pool_slot":   "PRIMARY",
  "request_id":      "uuid",
  "persona_id":      "developer",
  "attempt":         1,
  "status":          "success",
  "retry":           false,
  "latency_ms":      980,
  "timestamp":       "2026-08-27T17:00:00.000Z"
}
```

---

### 2f. `renderer_complete` (run-level)

نفس هيكل `planner_complete` مع `"event": "renderer_complete"`.

```json
{
  "event":           "renderer_complete",
  "pipeline":        "B",
  "pipeline_version": "B-1.0.0",
  "model":           "gemini-2.5-flash-lite",
  "request_id":      "uuid",
  "persona_id":      "developer",
  "attempts":        1,
  "total_429":       0,
  "final_status":    "success",
  "total_latency_ms": 980,
  "tokens": {
    "prompt_tokens":     380,
    "completion_tokens": 210,
    "total_tokens":      590,
    "thoughts_tokens":   0
  },
  "timestamp": "2026-08-27T17:00:00.000Z"
}
```

---

### 2g. `pipeline_b_complete` (run-level — summary)

يُصدَر مرة واحدة بعد نجاح الـrequest الكامل. هذا هو مصدر بيانات Cost Accounting.

```json
{
  "event":             "pipeline_b_complete",
  "pipeline":          "B",
  "pipeline_version":  "B-1.0.0",
  "request_id":        "uuid",
  "persona_id":        "developer",
  "platform":          "linkedin",
  "final_status":      "success",
  "planner_latency_ms":  1234,
  "renderer_latency_ms": 980,
  "total_latency_ms":    2350,
  "planner_tokens_total": 630,
  "renderer_tokens_total": 590,
  "grand_total_tokens":   1220,
  "llm_call_count":        2,
  "timestamp":           "2026-08-27T17:00:00.000Z"
}
```

---

### 2h. `pipeline_b_error` (on failure)

يُصدَر عند أي فشل في الـpipeline.

```json
{
  "event":          "pipeline_b_error",
  "pipeline":       "B",
  "request_id":     "uuid",
  "error_code":     "PLANNER_INVALID_IR",
  "error_stage":    "ir_validation",
  "persona_id":     "developer",
  "timestamp":      "2026-08-27T17:00:00.000Z"
}
```

`error_stage` قيم: `"request_validation"` | `"session"` | `"planner"` | `"ir_compilation"` | `"ir_validation"` | `"renderer"` | `"output_validation"` | `"persistence"`

---

## 3. Cost Accounting

من `pipeline_b_complete` يمكن حساب لكل request:

```
cost_B = (planner_tokens_total + renderer_tokens_total) × token_price
latency_B = total_latency_ms
llm_calls_B = llm_call_count (= 2 دائمًا في الـhappy path)
```

مقارنة بـPipeline A (`llm_run_complete`):

```
cost_A = total_tokens × token_price
latency_A = total_latency_ms
llm_calls_A = 1
```

---

## 4. Async Evaluation Event

يُطلق fire-and-forget بعد إرسال الـresponse، على sample rate قابل للتهيئة (default: 5%).

```json
{
  "event":       "async_evaluation_triggered",
  "pipeline":    "B",
  "request_id":  "uuid",
  "persona_id":  "developer",
  "sample_rate": 0.05,
  "timestamp":   "2026-08-27T17:00:00.000Z"
}
```

**لا ينتظر** نتيجة الـevaluation. الـevaluation نفسه يُسجَّل منفصلًا في PHASE 4.

---

## 5. ما يُحظر في الـlogs

| محظور | السبب |
|---|---|
| API key كاملة أو جزئية | security |
| session token | security |
| محتوى الـprompt | privacy + حجم |
| محتوى الـIR nodes | privacy + حجم |
| محتوى الـRendered output | privacy + حجم |
| stack traces كاملة | internal exposure |
| معلومات المستخدم (topic, audience) | privacy |

---

## 6. Supabase Log Queries (للمراقبة)

بعد الـdeploy يمكن استعلام Supabase Logs هكذا:

```sql
-- معدل 429 في Pipeline B
SELECT COUNT(*) FROM logs
WHERE metadata->>'event' = 'planner_request'
  AND metadata->>'pipeline' = 'B'
  AND metadata->>'status' = '429';

-- متوسط التكلفة (tokens) لكل request ناجح
SELECT AVG((metadata->>'grand_total_tokens')::int)
FROM logs
WHERE metadata->>'event' = 'pipeline_b_complete'
  AND metadata->>'final_status' = 'success';

-- معدل فشل IR validation
SELECT COUNT(*) FROM logs
WHERE metadata->>'event' = 'ir_validation_result'
  AND metadata->>'valid' = 'false';
```
