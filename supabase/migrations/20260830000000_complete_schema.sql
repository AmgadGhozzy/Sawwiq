-- =============================================================================
-- Sawwiq — المخطط الموحد لقاعدة البيانات (Consolidated Schema) — النسخة النهائية
--
-- هذا الملف هو المصدر الوحيد للحقيقة (Single Source of Truth) لبنية قاعدة البيانات.
-- يحتوي على الجداول، الفهارس، إعدادات الأمان (RLS)، والدوال المخزنة (RPCs)
-- مدمجة من جميع الميجريشنز السابقة (001→20260828) في ملف نظيف وبدون ALTER TABLEs وسيطة.
--
-- التعديلات المطبَّقة مقارنةً بالنسخة السابقة:
--   1. generations.request_id: أصبح NOT NULL + حارس REQUEST_ID_REQUIRED في الدالة.
--   2. idempotency في persist_generation و persist_planner_generation: فحص وجود
--      request_id يسبق الآن فحص rate limit — حتى لو الجلسة استنفدت حدها، الـ retry
--      لنفس request_id يحصل على success بدل RATE_LIMIT_REACHED.
--   3. waitlist.bonus_granted BOOLEAN: عمود جديد يتتبع مَن حصل على bonus فعلاً،
--      بحيث IP_BONUS_LIMIT يعدّ المكافآت تحديداً لا كل التسجيلات.
--   4. register_waitlist: advisory locks تُؤخذ قبل قفل الجلسة بترتيب ثابت
--      (fingerprint → IP → session) لتفادي احتمالات deadlock عند التوسع.
--   5. حذف الفهارس المكررة: idx_sessions_token و idx_planner_runs_request_id
--      و idx_shadow_evals_request_id — الـ UNIQUE constraint أنشأها بالفعل.
--
-- ملاحظة تشغيلية: لو الجداول موجودة بالفعل في production، راجع قسم
-- "توجيهات الترحيل" في نهاية هذا الملف.
--
-- الترتيب:
--   1. دوال نظام مساعدة
--   2. الجداول الأساسية (Core Tables)
--   3. جداول Pipeline B والتحليلات
--   4. الفهارس (بدون مكررة)
--   5. إعدادات RLS
--   6. الدوال المخزنة (RPCs)
--   7. الصلاحيات (REVOKE / GRANT)
--   8. توجيهات الترحيل (تعليق — بدون تنفيذ تلقائي)
-- =============================================================================


-- =============================================================================
-- 1. دوال النظام المساعدة (System Utility Functions)
-- =============================================================================

-- دالة تُحدِّث حقل updated_at تلقائياً قبل كل عملية UPDATE على أي جدول مرتبط بها
-- تُستخدم عبر TRIGGER على جداول sessions و planner_budget
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;


-- =============================================================================
-- 2. الجداول الأساسية (Core Tables)
-- =============================================================================

-- ─── sessions ────────────────────────────────────────────────────────────────
-- يتتبع جلسات المستخدمين المجهولين (Anonymous Sessions).
-- كل جلسة تحمل حدها الخاص للتوليد (max_limit) وعداداً (generations_count).
-- البيانات مؤقتة: لا تُمثِّل مستخدمين حقيقيين.
CREATE TABLE IF NOT EXISTS sessions (
    id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
        -- المعرف الفريد للجلسة (UUID مولَّد تلقائياً)
    session_token     TEXT        UNIQUE NOT NULL,
        -- رمز الجلسة (Token) الفريد المستخدم للمصادقة من الطرف الخادم
        -- الـ UNIQUE constraint يُنشئ index تلقائياً — لا index منفصل هنا
    generations_count INTEGER     NOT NULL DEFAULT 0,
        -- عدد مرات التوليد الفعلية التي أجراها المستخدم في هذه الجلسة
    max_limit         INTEGER     NOT NULL DEFAULT 3,
        -- الحد الأقصى المسموح به للتوليدات في هذه الجلسة
        -- يرتفع بمقدار 1 عند تسجيل صاحب الجلسة في قائمة الانتظار (Waitlist Bonus)
    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        -- وقت إنشاء الجلسة
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
        -- وقت آخر تعديل (يُحدَّث تلقائياً عبر التريجر sessions_updated_at)
);

-- تريجر: يحدِّث updated_at تلقائياً عند كل UPDATE على sessions
CREATE OR REPLACE TRIGGER sessions_updated_at
    BEFORE UPDATE ON sessions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();


