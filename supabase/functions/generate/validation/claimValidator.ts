import { CONTENT_TYPE_RULES } from "../prompts/contentTypes.ts";
import type { InputDTO, GeneratedContent } from "./schema.ts";

const CLAIM_PATTERNS: Record<string, string[]> = {
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

function findPattern(text: string, patterns: string[]): string | null {
  for (const p of patterns) {
    if (text.includes(p)) return p;
  }
  return null;
}

export function validateClaims(
  output: GeneratedContent,
  input: InputDTO
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
  const rule = CONTENT_TYPE_RULES[input.contentType];

  if (rule && rule.forbiddenClaims) {
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
  }

  // ----- 2. Structural hygiene -----

  if (/<[a-z][^>]*>/i.test(fullOutput)) {
    violations.push({
      field: "content",
      claim: "html",
      pattern: "<tag>",
      reason: "المحتوى يحتوي على عناصر HTML",
    });
  }

  if (/^#{1,6}\s/m.test(fullOutput) || /```/.test(fullOutput)) {
    violations.push({
      field: "content",
      claim: "markdown",
      pattern: "Markdown",
      reason: "المحتوى يحتوي على Markdown غير مطلوب",
    });
  }

  if (/\{"/.test(fullOutput) || /"\}/.test(fullOutput)) {
    violations.push({
      field: "content",
      claim: "json_artifact",
      pattern: "JSON",
      reason: "المحتوى يحتوي على بقايا JSON",
    });
  }

  const badHashtags = output.hashtags.filter((t) => t.includes("#"));
  if (badHashtags.length > 0) {
    violations.push({
      field: "hashtags",
      claim: "hashtag_format",
      pattern: "#",
      reason: `هاشتاغات تحتوي على #: ${badHashtags.join(", ")}`,
    });
  }

  if (input.contentType === "short_video_script") {
    const scenePattern = /\[Scene\s+(\d+)\s*[—–-]\s*(\d+)s?\]/gi;
    const matches = [...output.body.matchAll(scenePattern)];
    if (matches.length > 0) {
      // Index 2 is the duration capturing group
      const firstDuration = parseInt(matches[0][2], 10);
      if (firstDuration > 3) {
        violations.push({
          field: "body",
          claim: "video_hook",
          pattern: firstDuration.toString(),
          reason: `First scene is ${firstDuration}s (should be ≤3s for hook)`,
        });
      }
    } else {
       violations.push({
          field: "body",
          claim: "video_structure",
          pattern: "missing_scenes",
          reason: "No scenes found in the video script body.",
        });
    }
  }

  return {
    passed: violations.length === 0,
    violations,
  };
}
