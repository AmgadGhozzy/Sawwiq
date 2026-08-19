export interface ContentTypeRule {
  systemInstructions: string;
  forbiddenClaims: string[];
}

export const CONTENT_TYPE_RULES: Record<string, ContentTypeRule> = {
  sponsored_ad: {
    forbiddenClaims: ["medical_claim", "guarantee"],
    systemInstructions: `## قواعد الإعلان الممول
STRICT RULE: Use PAS (Problem-Agitate-Solution) framework. Focus on psychological triggers.
- Problem: ابدأ بلمس مشكلة حقيقية.
- Agitate: ضخم أثرها العاطفي.
- Solution: قدم المنتج/الخدمة كالحل المثالي.`,
  },

  interactive_post: {
    forbiddenClaims: ["medical_claim", "guarantee", "financial_return"],
    systemInstructions: `## قواعد البوست التفاعلي
- الهدف: توليد تفاعل (تعليقات، مشاركات).
- اطرح سؤالاً مثيراً أو شارك معلومة غريبة.
- شجع القارئ على إبداء رأيه.`,
  },

  ecommerce_product: {
    forbiddenClaims: ["medical_claim", "guarantee"],
    systemInstructions: `## قواعد وصف المنتج
- حوّل المواصفات إلى فوائد ملموسة.
- ركز على تجربة المستخدم والشعور عند الاقتناء.
- استخدم لغة تزيد من القيمة المدركة.`,
  },

  real_estate: {
    forbiddenClaims: ["medical_claim", "guarantee", "financial_return"],
    systemInstructions: `## قواعد الوصف العقاري
- لا تبيع الجدران، بع أسلوب الحياة.
- ركز على الموقع، المساحة، والراحة النفسية.
- استخدم كلمات تثير الخيال.`,
  },

  short_video_script: {
    forbiddenClaims: ["medical_claim", "guarantee"],
    systemInstructions: `## قواعد سكريبت الفيديو
- قسّم النص ليتناسب مع وتيرة فيديو قصير.
- اهتم بالثواني الثلاث الأولى (الخطاف البصري والصوتي).
- اجعل الجمل قصيرة جداً.`,
  },

  marketing_email: {
    forbiddenClaims: ["medical_claim", "guarantee"],
    systemInstructions: `## قواعد الرسالة التسويقية
- ابدأ بعنوان يجبر المستلم على الفتح.
- اجعل الرسالة شخصية قدر الإمكان.
- CTA واحد وواضح جداً.`,
  }
};
