// ---------------------------------------------------------------------------
// Content Type Rules — composable prompt layers for each content type
// ---------------------------------------------------------------------------

import type { ContentType, ClaimClass } from "@/types/content";

export interface ContentTypeRule {
  label: string;
  systemInstructions: string;
  forbiddenClaims: ClaimClass[];
}

const contentTypeRules: Record<ContentType, ContentTypeRule> = {
  sponsored_ad: {
    label: "إعلان ممول",
    forbiddenClaims: ["medical_claim", "guarantee"],
    systemInstructions: `
## قواعد الإعلان الممول (Sponsored Ad)

STRICT RULE: Use the PAS (Problem-Agitate-Solution) copywriting framework. Focus heavily on psychological triggers.
- **Problem**: ابدأ بلمس مشكلة أو احتياج حقيقي لدى العميل.
- **Agitate**: ضخم المشكلة أو أثرها العاطفي.
- **Solution**: قدم المنتج/الخدمة كالحل المثالي المنقذ.
- ركز على البيع بشكل غير مباشر من خلال إثارة الرغبة.
`.trim(),
  },

  interactive_post: {
    label: "بوست تفاعلي",
    forbiddenClaims: ["medical_claim", "guarantee", "financial_return"],
    systemInstructions: `
## قواعد البوست التفاعلي

- الهدف الأساسي هو توليد تفاعل (تعليقات، مشاركات، حفظ).
- اطرح سؤالاً مثيراً للاهتمام أو شارك معلومة غريبة.
- اجعل المحتوى خفيفاً وسهل الهضم.
- شجع القارئ على إبداء رأيه في التعليقات.
`.trim(),
  },

  ecommerce_product: {
    label: "وصف منتج لمتجر",
    forbiddenClaims: ["medical_claim", "guarantee"],
    systemInstructions: `
## قواعد وصف منتج متجر إلكتروني

- حوّل المواصفات إلى فوائد ملموسة.
- ركز على تجربة المستخدم والشعور الذي سيحصل عليه عند اقتناء المنتج.
- استخدم لغة تزيد من القيمة المدركة للمنتج.
`.trim(),
  },

  real_estate: {
    label: "وصف عقاري تسويقي",
    forbiddenClaims: ["medical_claim", "guarantee", "financial_return"],
    systemInstructions: `
## قواعد الوصف العقاري

- لا تبيع الجدران، بع أسلوب الحياة (Lifestyle).
- ركز على الموقع، المساحة، والراحة النفسية التي سيوفرها العقار.
- استخدم كلمات تثير الخيال (مثال: تخيل قهوتك الصباحية بإطلالة...).
`.trim(),
  },

  short_video_script: {
    label: "سكريبت فيديو قصير",
    forbiddenClaims: ["medical_claim", "guarantee"],
    systemInstructions: `
## قواعد سكريبت الفيديو

- قسّم النص ليتناسب مع وتيرة فيديو قصير.
- اهتم بالثواني الثلاث الأولى (الخطاف البصري والصوتي).
- اجعل الجمل قصيرة جداً لتناسب سرعة الإيقاع.
`.trim(),
  },

  marketing_email: {
    label: "رسالة تسويقية",
    forbiddenClaims: ["medical_claim", "guarantee"],
    systemInstructions: `
## قواعد الرسالة التسويقية (إيميل / واتساب)

- ابدأ بعنوان/افتتاحية تجبر المستلم على فتح الرسالة.
- اجعل الرسالة شخصية قدر الإمكان.
- ادخل في صلب الموضوع بسرعة.
- احرص على وجود Call To Action واحد وواضح جداً.
`.trim(),
  },
};

export function getContentTypeRule(type: ContentType): ContentTypeRule {
  return contentTypeRules[type];
}

export function getAllContentTypeRules(): Record<ContentType, ContentTypeRule> {
  return contentTypeRules;
}