-- ─── generations ─────────────────────────────────────────────────────────────
-- سجل تاريخي لكل توليد محتوى أجرته Pipeline A (المسار الأول).
-- مرتبط بالجلسة ويُحذف تبعاً لها (CASCADE).
CREATE TABLE IF NOT EXISTS generations (
    id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
        -- المعرف الفريد للتوليد
    request_id   UUID        UNIQUE NOT NULL,
        -- معرف الطلب الأصلي — NOT NULL + UNIQUE لضمان Idempotency صارم
        -- UNIQUE constraint يُنشئ index تلقائياً — لا index منفصل هنا
        -- تفسير: UNIQUE على عمود Nullable في Postgres يسمح بأكثر من صف NULL
        -- لذا الـ NOT NULL ضروري لسدّ هذه الثغرة، مع فحص مماثل في الدالة.
    session_id   UUID        REFERENCES sessions(id) ON DELETE CASCADE,
        -- معرف الجلسة المالكة للتوليد؛ بحذف الجلسة تُحذف توليداتها
    prompt       TEXT        NOT NULL,
        -- النص المدخل من المستخدم (الموجِّه / Prompt)
    platform     TEXT        NOT NULL,
        -- المنصة المستهدفة (مثال: twitter, linkedin, instagram)
    content_type TEXT        NOT NULL,
        -- نوع المحتوى (مثال: post, caption, thread)
    arabic_style TEXT        NOT NULL,
        -- أسلوب اللغة العربية المطلوب (مثال: formal, casual, gulf)
    ai_response  JSONB       NOT NULL,
        -- استجابة الذكاء الاصطناعي الكاملة بصيغة JSON
    metadata     JSONB       NOT NULL DEFAULT '{}',
        -- بيانات وصفية إضافية (إصدار البرومبت، نموذج AI، مدة التنفيذ، إلخ)
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
        -- وقت إتمام التوليد
);


-- ─── waitlist ─────────────────────────────────────────────────────────────────
-- قائمة الانتظار لتسجيل المهتمين بالمنتج.
-- تحتوي على آليات لمكافأة المستخدمين الحقيقيين ومنع التسجيل الوهمي (Anti-Abuse).
CREATE TABLE IF NOT EXISTS waitlist (
    id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
        -- المعرف الفريد لسجل التسجيل
    session_id       UUID        REFERENCES sessions(id) ON DELETE SET NULL,
        -- الجلسة المرتبطة بالتسجيل؛ تصبح NULL إذا حُذفت الجلسة (لحفظ الإيميل)
    email            TEXT        UNIQUE NOT NULL,
        -- البريد الإلكتروني للمستخدم (فريد — يمنع التسجيل المتكرر)
        -- UNIQUE constraint يُنشئ index تلقائياً
    fingerprint_hash TEXT,
        -- بصمة المتصفح المُشفَّرة (Hash) — تُستخدم لاكتشاف التسجيل الوهمي المتعدد
        -- NULL إذا لم يكن المتصفح يدعم البصمة أو لم يُرسَل
    client_ip        TEXT,
        -- عنوان IP الخاص بالمستخدم — يُستخدم للحد من مكافآت الـ IP الواحد
        -- NULL إذا لم يكن متاحاً
    bonus_granted    BOOLEAN     NOT NULL DEFAULT FALSE,
        -- هل حصل هذا التسجيل على مكافأة (زيادة max_limit) أم لا؟
        -- [عمود جديد] يُستخدم لعدّ مكافآت الـ IP الفعلية بدقة:
        -- IP_BONUS_LIMIT يعدّ هذا العمود = TRUE فقط، لا كل التسجيلات
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
        -- وقت التسجيل في قائمة الانتظار
);


-- =============================================================================
-- 3. جداول Pipeline B والتحليلات (Pipeline B & Analytics Tables)
-- =============================================================================

-- ─── planner_budget ──────────────────────────────────────────────────────────
-- يتتبع الاستهلاك اليومي للطلبات والرموز (Tokens) الخاصة بـ Pipeline B.
-- صف واحد لكل يوم (budget_date = PRIMARY KEY) — يُحدَّث ذرياً عبر ON CONFLICT.
CREATE TABLE IF NOT EXISTS planner_budget (
    budget_date   DATE        PRIMARY KEY DEFAULT CURRENT_DATE,
        -- تاريخ اليوم — مفتاح أساسي يضمن صفاً واحداً لكل يوم
    request_count INTEGER     NOT NULL DEFAULT 0,
        -- عدد الطلبات المُجراة في هذا اليوم
    token_count   INTEGER     NOT NULL DEFAULT 0,
        -- إجمالي الرموز (Tokens) المستهلكة في هذا اليوم
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        -- وقت إنشاء السجل (أول طلب في اليوم)
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
        -- وقت آخر تحديث (يُحدَّث تلقائياً عبر التريجر planner_budget_updated_at)
);

-- تريجر: يحدِّث updated_at تلقائياً عند كل UPDATE على planner_budget
CREATE OR REPLACE TRIGGER planner_budget_updated_at
    BEFORE UPDATE ON planner_budget
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();


