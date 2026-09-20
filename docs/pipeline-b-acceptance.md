# Pipeline B — Acceptance Criteria

**Version**: 1.0.0  
**Status**: DRAFT — pre-evaluation  
**Applies to**: Pipeline B internal alpha → production decision  

> [!IMPORTANT]
> هذا الملف يُحدَّد **قبل** رؤية أي نتائج A/B.
> تعديل الـthresholds بعد رؤية النتائج يُبطل صحة الـevaluation.
> أي تغيير في هذا الملف يستلزم commit منفصل مع تبرير صريح.

---

## 1. الهدف من Pipeline B

Pipeline B يثبت أن **Causal Planning → IR → Rendering** ينتج copy أفضل للمستخدم النهائي — ليس فقط أنه ينجح في benchmark داخلي.

المقياس الوحيد المقبول كدليل هو: **نتائج أفضل للمستخدم، قابلة للقياس، مقارنةً بـPipeline A على نفس المدخلات**.

---

## 2. Hard Gates (Blocking — يجب أن تُحقق جميعها)

هذه gates لا تُفاوَض. أي فشل فيها يوقف الانتقال إلى المرحلة التالية بغض النظر عن جودة المحتوى.

| Gate | Threshold | المصدر |
|---|---|---|
| Forbidden node violations | = 0 | `validateIRGraph()` |
| Topology compliance | 100% | `TOPOLOGY_REQUIRED` |
| I1 integrity | PASS | `npm run test:integrity` |
| C009 regression monitor | PASS (identity ≥ 80%) | `npm run test:regression` |
| Critical fact failures | = 0 | `factEvaluator` |
| IR version compliance | 100% match | `IR_SCHEMA_VERSION` |

> [!WARNING]
> **C009 PASS ≠ جودة Pipeline B.**
> C009 هو regression safety gate فقط — يثبت أن I1 لم يتدهور.
> جودة Pipeline B تُحسم حصرًا من evaluation Section 3 و4.

---

## 3. Product Quality Gates (Evidence Required)

يجب توفير دليل كمي على كل metric قبل قرار الإطلاق.

### 3a. Win-Rate (Blind A/B)

نفس المدخل → Pipeline A و Pipeline B → evaluator أعمى يختار الأفضل.

| Metric | Minimum | القرار |
|---|---|---|
| B win-rate (overall) | ≥ 60% | SHIP |
| B win-rate (overall) | 55% – 59.9% | ITERATE |
| B win-rate (overall) | < 55% بعد 300+ cases | REJECT |

**الشرط الإضافي — لا يُخفي الـaggregate فشلًا كارثيًا في segment:**

| Segment | الحد الأدنى المقبول |
|---|---|
| كل persona منفردة (developer, psychology, intellectual, creative) | B win-rate ≥ 50% |
| كل platform منفردة (linkedin, x, instagram) | B win-rate ≥ 50% |
| لا segment يجوز أن تنحدر بأكثر من 20 نقطة عن الـoverall A baseline | hard limit |

> [!CAUTION]
> إذا كان overall win-rate = 65% لكن psychology = 30%، هذا **ليس** SHIP.
> الـaggregate لا يُخفي فشلًا كارثيًا في segment.

### 3b. Quality Dimensions

تُقاس بـLLM evaluator (blind) على عينة الـ600 case:

| Metric | الوصف | Minimum |
|---|---|---|
| Persona fidelity | هل النص يشبه الـpersona؟ | B ≥ A score |
| Instruction adherence | هل نفّذ المطلوب؟ | ≥ 90% |
| Naturalness | هل يبدو ككتابة بشرية؟ | ≥ 70 / 100 |
| Topic fidelity | هل أجاب عن الموضوع؟ | ≥ 90% |
| Hallucination rate | اختراع معلومات | ≤ 2% |
| Platform fit | هل يناسب المنصة؟ | ≥ 80% |

### 3c. Human Evaluation (Stratified Sample)

- **الحجم**: 60 case من الـ600 (10%).
- **التوزيع**: 15 case لكل persona، موزعة على 3 platforms.
- **المهمة**: evaluator بشري يختار بين A وB (blind) ويُعطي تبريرًا.
- **الهدف**: التحقق أن الـLLM evaluator لا يُكرّس تحيزًا نحو الكلام المنمق.
- **الحد الأدنى للاتفاق**: human-LLM agreement ≥ 70% (إذا كان أقل يعني الـLLM evaluator نفسه غير موثوق).

---

## 4. Operational Gates

| Metric | Budget | Notes |
|---|---|---|
| P95 latency | ≤ 8,000 ms | Pipeline A baseline: ~3–4s. B يحتمل planner + renderer calls. |
| P50 latency | ≤ 5,000 ms | |
| Cost per request (tokens) | ≤ 2× Pipeline A | يُقاس بـactual token usage، لا تقديرات نظرية. |
| Non-429 error rate | ≤ 1% | |
| 429 rate | ≤ 5% | نفس key pool |
| Async evaluation overhead | لا يُضاف إلى latency المستخدم | Evaluation يجب أن يكون خارج critical path. |

---

## 5. Decision Rule

يُطبَّق بعد اكتمال الـ600 cases + 60 human evaluations.

```
SHIP B إذا:
  ALL hard_gates = PASS
  AND B overall win-rate ≥ 60%
  AND B win-rate لكل persona ≥ 50%
  AND B win-rate لكل platform ≥ 50%
  AND لا segment تنحدر > 20 نقطة عن baseline
  AND P95 latency ≤ 8,000 ms
  AND cost/request ≤ 2× Pipeline A
  AND non-429 error rate ≤ 1%

ITERATE إذا:
  ALL hard_gates = PASS
  AND (55% ≤ overall win-rate < 60%)
  أو (cost/request بين 2× و 2.5× مع win-rate ≥ 70%)
  → تحديد ما يجب تحسينه، ثم إعادة الـevaluation

REJECT B إذا:
  أي hard_gate = FAIL
  أو overall win-rate < 55% بعد 300+ cases
  أو أي persona win-rate < 35%
  أو P95 latency > 12,000 ms
```

---

## 6. Evaluation Dataset

```
50 topics × 4 personas × 3 platforms = 600 test cases

Human evaluation:
  60 cases (10% stratified):
    15 cases × 4 personas
    × 3 platforms (5 cases each)
```

الـtopics تُختار لتغطي:
- مجالات متنوعة (تقنية، نمط حياة، أعمال، تعليم)
- مستويات تعقيد مختلفة (بسيط، متوسط، معقد)
- موضوعات تحتمل psychology-adjacent framing (لاختبار contamination guard)

---

## 7. ما لا يكفي وحده كدليل

| ليس دليلًا كافيًا | السبب |
|---|---|
| IR Purity = 100% | لا يعني أن المحتوى مفيد للمستخدم |
| C009 PASS | regression safety gate فقط |
| EXP-015 results | أثبت جودة I1 كـartifact، لا جودة B كمنتج |
| LLM evaluator يفضّل B | قد يتحيز نحو الكلام المنمق — يجب human sample |
| "يبدو أفضل" | لا يُعدّ دليلًا. الأرقام تقرر. |

---

## 8. الإصدار والتغييرات

| الإصدار | التاريخ | التغيير |
|---|---|---|
| 1.0.0 | 2026-08-27 | النسخة الأولى — pre-evaluation |
