# Sawwiq Prompt Optimization Walkthrough

هذا الملف يوثق نظام تحسين البرومبتات والـ benchmark المضاف إلى المشروع. الهدف هو رفع جودة المحتوى فعليًا مع منع التحسن الشكلي الذي يأتي من تغيير الاختبارات أو تضخيم البرومبت.

## النسخة المرجعية

- `PROMPT_VERSION`: `1.1.0`
- `DATASET_VERSION`: `1.1.0`
- النموذج: `gemini-2.5-flash-lite`
- المزود: Vertex AI
- عدد حالات التقييم: 30
- الـ baseline البنيوي المعتمد: `25/30 = 83%`

لا يتغير `PROMPT_VERSION` أثناء التجارب. كل تجربة تأخذ معرفًا مستقلًا مثل `exp-001`، ولا نرفع النسخة إلا عند قبول التعديل.

## ما تمت إضافته

### قياس ميزانية البرومبت

`lib/evaluation/promptBudget.ts` يحتوي matrix من ست تركيبات تمثل المنصات واللهجات وأنواع المحتوى المهمة. لكل تركيبة يتم قياس طول البرومبت ومقارنته بالـ baseline.

- حد الزيادة: `+10%`
- يوجد اختبار يمنع تجاوز الحد.
- يتم عرض estimated token count لأن طول الأحرف ثابت وقابل لإعادة الإنتاج.

### بيانات التجربة والتوليد

كل benchmark report يسجل:

- `promptVersion` و`datasetVersion`
- `experimentId`
- النموذج وإعدادات `temperature` و`topP`
- latency لكل حالة
- استخدام tokens الذي يعيده Vertex عند توفره
- تقدير system prompt وdynamic user context لكل حالة
- النتيجة البنيوية والدلالية والمخرجات المحفوظة عند الطلب

### مجموعات الـ benchmark

`lib/evaluation/benchmarkGroups.ts` يقسم الحالات إلى:

| المجموعة | الحالات |
| --- | --- |
| Core Content | العقارات والمنتجات والمجموعات |
| Input Robustness | المدخلات الناقصة والفوضوية والمختلطة |
| Language | اختبارات اللهجات |
| Video | سكريبتات الفيديو |

التقرير يعرض نتيجة كل مجموعة، مما يمنع إخفاء تراجع مهم خلف تحسن الرقم الإجمالي.

### تحليل الإخفاقات

`lib/evaluation/benchmarkAnalysis.ts` ينشئ ملف تحليل بجانب كل report. يصنف الفشل إلى:

- `provider_error`: اتصال أو rate limit من المزود، وليس فشل برومبت.
- `fact_boundary`: ادعاء أو معلومة غير مدعومة.
- `required_information_preservation`: فقدان معلومة صريحة مطلوبة.
- `video_structure`: مخالفة بنية المشاهد.
- `evaluator_review`: حالة تحتاج مراجعة بشرية أو مراجعة توقع الاختبار.

الحالات التي تفشل في `mustContain` لا تغيّر البرومبت تلقائيًا؛ قد يكون الرقم أو الاسم صيغ بشكل مختلف عن expectation. لذلك تُعلّم للمراجعة البشرية أولًا.

### بوابة القبول

لا تُقبل تجربة مرشحة للإنتاج إذا ظهر أي من الآتي:

- regression جديد مقارنة بالـ baseline.
- claim violation جديد.
- انخفاض النتيجة البنيوية عن الـ baseline.
- انخفاض semantic average أو factuality أو hallucination safety عندما توجد مقارنة صالحة.
- تجاوز ميزانية البرومبت.
- فشل مزود أو تشغيل غير مكتمل.

## أوامر التشغيل

### إنشاء baseline جديد

استخدم هذا فقط بعد تشغيل كامل وناجح:

```powershell
npm run benchmark:baseline
```

يحفظ التقرير والمخرجات ويحدّث `scripts/benchmark-reports/baseline.json`. لن يستبدل baseline إذا كانت هناك أخطاء مزود أو لم تتوفر درجات دلالية.

### تشغيل تجربة مرشحة

```powershell
$env:PROMPT_EXPERIMENT_ID = "exp-001"
$env:BENCHMARK_MAX_RETRIES = "3"
npm run benchmark:candidate
```

الأمر يشغّل semantic evaluation والمقارنة مع baseline وحفظ المخرجات. تظهر `CLI Args` في البداية لتأكيد الإعدادات الفعلية.

### تشغيل deterministic فقط

```powershell
npm run benchmark
```

## التعامل مع 429

عند ظهور `429 RESOURCE_EXHAUSTED`، يعيد الـ runner المحاولة تلقائيًا بعد 2 ثم 4 ثم 8 ثوانٍ افتراضيًا. إذا استمر الفشل:

1. التقرير يسجل `generationError` و`providerFailureCount`.
2. تصبح `runComplete = false`.
3. لا تفسر النتيجة الإجمالية كجودة للبرومبت.
4. لا تستبدل baseline بهذا التقرير.

يمكن زيادة عدد المحاولات مؤقتًا:

```powershell
$env:BENCHMARK_MAX_RETRIES = "5"
```

## دورة التحسين الصحيحة

1. اقرأ ملف التحليل الناتج عن benchmark.
2. افصل أخطاء المزود عن أخطاء المحتوى.
3. راجع يدويًا حالات `mustContain` قبل اعتبارها مشكلة prompt.
4. اختر سببًا واحدًا إلى ثلاثة فقط.
5. عدّل أقرب طبقة مسؤولة: `Fact Boundary` أو `Input Context` أو `Output Contract` أو طبقة النوع أو اللهجة أو المنصة.
6. نفذ التجربة بمعرف جديد، مثل `exp-002`.
7. شغّل benchmark كاملًا وقارنه بالـ baseline.
8. ارفع `PROMPT_VERSION` فقط عند اجتياز بوابة القبول.

## أولوية التحسين التالية

قبل تعديل Video formatting، نراجع الحالات ذات حفظ المعلومات وحقائق المدخلات:

- `poor-02`: الرقم `3` مفقود؛ يجب فحص output لمعرفة هل ضاع فعلًا أم أعيدت صياغته.
- أي `mustNotContain` أو claim violation: الأولوية لـ `Fact Boundary`.
- حالات الفيديو لا نغير بنيتها لمجرد فشل واحد؛ نحدد أولًا هل المشكلة حفظ محتوى، أو صيغة مشاهد، أو rate limit.

## التحقق

بعد أي تعديل في الأدوات أو البرومبت:

```powershell
npm test
npx tsc --noEmit
```

فحص `npm run lint` موجود أيضًا، لكن قد يعرض مشكلات واجهة غير مرتبطة بنظام الـ benchmark ويجب فصلها عن قرار قبول البرومبت.