-- ─── planner_runs ─────────────────────────────────────────────────────────────
-- سجل تاريخي لكل تنفيذ لـ Pipeline B (المخطط / Planner).
-- يُستخدم للتحليل وقياس الأداء والمقارنة بين الإصدارات.
CREATE TABLE IF NOT EXISTS planner_runs (
    id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
        -- المعرف الفريد للتنفيذ
    request_id       UUID        UNIQUE NOT NULL,
        -- معرف الطلب — UNIQUE NOT NULL لضمان Idempotency ومنع التكرار
        -- UNIQUE constraint يُنشئ index تلقائياً — لا index منفصل هنا
    session_id       UUID        REFERENCES sessions(id) ON DELETE SET NULL,
        -- الجلسة المرتبطة؛ تصبح NULL إذا حُذفت الجلسة (لحفظ بيانات التحليل)
    persona          TEXT        NOT NULL,
        -- شخصية الكاتب أو نغمة المحتوى المستخدمة (مثال: entrepreneur, marketer)
    platform         TEXT        NOT NULL,
        -- المنصة المستهدفة (مثال: twitter, linkedin)
    objective        TEXT        NOT NULL,
        -- الهدف الرئيسي للمحتوى (مثال: awareness, engagement, conversion)
    ir_graph         JSONB       NOT NULL,
        -- الرسم البياني الوسيط (Intermediate Representation Graph) لخطة المحتوى
    rendered_content JSONB       NOT NULL,
        -- المحتوى النهائي المُصاغ وجاهز للعرض للمستخدم
    token_usage      JSONB       NOT NULL,
        -- تفاصيل استهلاك الرموز مقسَّمة على مراحل المسار (planner, compiler, renderer)
    latency_ms       INTEGER     NOT NULL,
        -- إجمالي زمن الاستجابة من بداية الطلب إلى نهايته بالميلي ثانية
    pipeline_version TEXT        NOT NULL,
        -- إصدار مسار Pipeline B المستخدم (مثال: "pipeline_b_v1")
    status           TEXT        NOT NULL,
        -- حالة التنفيذ الإجمالية ('success' | 'partial_failure' | 'failure')
        -- Source of truth: مشتق من تقييمات المراحل في shadow_evaluations
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
        -- وقت إتمام التنفيذ
);


-- ─── shadow_evaluations ───────────────────────────────────────────────────────
-- يخزن نتائج التقييم الحتمي (Deterministic Evaluation) لكل تنفيذ لـ Pipeline B.
-- صف واحد لكل planner_run (على الأكثر) — يُحذف تبعاً له (CASCADE).
-- يُستخدم لمتابعة جودة المخطط ومراقبة انتهاكات القيود.
CREATE TABLE IF NOT EXISTS shadow_evaluations (
    id                 UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
        -- المعرف الفريد للتقييم
    request_id         UUID        UNIQUE NOT NULL
                                   REFERENCES planner_runs(request_id) ON DELETE CASCADE,
        -- ربط 1:1 مع planner_runs.request_id؛ بحذف التنفيذ يُحذف تقييمه
        -- UNIQUE constraint يُنشئ index تلقائياً — لا index منفصل هنا
    session_id         UUID        REFERENCES sessions(id) ON DELETE SET NULL,
        -- الجلسة المرتبطة — نسخة denormalized لتسريع استعلامات التحليل بدون JOIN
        -- تحذير: الاتساق مع planner_runs.session_id ضمان التطبيق لا DB
    planner_status     TEXT        NOT NULL,
        -- حالة مرحلة التخطيط ('success' | 'failure')
    compiler_status    TEXT        NOT NULL,
        -- حالة مرحلة التجميع والمعالجة ('success' | 'failure')
    renderer_status    TEXT        NOT NULL,
        -- حالة مرحلة الصياغة النهائية ('success' | 'failure')
        -- planner_runs.status يجب أن يكون مشتقاً من هذه الثلاثة في التطبيق
    failure_code       TEXT,
        -- كود الخطأ التفصيلي في حال الفشل (مثال: 'RENDERER_LENGTH_VIOLATION')
        -- NULL إذا كانت العملية ناجحة
    constraint_results JSONB       NOT NULL DEFAULT '{}',
        -- نتائج فحص قيود الجودة (طول المحتوى، اللغة، الهيكل، إلخ)
    execution_mode     TEXT        NOT NULL DEFAULT 'shadow',
        -- وضع التنفيذ: 'shadow' (مخفي للمقارنة) | 'primary' (موجَّه للمستخدم فعلياً)
    created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
        -- وقت إجراء التقييم
);


-- =============================================================================
-- 4. الفهارس (Indexes)
-- =============================================================================
-- ملاحظة: لا نُنشئ فهرساً لأي عمود عليه UNIQUE constraint — Postgres يُنشئ B-tree
-- index تلقائياً مع كل UNIQUE و PRIMARY KEY، وإضافة index آخر overhead بلا فائدة.
--
-- الفهارس المُنشأة تلقائياً (لا حاجة لتكرارها):
--   sessions.session_token (UNIQUE)
--   generations.request_id (UNIQUE)
--   waitlist.email (UNIQUE)
--   planner_runs.request_id (UNIQUE)
--   shadow_evaluations.request_id (UNIQUE)

-- generations: جلب تاريخ التوليد لجلسة محددة (FK لا unique constraint)
CREATE INDEX IF NOT EXISTS idx_generations_session
    ON generations(session_id);

-- waitlist: البحث عن تسجيل سابق بنفس البصمة (Fingerprint Anti-Abuse)
-- Partial Index: يُهمل الصفوف التي لا تحتوي على بصمة (NULL)
CREATE INDEX IF NOT EXISTS idx_waitlist_fingerprint
    ON waitlist(fingerprint_hash)
    WHERE fingerprint_hash IS NOT NULL;

-- waitlist: حساب عدد المكافآت الممنوحة من نفس الـ IP في نافذة زمنية
-- Partial Index: يُهمل الصفوف بدون IP، ويتضمن bonus_granted للفلترة السريعة
CREATE INDEX IF NOT EXISTS idx_waitlist_ip_bonus
    ON waitlist(client_ip, created_at)
    WHERE client_ip IS NOT NULL AND bonus_granted = TRUE;

-- planner_runs: جلب عمليات جلسة محددة للتحليل
CREATE INDEX IF NOT EXISTS idx_planner_runs_session_id
    ON planner_runs(session_id);

