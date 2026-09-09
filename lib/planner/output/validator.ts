import type { GeneratedContent } from "../../../types/content.ts";
import type { PlannerRequestDTO } from "../validation.ts";

export type ValidationSeverity = "hard" | "soft";

export type ValidationCode =
  | "LENGTH_EXCEEDED"
  | "MISSING_FIELD"
  | "HALLUCINATED_CLAIM"
  | "CLICHE_DENSITY"
  | "FORBIDDEN_TERM"
  | "FORMATTING_ARTIFACT"
  | "PLATFORM_FIT"
  | "OBJECTIVE_MISMATCH"
  | "CTA_MISMATCH"
  | "PERSONA_DRIFT";

export interface ValidationSignal {
  code: ValidationCode;
  reason: string;
  severity: ValidationSeverity;
  repair_strategy: string;
  attempt: number;
}

export interface ValidationResult {
  passed: boolean;
  signals: ValidationSignal[];
}

function extractNumbers(text: string): string[] {
  const numberRegex = /\d+|[\u0660-\u0669]+/g;
  const matches = text.match(numberRegex);
  return matches ? matches : [];
}

function normalizeArabicText(text: string): string {
  return text
    .normalize("NFKC")
    .replace(/[أإآٱ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/ؤ/g, "و")
    .replace(/ئ/g, "ي")
    .replace(/ـ/g, "")
    .toLowerCase()
    .trim();
}

// Cliché patterns to detect instead of just exact matches
const CLICHE_PATTERNS = [
  "لا مثيل", "لا تنسى", "لا تنسي", "عالم من", "رحلة", "نافذة على",
  "تجربة غامرة", "خيوط الشمس", "فراشة", "شرنقة", "ابتسامة العالم",
  "حلم اصبح حقيقه", "فرصه متتفوتش", "لا تفوت", "ده مش حلم", "اكتشف الان"
];

export function validateRenderedContent(
  content: GeneratedContent,
  request: PlannerRequestDTO,
  effectiveMaxLength?: number,
  attempt: number = 0
): ValidationResult {
  const signals: ValidationSignal[] = [];

  const hashtagsText = content.hashtags.map(t => t.startsWith("#") ? t : `#${t}`).join(" ");
  const fullText = `${content.title} ${content.hook} ${content.body} ${content.callToAction} ${hashtagsText}`;
  const normalizedText = normalizeArabicText(fullText);

  // 1. Length Measurement (Soft)
  // LENGTH_EXCEEDED is a diagnostic signal only — it does NOT block the pipeline
  // or trigger a retry. The length is a property of the output for the user to see,
  // not a reason to re-call the LLM. The user can trim the post if needed.
  if (effectiveMaxLength && effectiveMaxLength > 0) {
    if (fullText.length > effectiveMaxLength) {
      signals.push({
        code: "LENGTH_EXCEEDED",
        reason: `تجاوز الحد الأقصى للطول: ${fullText.length} حرف (المسموح: ${effectiveMaxLength})`,
        severity: "soft",
        repair_strategy: "",
        attempt,
      });
    }
  }

  // 2. Missing/Empty Fields (Hard)
  if (!content.title || content.title.length < 3) {
    signals.push({ code: "MISSING_FIELD", reason: "العنوان مفقود أو قصير جداً", severity: "hard", repair_strategy: "أضف عنواناً واضحاً وجذاباً.", attempt });
  }
  if (!content.hook || content.hook.length < 5) {
    signals.push({ code: "MISSING_FIELD", reason: "الـ Hook مفقود أو قصير جداً", severity: "hard", repair_strategy: "أضف جملة افتتاحية قوية.", attempt });
  }
  if (!content.body || content.body.length < 10) {
    signals.push({ code: "MISSING_FIELD", reason: "المحتوى الرئيسي (body) مفقود أو قصير جداً", severity: "hard", repair_strategy: "وسع المحتوى الرئيسي ليكون أكثر إفادة.", attempt });
  }

  // 3. Fidelity (Hallucination of numbers) (Hard)
  const inputText = `${request.topic} ${request.audience || ""} ${request.constraints?.customInstructions || ""} ${request.constraints?.requiredTerms?.join(" ") || ""}`;
  const inputNumbers = new Set(extractNumbers(inputText));
  const outputNumbers = new Set(extractNumbers(fullText));
  
  const unexpectedNumbers: string[] = [];
  for (const num of outputNumbers) {
    if (!inputNumbers.has(num) && num.length > 1) { // ignore single digits which might be lists or rhetorical
      unexpectedNumbers.push(num);
    }
  }

  if (unexpectedNumbers.length > 0) {
    signals.push({
      code: "HALLUCINATED_CLAIM",
      reason: `اختراع أرقام أو بيانات غير موجودة في المصدر: ${unexpectedNumbers.join(", ")}`,
      severity: "hard",
      repair_strategy: `المحتوى احتوى على أرقام أو بيانات لم تكن في المدخلات (${unexpectedNumbers.join(", ")}). احذف هذه الأرقام المخترعة تماماً أو استبدلها بوصف عام. لا تخترع أي بيانات لم تذكر في النص الأصلي.`,
      attempt,
    });
  }

  // 4. Cliché Density (Soft/Hard)
  let clicheCount = 0;
  for (const pattern of CLICHE_PATTERNS) {
    if (normalizedText.includes(normalizeArabicText(pattern))) {
      clicheCount++;
    }
  }
  
  if (clicheCount >= 2) {
    signals.push({
      code: "CLICHE_DENSITY",
      reason: `كثافة عالية من الكليشيهات والعبارات الترويجية المستهلكة (${clicheCount} عبارات)`,
      severity: clicheCount >= 3 ? "hard" : "soft", // Reject if 3 or more
      repair_strategy: `المحتوى يعتمد بشكل كبير على الكليشيهات والعبارات المستهلكة أو الشاعرية. أعد الكتابة باستخدام لغة ملموسة، محددة، وواقعية. تجنب العبارات مثل "لا مثيل لها" أو "تجربة غامرة". استخدم تفاصيل حقيقية بدلًا من المبالغات.`,
      attempt,
    });
  }

  // 5. Forbidden Terms (Hard)
  if (request.constraints?.forbiddenTerms && request.constraints.forbiddenTerms.length > 0) {
    const found = request.constraints.forbiddenTerms.filter(term => 
      normalizedText.includes(normalizeArabicText(term))
    );
    if (found.length > 0) {
      signals.push({
        code: "FORBIDDEN_TERM",
        reason: `استخدام كلمات ممنوعة: ${found.join(", ")}`,
        severity: "hard",
        repair_strategy: `احذف الكلمات الممنوعة التالية تماماً: ${found.join(", ")}.`,
        attempt,
      });
    }
  }

  // 6. Formatting Artifacts (Hard)
  if (/<[a-z][^>]*>/i.test(fullText) || /\{"/.test(fullText)) {
    signals.push({
      code: "FORMATTING_ARTIFACT",
      reason: "المحتوى يحتوي على وسوم HTML أو بقايا JSON",
      severity: "hard",
      repair_strategy: "قم بإزالة جميع وسوم الـ HTML وأقواس الـ JSON من النصوص. يجب أن يكون النص مقروءاً بشكل طبيعي.",
      attempt,
    });
  }

  // ── Soft Diagnostic Signals ─────────────────────────────────────────────
  // These are always collected (even when hard failures exist) so the
  // failure taxonomy gives a complete picture. They never affect `passed`.

  // 7. Platform Fit (Soft)
  // For X: body with ≥2 double-newlines signals a multi-paragraph, long-form
  // structure better suited to LinkedIn/Facebook, not X's terse native style.
  if (request.platform === "x" && (content.body.match(/\n\n/g) || []).length >= 2) {
    signals.push({
      code: "PLATFORM_FIT",
      reason: "بنية المحتوى متعددة الفقرات لا تتناسب مع الطابع المركّز لمنصة X",
      severity: "soft",
      repair_strategy: "اجعل المحتوى أكثر تركيزاً وإيجازاً بما يتناسب مع طبيعة X.",
      attempt,
    });
  }

  // 8. Objective Mismatch (Soft)
  // Sales / leads / messages objectives expect a CTA that drives action.
  // A CTA that contains no directional action verb is a weak signal mismatch.
  const actionObjectives = new Set(["sales", "leads", "messages"]);
  if (actionObjectives.has(request.objective)) {
    const ctaNorm = normalizeArabicText(content.callToAction);
    // Arabic action verbs: تواصل، اشتر، احجز، سجّل، اطلب، اضغط، اكتشف، جرّب، ابدأ، اطلع
    const hasActionVerb = /تواصل|اشتر|احجز|سجل|اطلب|اضغط|اكتشف|جرب|ابدا|اطلع|تسجيل|شراء|حجز|طلب|buy|order|book|contact|click|register/i.test(ctaNorm);
    if (!hasActionVerb) {
      signals.push({
        code: "OBJECTIVE_MISMATCH",
        reason: `هدف "${request.objective}" يتطلب CTA تحريكياً، لكن النص لا يحتوي على فعل دعوة واضح`,
        severity: "soft",
        repair_strategy: "أضف فعل دعوة واضحاً في الـCTA يتناسب مع هدف التحويل.",
        attempt,
      });
    }
  }

  // 9. CTA Mismatch (Soft)
  // A generic filler question ("شاركنا رأيك", "ما رأيك؟") on conversion objectives
  // suggests the CTA has no contextual relationship to the product/topic.
  // NOTE: question CTAs are valid for awareness/engagement — we only flag on
  // objectives where action-driving CTAs are expected.
  if (actionObjectives.has(request.objective)) {
    const ctaNorm = normalizeArabicText(content.callToAction);
    const genericPatterns = [
      "ما رايك", "شاركنا رايك", "ما رايكم", "هل جربت", "كيف تري",
      "ما الذي تبحث", "ما هو راي", "شاركنا", "اخبرنا راي",
    ];
    const isGenericQuestion = genericPatterns.some(p => ctaNorm.includes(normalizeArabicText(p)));
    if (isGenericQuestion) {
      signals.push({
        code: "CTA_MISMATCH",
        reason: "الـCTA سؤال عام غير مرتبط بالمنتج أو الخدمة، لا يدفع نحو هدف التحويل",
        severity: "soft",
        repair_strategy: "استبدل السؤال العام بدعوة واضحة مرتبطة بالمنتج أو الخدمة.",
        attempt,
      });
    }
  }

  // 10. Persona Drift (Soft)
  // Creative persona should NOT use dry analytical structures (numbered lists,
  // percentage claims, data points). Intellectual persona should NOT use
  // pure hype/excitement language without a conceptual pivot.
  if (request.persona === "creative") {
    // Arabic/numeric list patterns: "1.", "٢.", "أولاً:", "ثانياً:" or bullet "- "
    const hasListStructure = /^\s*[\d١-٩]+[\.\)]/m.test(content.body) ||
      /^\s*[-–•]\s/m.test(content.body) ||
      /أولاً:|ثانياً:|ثالثاً:|أولا:|ثانيا:|أولًا:|ثانيًا:/i.test(content.body);
    // Percentage or statistic patterns
    const hasDataClaims = /\d+\s*%|دراسات? تشير|بحث يثبت|إحصاءات?|نسبة \d/i.test(content.body);
    if (hasListStructure || hasDataClaims) {
      signals.push({
        code: "PERSONA_DRIFT",
        reason: "شخصية 'إبداعية' لكن البنية تحليلية جافة (قوائم أو بيانات إحصائية)",
        severity: "soft",
        repair_strategy: "الشخصية الإبداعية تتطلب لغة استعارية وحيّة، تجنب القوائم والأرقام الإحصائية.",
        attempt,
      });
    }
  }

  // Check if any hard signals exist
  const passed = !signals.some(s => s.severity === "hard");

  return { passed, signals };
}
