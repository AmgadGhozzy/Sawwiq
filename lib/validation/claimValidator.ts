// ---------------------------------------------------------------------------
// Claim Validator — post-generation content safety & structural hygiene
//
// Pipeline position:  LLM → Zod → **Claim Validator** → Response
//
// Production: blocking (throws on violation)
// Benchmark:  warning  (records violations, continues)
// ---------------------------------------------------------------------------

import type { GeneratedContent, GenerationInput } from "@/types/content";
import { getContentTypeRule } from "@/lib/prompts/contentTypes";

// ---------------------------------------------------------------------------
// Claim Patterns — Arabic keywords per claim category
//
// Each key maps to a list of patterns. If ANY pattern from a forbidden
// category appears in the output BUT NONE appear in the input, it's a
// violation. This is intentionally conservative: we only flag what we
// can detect with high confidence via substring matching.
// ---------------------------------------------------------------------------

import type { ClaimClass } from "@/types/content";

const CLAIM_PATTERNS: Record<ClaimClass, string[]> = {
  // Relational & Hallucination Prone
  comparison: [
    "أفضل من", "الأول في", "المركز الأول", "رقم واحد", "#1", "لا مثيل له", "مقارنة بـ", "يتفوق على",
  ],
  superiority: [
    "الأفضل", "الأقوى", "الأسرع", "الأفخم", "الوحيد", "فريد من نوعه",
  ],
  financial_return: [
    "عائد استثمار", "عوائد", "ROI", "ربح سنوي", "استثمار بعائد", "مربح", "يحقق أرباح",
  ],
  guarantee: [
    "مضمون", "نتيجة مؤكدة", "نتيجة أكيدة", "100%", "حتمًا", "نتائج مضمونة", "عائد مضمون", "لا مجال للشك",
  ],
  availability_scarcity: [
    "فرصة أخيرة", "الكمية محدودة", "باقي وحدات قليلة", "أوشك على النفاذ", "اغتنم الفرصة",
  ],
  quantified_claim: [
    "مضاعف", "مرات", "أضعاف", "بنسبة",
  ],
  location_distance: [
    "على بعد", "يبعد", "دقائق من", "كيلومتر من", "خطوات من", "مسافة قصيرة",
  ],
  specification: [
    "مصنوع من", "بمواصفات",
  ],

  // Standard
  price: [
    "سعر", "جنيه", "ريال", "درهم", "دولار", "التكلفة", "ثمن",
    "ج.م", "ر.س", "د.إ", "أسعار تناسب", "تناسب الميزانية",
  ],
  payment_plan: [
    "تقسيط", "أقساط", "قسط", "دفعة", "مقدم", "سداد", "خطط دفع", "تسهيلات دفع",
  ],
  legal_status: [
    "مرخص", "ترخيص", "سند ملكية", "صك",
  ],
  view: [
    "إطلالة", "فيو", "يطل على", "view",
  ],
  facilities: [
    "حمام سباحة", "مسبح", "جيم", "صالة رياضية", "نادي",
    "حديقة", "جراج", "موقف خاص", "أمن", "كاميرات",
  ],
  finishing: [
    "تشطيب", "سوبر لوكس", "لوكس", "نصف تشطيب", "على المحارة",
  ],
  medical_claim: [
    "يعالج", "يشفي", "علاج", "مثبت علميًا", "مثبت طبيًا",
    "سريريًا", "طبيًا",
  ],
  certification: [
    "معتمد من", "شهادة من", "حاصل على شهادة",
  ],
  discount: [
    "خصم", "تخفيض", "عرض حصري", "عرض خاص",
  ],
};

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ClaimViolation {
  field: string;
  claim: string;
  pattern: string;
  reason: string;
}

export interface ClaimValidationResult {
  passed: boolean;
  violations: ClaimViolation[];
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Returns the first matching pattern found in `text`, or null.
 */
function findPattern(text: string, patterns: string[]): string | null {
  for (const p of patterns) {
    if (text.includes(p)) return p;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Validate generated content against claim rules and structural hygiene.
 *
 * The validator is intentionally practical — not a regex monster that tries
 * to understand every possible Arabic phrasing. It catches the obvious,
 * high-confidence violations and leaves nuanced cases to the semantic
 * evaluator.
 */
export function validateClaims(
  output: GeneratedContent,
  input: GenerationInput
): ClaimValidationResult {
  const violations: ClaimViolation[] = [];

  const fullOutput = [
    output.title,
    output.hook,
    output.body,
    output.callToAction,
  ].join(" ");

  const userInput = input.rawInput;

  // ----- 1. Forbidden claims per content type -----
  const rule = getContentTypeRule(input.contentType);

  for (const claimType of rule.forbiddenClaims) {
    const patterns = CLAIM_PATTERNS[claimType];
    if (!patterns) continue;

    const matchedInOutput = findPattern(fullOutput, patterns);
    const mentionedInInput = findPattern(userInput, patterns);

    if (matchedInOutput && !mentionedInInput) {
      violations.push({
        field: "content",
        claim: claimType,
        pattern: matchedInOutput,
        reason: `ادعاء "${claimType}" موجود في المخرجات (طابق: "${matchedInOutput}") لكن غير مذكور في المدخلات`,
      });
    }
  }

  // ----- 2. Structural hygiene -----

  // HTML tags
  if (/<[a-z][^>]*>/i.test(fullOutput)) {
    violations.push({
      field: "content",
      claim: "html",
      pattern: "<tag>",
      reason: "المحتوى يحتوي على عناصر HTML",
    });
  }

  // Markdown headings or code blocks
  if (/^#{1,6}\s/m.test(fullOutput) || /```/.test(fullOutput)) {
    violations.push({
      field: "content",
      claim: "markdown",
      pattern: "Markdown",
      reason: "المحتوى يحتوي على Markdown غير مطلوب",
    });
  }

  // JSON artifacts leaking through
  if (/\{"/.test(fullOutput) || /"\}/.test(fullOutput)) {
    violations.push({
      field: "content",
      claim: "json_artifact",
      pattern: "JSON",
      reason: "المحتوى يحتوي على بقايا JSON",
    });
  }

  // Hashtags containing #
  const badHashtags = output.hashtags.filter((t) => t.includes("#"));
  if (badHashtags.length > 0) {
    violations.push({
      field: "hashtags",
      claim: "hashtag_format",
      pattern: "#",
      reason: `هاشتاغات تحتوي على #: ${badHashtags.join(", ")}`,
    });
  }

  return {
    passed: violations.length === 0,
    violations,
  };
}