-- shadow_evaluations: جلب تقييمات جلسة محددة للتحليل
CREATE INDEX IF NOT EXISTS idx_shadow_evals_session_id
    ON shadow_evaluations(session_id);


-- =============================================================================
-- 5. أمان الصفوف (Row Level Security — RLS)
-- =============================================================================
-- تُفعَّل RLS على جميع الجداول لمنع الوصول المباشر بمفتاح anon.
-- لا توجد سياسات (Policies) للمستخدمين العاديين — الوصول حصري لـ service_role
-- الذي يُمرَّر عبر Edge Functions وRoute Handlers الخادمة.

ALTER TABLE sessions           ENABLE ROW LEVEL SECURITY;
ALTER TABLE generations        ENABLE ROW LEVEL SECURITY;
ALTER TABLE waitlist           ENABLE ROW LEVEL SECURITY;
ALTER TABLE planner_budget     ENABLE ROW LEVEL SECURITY;
ALTER TABLE planner_runs       ENABLE ROW LEVEL SECURITY;
ALTER TABLE shadow_evaluations ENABLE ROW LEVEL SECURITY;


-- =============================================================================
-- 6. الدوال المخزنة / RPCs (Stored Functions)
-- =============================================================================

-- ─── persist_generation ───────────────────────────────────────────────────────
-- دالة ذرية (Atomic) لحفظ توليد Pipeline A.
--
-- ترتيب العمليات داخل المعاملة:
--   0. رفض فوري إذا كان request_id فارغاً (REQUEST_ID_REQUIRED)
--   1. قفل صف الجلسة (FOR UPDATE) لمنع التضارب
--   2. التحقق من وجود الجلسة (SESSION_NOT_FOUND)
--   3. [مُقدَّم] فحص وجود request_id مسبقاً — قبل فحص rate limit
--      بحيث retry لطلب منتهٍ بالفعل يحصل على success حتى لو استُنفِد الحد
--   4. فحص rate limit (RATE_LIMIT_REACHED)
--   5. INSERT مع Idempotency Guard عبر UNIQUE(request_id)
--   6. زيادة عداد الجلسة بشكل ذري
CREATE OR REPLACE FUNCTION persist_generation(
    p_session_id   UUID,
    p_request_id   UUID,
    p_prompt       TEXT,
    p_platform     TEXT,
    p_content_type TEXT,
    p_arabic_style TEXT,
    p_ai_response  JSONB,
    p_metadata     JSONB DEFAULT '{}'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_count INTEGER;
    v_limit INTEGER;
BEGIN
    -- 0. فحص request_id أولاً — عمود NOT NULL + حارس في الدالة = طبقتا حماية
    IF p_request_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'REQUEST_ID_REQUIRED');
    END IF;

    -- 1. قفل صف الجلسة لمنع التضارب بين الطلبات المتزامنة
    SELECT generations_count, max_limit
    INTO v_count, v_limit
    FROM sessions
    WHERE id = p_session_id
    FOR UPDATE;

    -- 2. التحقق من وجود الجلسة
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'SESSION_NOT_FOUND');
    END IF;

    -- 3. [مُقدَّم] فحص Idempotency قبل rate limit
    --    مهم جداً: retry لطلب منتهٍ بالفعل يجب أن يحصل على success
    --    حتى لو الجلسة استنفدت حدها بعد ذلك
    IF EXISTS (SELECT 1 FROM generations WHERE request_id = p_request_id) THEN
        RETURN jsonb_build_object('success', true, 'remainingGenerations', v_limit - v_count);
    END IF;

    -- 4. فحص rate limit (بعد التأكد أن الطلب لم يُعالَج مسبقاً)
    IF v_count >= v_limit THEN
        RETURN jsonb_build_object('success', false, 'error', 'RATE_LIMIT_REACHED');
    END IF;

    -- 5. الحفظ — unique_violation هنا race condition window ضيقة جداً
    --    لكن نتعامل معها بنفس منطق الـ idempotency
    BEGIN
        INSERT INTO generations (
            session_id, request_id, prompt, platform, content_type, arabic_style, ai_response, metadata
        ) VALUES (
            p_session_id, p_request_id, p_prompt, p_platform, p_content_type,
            p_arabic_style, p_ai_response, COALESCE(p_metadata, '{}')
        );
    EXCEPTION WHEN unique_violation THEN
        RETURN jsonb_build_object('success', true, 'remainingGenerations', v_limit - v_count);
    END;

    -- 6. زيادة عداد التوليدات بشكل ذري
    UPDATE sessions
    SET generations_count = generations_count + 1
    WHERE id = p_session_id;

    RETURN jsonb_build_object('success', true, 'remainingGenerations', v_limit - (v_count + 1));
END;
$$;


-- ─── register_waitlist ────────────────────────────────────────────────────────
-- دالة ذرية لتسجيل مستخدم في قائمة الانتظار مع نظام حماية من الاستغلال.
--
-- منطق المكافأة (Bonus Logic):
--   • مكافأة = زيادة max_limit بمقدار 1 + تعيين bonus_granted = TRUE
--   • الشروط: جلسة صالحة + لم يُستنفَد الحد + بصمة جديدة + IP ضمن حد المكافآت
--
-- ترتيب الأقفال (ثابت لمنع deadlock عند التوسع):
--   1. advisory lock على fingerprint (pg_advisory_xact_lock)
--   2. advisory lock على IP
--   3. row lock على session (FOR UPDATE)
--   الترتيب الثابت يضمن عدم تعارض أقفال طلبات مختلفة على نفس الموارد
--
-- ملاحظة على hashtext: تستخدم مساحة 32-bit (احتمال تصادم منخفض لكن موجود)
-- للمشاريع ذات الحجم الكبير استخدم hashtextextended → bigint
--
-- ثوابت مضمَّنة في الكود (Server-side — غير قابلة للتلاعب من العميل):
--   MAX_BONUS_CAP         = 5   (الحد الأقصى لعدد المكافآت لكل جلسة)
--   IP_BONUS_LIMIT        = 3   (حد مكافآت الـ IP الفعلية في النافذة الزمنية)
--   IP_BONUS_WINDOW_HOURS = 24  (النافذة الزمنية للـ IP بالساعات)
CREATE OR REPLACE FUNCTION register_waitlist(
    p_email            TEXT,
    p_session_id       UUID,
    p_fingerprint_hash TEXT,
    p_client_ip        TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    -- ثوابت مكافحة الاستغلال — مُضمَّنة في الخادم ولا تُقبَل كمعاملات
    MAX_BONUS_CAP         CONSTANT INTEGER := 10;
    IP_BONUS_LIMIT        CONSTANT INTEGER := 3;
    IP_BONUS_WINDOW_HOURS CONSTANT INTEGER := 24;

    v_max_limit INTEGER;
    v_eligible  BOOLEAN := TRUE;
    v_reason    TEXT    := NULL;
    v_fp_exists BOOLEAN;
    v_ip_bonus_count INTEGER;
BEGIN
    -- ── حالة: لا توجد جلسة — تسجيل بدون مكافأة ──────────────────────────────
    IF p_session_id IS NULL THEN
        BEGIN
            INSERT INTO waitlist (email, fingerprint_hash, client_ip, bonus_granted)
            VALUES (p_email, p_fingerprint_hash, p_client_ip, FALSE);
        EXCEPTION WHEN unique_violation THEN
            RETURN jsonb_build_object('registered', false, 'bonus', false, 'reason', 'EMAIL_EXISTS');
        END;
        RETURN jsonb_build_object('registered', true, 'bonus', false, 'reason', 'NO_SESSION');
    END IF;

    -- ── [ترتيب جديد] أقفال Advisory أولاً — قبل قفل الجلسة ─────────────────
    -- الترتيب الثابت (fingerprint → IP) يمنع احتمالات deadlock عند التوسع
    -- بادئة 'fp:'/'ip:' لتفادي تصادم المساحات عند التجزئة
    IF p_fingerprint_hash IS NOT NULL THEN
        PERFORM pg_advisory_xact_lock(hashtext('fp:' || p_fingerprint_hash));
    END IF;
    IF p_client_ip IS NOT NULL THEN
        PERFORM pg_advisory_xact_lock(hashtext('ip:' || p_client_ip));
    END IF;

    -- ── قفل الجلسة (بعد الـ advisory locks) ─────────────────────────────────
    SELECT max_limit INTO v_max_limit
    FROM sessions WHERE id = p_session_id FOR UPDATE;

    IF NOT FOUND THEN
        BEGIN
            INSERT INTO waitlist (email, session_id, fingerprint_hash, client_ip, bonus_granted)
            VALUES (p_email, NULL, p_fingerprint_hash, p_client_ip, FALSE);
        EXCEPTION WHEN unique_violation THEN
            RETURN jsonb_build_object('registered', false, 'bonus', false, 'reason', 'EMAIL_EXISTS');
        END;
        RETURN jsonb_build_object('registered', true, 'bonus', false, 'reason', 'SESSION_NOT_FOUND');
    END IF;

    -- ── فحوصات مكافحة الاستغلال ──────────────────────────────────────────────

    -- 1. هل بلغت الجلسة الحد الأقصى للمكافآت؟
    IF v_max_limit >= MAX_BONUS_CAP THEN
        v_eligible := FALSE;
        v_reason   := 'CAP_REACHED';
    END IF;

    -- 2. هل البصمة مستخدمة في تسجيل حصل على مكافأة سابقاً؟
    --    (بعد الـ advisory lock — طلبات متزامنة بنفس البصمة مُسلسَلة الآن)
    IF v_eligible AND p_fingerprint_hash IS NOT NULL THEN
        SELECT EXISTS(
            SELECT 1 FROM waitlist
            WHERE fingerprint_hash = p_fingerprint_hash
            LIMIT 1
        ) INTO v_fp_exists;

        IF v_fp_exists THEN
            v_eligible := FALSE;
            v_reason   := 'FINGERPRINT';
        END IF;
    END IF;

    -- 3. هل تجاوز هذا الـ IP حده من المكافآت الفعلية (bonus_granted = TRUE) في آخر 24 ساعة؟
    --    [إصلاح] نعدّ المكافآت فعلاً لا كل التسجيلات — يتطابق مع الـ business rule
    IF v_eligible AND p_client_ip IS NOT NULL THEN
        SELECT COUNT(*) INTO v_ip_bonus_count
        FROM waitlist
        WHERE client_ip = p_client_ip
          AND bonus_granted = TRUE
          AND created_at > NOW() - (IP_BONUS_WINDOW_HOURS || ' hours')::INTERVAL;

        IF v_ip_bonus_count >= IP_BONUS_LIMIT THEN
            v_eligible := FALSE;
            v_reason   := 'IP_RATE';
        END IF;
    END IF;

    -- ── تسجيل الإيميل مع تحديد bonus_granted ────────────────────────────────
    BEGIN
        INSERT INTO waitlist (email, session_id, fingerprint_hash, client_ip, bonus_granted)
        VALUES (p_email, p_session_id, p_fingerprint_hash, p_client_ip, v_eligible);
    EXCEPTION WHEN unique_violation THEN
        RETURN jsonb_build_object('registered', false, 'bonus', false, 'reason', 'EMAIL_EXISTS');
    END;

    -- ── منح المكافأة إن كانت مستحقة ──────────────────────────────────────────
    IF v_eligible THEN
        UPDATE sessions SET max_limit = max_limit + 1 WHERE id = p_session_id;
        RETURN jsonb_build_object('registered', true, 'bonus', true, 'reason', NULL);
    END IF;

    RETURN jsonb_build_object('registered', true, 'bonus', false, 'reason', v_reason);
END;
$$;


-- ─── persist_planner_run ─────────────────────────────────────────────────────
-- دالة ذرية لحفظ تنفيذ Pipeline B مع تحديث ميزانية اليوم.
-- لا تتحقق من حدود الجلسة — مخصصة للطلبات الداخلية والـ Shadow Runs.
-- Idempotency: إذا كان request_id موجوداً مسبقاً، تُرجع duplicate=true وتتوقف.
CREATE OR REPLACE FUNCTION persist_planner_run(
    p_request_id       UUID,
    p_session_id       UUID,
    p_persona          TEXT,
    p_platform         TEXT,
    p_objective        TEXT,
    p_ir_graph         JSONB,
    p_rendered_content JSONB,
    p_token_usage      JSONB,
    p_latency_ms       INTEGER,
    p_pipeline_version TEXT,
    p_status           TEXT,
    p_total_tokens     INTEGER
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_budget_date DATE := CURRENT_DATE;
    v_inserted_id UUID;
BEGIN
    -- حفظ سجل التنفيذ — ON CONFLICT يمنع التكرار بدلاً من رفع خطأ
    INSERT INTO planner_runs (
        request_id, session_id, persona, platform, objective,
        ir_graph, rendered_content, token_usage, latency_ms,
        pipeline_version, status
    ) VALUES (
        p_request_id, p_session_id, p_persona, p_platform, p_objective,
        p_ir_graph, p_rendered_content, p_token_usage, p_latency_ms,
        p_pipeline_version, p_status
    )
    ON CONFLICT (request_id) DO NOTHING
    RETURNING id INTO v_inserted_id;

    -- إذا لم يُرجَع ID فالسجل كان موجوداً مسبقاً
    IF v_inserted_id IS NULL THEN
        RETURN jsonb_build_object('success', true, 'duplicate', true);
    END IF;

    -- تحديث ميزانية اليوم ذرياً (INSERT أو UPDATE في حال وجود السجل)
    INSERT INTO planner_budget (budget_date, request_count, token_count)
    VALUES (v_budget_date, 1, p_total_tokens)
    ON CONFLICT (budget_date) DO UPDATE
    SET request_count = planner_budget.request_count + 1,
        token_count   = planner_budget.token_count   + p_total_tokens;

    RETURN jsonb_build_object('success', true, 'duplicate', false);
END;
$$;


-- ─── persist_shadow_run ───────────────────────────────────────────────────────
-- دالة ذرية لحفظ تنفيذ Shadow (أو Primary) مع تقييمه في معاملة واحدة.
-- تحفظ سجلاً في planner_runs وسجلاً مقابلاً في shadow_evaluations.
-- p_execution_mode: 'shadow' (افتراضي) أو 'primary'
CREATE OR REPLACE FUNCTION persist_shadow_run(
    p_request_id       UUID,
    p_session_id       UUID,
    p_persona          TEXT,
    p_platform         TEXT,
    p_objective        TEXT,
    p_ir_graph         JSONB,
    p_rendered_content JSONB,
    p_token_usage      JSONB,
    p_latency_ms       INTEGER,
    p_pipeline_version TEXT,
    p_status           TEXT,
    p_total_tokens     INTEGER,
    p_planner_status   TEXT,
    p_compiler_status  TEXT,
    p_renderer_status  TEXT,
    p_failure_code     TEXT,
    p_constraint_res   JSONB,
    p_execution_mode   TEXT DEFAULT 'shadow'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_budget_date DATE := CURRENT_DATE;
    v_inserted_id UUID;
BEGIN
    -- 1. حفظ سجل التنفيذ في planner_runs
    INSERT INTO planner_runs (
        request_id, session_id, persona, platform, objective,
        ir_graph, rendered_content, token_usage, latency_ms,
        pipeline_version, status
    ) VALUES (
        p_request_id, p_session_id, p_persona, p_platform, p_objective,
        p_ir_graph, p_rendered_content, p_token_usage, p_latency_ms,
        p_pipeline_version, p_status
    )
    ON CONFLICT (request_id) DO NOTHING
    RETURNING id INTO v_inserted_id;

    -- إذا كان التنفيذ مُسجَّلاً مسبقاً — تجاهل بدون أي تعديل
    IF v_inserted_id IS NULL THEN
        RETURN jsonb_build_object('success', true, 'duplicate', true);
    END IF;

    -- 2. حفظ نتائج التقييم في shadow_evaluations
    INSERT INTO shadow_evaluations (
        request_id, session_id,
        planner_status, compiler_status, renderer_status,
        failure_code, constraint_results, execution_mode
    ) VALUES (
        p_request_id, p_session_id,
        p_planner_status, p_compiler_status, p_renderer_status,
        p_failure_code, p_constraint_res, COALESCE(p_execution_mode, 'shadow')
    );

    -- 3. تحديث ميزانية اليوم
    INSERT INTO planner_budget (budget_date, request_count, token_count)
    VALUES (v_budget_date, 1, p_total_tokens)
    ON CONFLICT (budget_date) DO UPDATE
    SET request_count = planner_budget.request_count + 1,
        token_count   = planner_budget.token_count   + p_total_tokens;

    RETURN jsonb_build_object('success', true, 'duplicate', false);
END;
$$;


-- ─── persist_planner_generation ───────────────────────────────────────────────
-- دالة ذرية لحفظ توليد Pipeline B عندما يعمل في الوضع الأساسي (Primary Mode).
-- تجمع كل ما تفعله persist_shadow_run + فحص حد الجلسة + زيادة عداد الجلسة.
--
-- ترتيب العمليات داخل المعاملة:
--   1. قفل الجلسة والتحقق من وجودها
--   2. [مُقدَّم] فحص وجود request_id قبل rate limit — نفس منطق persist_generation
--   3. فحص حد الاستخدام
--   4. حفظ planner_run مع Idempotency
--   5. حفظ shadow_evaluation بوضع 'primary'
--   6. تحديث الميزانية اليومية
--   7. زيادة عداد الجلسة
CREATE OR REPLACE FUNCTION persist_planner_generation(
    p_request_id       UUID,
    p_session_id       UUID,
    p_persona          TEXT,
    p_platform         TEXT,
    p_objective        TEXT,
    p_ir_graph         JSONB,
    p_rendered_content JSONB,
    p_token_usage      JSONB,
    p_latency_ms       INTEGER,
    p_pipeline_version TEXT,
    p_status           TEXT,
    p_total_tokens     INTEGER,
    p_planner_status   TEXT,
    p_compiler_status  TEXT,
    p_renderer_status  TEXT,
    p_failure_code     TEXT,
    p_constraint_res   JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_budget_date DATE := CURRENT_DATE;
    v_inserted_id UUID;
    v_count       INTEGER;
    v_limit       INTEGER;
BEGIN
    -- 1. قفل الجلسة لمنع التضارب
    SELECT generations_count, max_limit
    INTO v_count, v_limit
    FROM sessions WHERE id = p_session_id FOR UPDATE;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'SESSION_NOT_FOUND');
    END IF;

    -- 2. [مُقدَّم] فحص Idempotency قبل rate limit
    --    retry لطلب منتهٍ بالفعل يحصل على success حتى لو استُنفِد الحد
    IF EXISTS (SELECT 1 FROM planner_runs WHERE request_id = p_request_id) THEN
        RETURN jsonb_build_object(
            'success', true, 'duplicate', true, 'remainingGenerations', v_limit - v_count
        );
    END IF;

    -- 3. فحص حد الاستخدام (بعد التأكد أن الطلب لم يُعالَج مسبقاً)
    IF v_count >= v_limit THEN
        RETURN jsonb_build_object('success', false, 'error', 'RATE_LIMIT_REACHED');
    END IF;

    -- 4. حفظ سجل التنفيذ
    INSERT INTO planner_runs (
        request_id, session_id, persona, platform, objective,
        ir_graph, rendered_content, token_usage, latency_ms,
        pipeline_version, status
    ) VALUES (
        p_request_id, p_session_id, p_persona, p_platform, p_objective,
        p_ir_graph, p_rendered_content, p_token_usage, p_latency_ms,
        p_pipeline_version, p_status
    )
    ON CONFLICT (request_id) DO NOTHING
    RETURNING id INTO v_inserted_id;

    -- race condition window ضيقة جداً — نعاملها كـ duplicate
    IF v_inserted_id IS NULL THEN
        RETURN jsonb_build_object(
            'success', true, 'duplicate', true, 'remainingGenerations', v_limit - v_count
        );
    END IF;

    -- 5. حفظ التقييم بوضع 'primary'
    INSERT INTO shadow_evaluations (
        request_id, session_id,
        planner_status, compiler_status, renderer_status,
        failure_code, constraint_results, execution_mode
    ) VALUES (
        p_request_id, p_session_id,
        p_planner_status, p_compiler_status, p_renderer_status,
        p_failure_code, p_constraint_res, 'primary'
    );

    -- 6. تحديث ميزانية اليوم
    INSERT INTO planner_budget (budget_date, request_count, token_count)
    VALUES (v_budget_date, 1, p_total_tokens)
    ON CONFLICT (budget_date) DO UPDATE
    SET request_count = planner_budget.request_count + 1,
        token_count   = planner_budget.token_count   + p_total_tokens;

    -- 7. زيادة عداد الجلسة
    UPDATE sessions
    SET generations_count = generations_count + 1
    WHERE id = p_session_id;

    RETURN jsonb_build_object(
        'success', true, 'duplicate', false, 'remainingGenerations', v_limit - (v_count + 1)
    );
END;
$$;


-- =============================================================================
-- 7. الصلاحيات (REVOKE / GRANT)
-- =============================================================================
-- جميع دوال SECURITY DEFINER تعمل بصلاحيات مالكها (owner).
-- هذه الأوامر تمنع أي دور آخر (anon, authenticated, PUBLIC) من استدعائها مباشرة.
-- الاستدعاء الصحيح يكون حصراً عبر service_role من خادم Next.js أو Edge Functions.

REVOKE ALL ON FUNCTION persist_generation(UUID, UUID, TEXT, TEXT, TEXT, TEXT, JSONB, JSONB)
    FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION persist_generation(UUID, UUID, TEXT, TEXT, TEXT, TEXT, JSONB, JSONB)
    TO service_role;

REVOKE ALL ON FUNCTION register_waitlist(TEXT, UUID, TEXT, TEXT)
    FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION register_waitlist(TEXT, UUID, TEXT, TEXT)
    TO service_role;

REVOKE ALL ON FUNCTION persist_planner_run(UUID, UUID, TEXT, TEXT, TEXT, JSONB, JSONB, JSONB, INTEGER, TEXT, TEXT, INTEGER)
    FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION persist_planner_run(UUID, UUID, TEXT, TEXT, TEXT, JSONB, JSONB, JSONB, INTEGER, TEXT, TEXT, INTEGER)
    TO service_role;

REVOKE ALL ON FUNCTION persist_shadow_run(UUID, UUID, TEXT, TEXT, TEXT, JSONB, JSONB, JSONB, INTEGER, TEXT, TEXT, INTEGER, TEXT, TEXT, TEXT, TEXT, JSONB, TEXT)
    FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION persist_shadow_run(UUID, UUID, TEXT, TEXT, TEXT, JSONB, JSONB, JSONB, INTEGER, TEXT, TEXT, INTEGER, TEXT, TEXT, TEXT, TEXT, JSONB, TEXT)
    TO service_role;

REVOKE ALL ON FUNCTION persist_planner_generation(UUID, UUID, TEXT, TEXT, TEXT, JSONB, JSONB, JSONB, INTEGER, TEXT, TEXT, INTEGER, TEXT, TEXT, TEXT, TEXT, JSONB)
    FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION persist_planner_generation(UUID, UUID, TEXT, TEXT, TEXT, JSONB, JSONB, JSONB, INTEGER, TEXT, TEXT, INTEGER, TEXT, TEXT, TEXT, TEXT, JSONB)
    TO service_role;


-- =============================================================================
-- 8. توجيهات الترحيل لقاعدة بيانات حية (تعليق فقط — لا تنفيذ تلقائي)
-- =============================================================================
-- لو الجداول موجودة بالفعل في production، هذا الملف بكامله لن يُعدِّل البنية
-- الموجودة (CREATE TABLE IF NOT EXISTS و CREATE INDEX IF NOT EXISTS تتجاهل
-- الكائنات الموجودة). شغِّل الآتي يدوياً حسب الحالة:
--
-- ── أ. إضافة عمود bonus_granted إلى waitlist ──────────────────────────────
--   ALTER TABLE waitlist
--     ADD COLUMN IF NOT EXISTS bonus_granted BOOLEAN NOT NULL DEFAULT FALSE;
--
--   -- تحديث الفهرس (احذف القديم لو موجود وأنشئ الجديد)
--   DROP INDEX IF EXISTS idx_waitlist_ip_created;
--   CREATE INDEX IF NOT EXISTS idx_waitlist_ip_bonus
--       ON waitlist(client_ip, created_at)
--       WHERE client_ip IS NOT NULL AND bonus_granted = TRUE;
--
-- ── ب. تعديل generations.request_id إلى NOT NULL ─────────────────────────
--   -- تحقّق أولاً من عدم وجود صفوف بـ request_id = NULL:
--   SELECT COUNT(*) FROM generations WHERE request_id IS NULL;
--
--   -- لو النتيجة صفر، شغِّل:
--   ALTER TABLE generations ALTER COLUMN request_id SET NOT NULL;
--
--   -- لو فيه صفوف تاريخية بـ NULL لا يمكن تعبئتها:
--   UPDATE generations SET request_id = gen_random_uuid() WHERE request_id IS NULL;
--   ALTER TABLE generations ALTER COLUMN request_id SET NOT NULL;
--
-- ── ج. حذف الفهارس المكررة (لو أُنشئت بميجريشنز قديمة) ──────────────────
--   DROP INDEX IF EXISTS idx_sessions_token;
--   DROP INDEX IF EXISTS idx_planner_runs_request_id;
--   DROP INDEX IF EXISTS idx_shadow_evals_request_id;
--
-- ── د. بعد كل ما سبق، أعِد تطبيق الدوال في القسم 6 ─────────────────────
--   (شغِّل CREATE OR REPLACE FUNCTION لكل دالة من دوال القسم 6 فقط)
-- =============================================================================
