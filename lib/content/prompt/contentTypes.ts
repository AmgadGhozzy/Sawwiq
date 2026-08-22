export interface ContentTypeRule {
  systemInstructions: string;
  forbiddenClaims: string[];
}

export const CONTENT_TYPE_RULES: Record<string, ContentTypeRule> = {
  // Canonical V2 Types
  social_post: {
    forbiddenClaims: ["medical_claim", "guarantee", "financial_return"],
    systemInstructions: `## قواعد المنشور التفاعلي
- الهدف: توليد تفاعل وتأمل ومشاركات.
- اطرح فكرة أو زاوية نظر ذكية ومثيرة للاهتمام.
- شجع القارئ على التفكير وإبداء الرأي.`,
  },

  advertisement: {
    forbiddenClaims: ["medical_claim", "guarantee"],
    systemInstructions: `## قواعد الإعلان التسويقي
STRICT RULE: Use PAS (Problem-Agitate-Solution) framework. Focus on psychological triggers.
- Problem: ابدأ بلمس مشكلة حقيقية.
- Agitate: ضخم أثرها العاطفي والعملي.
- Solution: قدم المنتج/الخدمة كالحل المثالي.`,
  },

  product_description: {
    forbiddenClaims: ["medical_claim", "guarantee"],
    systemInstructions: `## قواعد وصف المنتج
- حوّل المواصفات إلى فوائد ملموسة.
- ركز على تجربة المستخدم والشعور عند الاقتناء.
- استخدم لغة تزيد من القيمة المدركة.`,
  },

  real_estate_listing: {
    forbiddenClaims: ["medical_claim", "guarantee", "financial_return"],
    systemInstructions: `## قواعد الوصف العقاري
- لا تبيع الجدران، بع أسلوب الحياة والراحة.
- ركز على الموقع، المساحة، والخصوصية.
- استخدم كلمات تثير الخيال.`,
  },

  video_script: {
    forbiddenClaims: ["medical_claim", "guarantee"],
    systemInstructions: `## قواعد سكريبت الفيديو
STRICT FORMAT:
The body MUST be a numbered sequence of scenes.

Each scene MUST contain:
[Scene X — Ns]
[Visual] What the viewer sees, including framing, movement, product/action and transitions.
[Audio] Spoken dialogue, voiceover, natural sound, or music direction.
[On-screen text] Optional text overlay.

### Structure
1. HOOK — 0–3s
- Start immediately. No greeting or slow introduction.
- Create curiosity, tension, surprise, or a clear benefit.
2. VALUE — 3–25s
- Deliver 2–4 concrete points, demonstrations, or story beats.
- Keep scenes short and visually distinct.
3. CTA — final 3–5s
- One clear value-driven action.`,
  },

  email: {
    forbiddenClaims: ["medical_claim", "guarantee"],
    systemInstructions: `## قواعد الرسالة التسويقية
- ابدأ بعنوان يجبر المستلم على الفتح.
- اجعل الرسالة شخصية ومباشرة.
- CTA واحد وواضح جداً.`,
  },

  thread: {
    forbiddenClaims: ["medical_claim", "guarantee"],
    systemInstructions: `## قواعد السلسلة (Thread)
- ابنِ سلسلة تدوينات متماسكة ومترابطة فكرياً.
- التغريدة الأولى (Hook) يجب أن تشد القارئ لقراءة السلسلة كاملة.
- كل نقطة تقدم فائدة واضحة ومكثفة دون حشو.`,
  },

  carousel_copy: {
    forbiddenClaims: ["medical_claim", "guarantee"],
    systemInstructions: `## قواعد محتوى الكاروسيل (الشرائح)
- قسّم المحتوى إلى شرائح واضحة ومتسلسلة (الشريحة 1، الشريحة 2...).
- شريحة العنوان للفت الانتباه، والشرائح التالية للقيمة المركزة.`,
  },

  story_sequence: {
    forbiddenClaims: ["medical_claim", "guarantee"],
    systemInstructions: `## قواعد تسلسل الستوري
- نبرة عفوية وتفاعلية سريعة ومباشرة.
- مدخل يشد الانتباه، قصة أو معلومة خاطفة، وسؤال أو تفاعل في النهاية.`,
  },

  ugc_script: {
    forbiddenClaims: ["medical_claim", "guarantee"],
    systemInstructions: `## قواعد سكريبت UGC
- نبرة طبيعية وصادقة تشبه تجربة شخصية واقعية.
- التركيز على المعاناة السابقة والحل العملي ببساطة وبدون تكلف إعلاني.`,
  },

  landing_page_copy: {
    forbiddenClaims: ["medical_claim", "guarantee"],
    systemInstructions: `## قواعد نص صفحة الهبوط
- وضوح قاطع للقيمة والفوائد.
- عناوين فرعية مقنعة ودعوة واضحة لاتخاذ القرار.`,
  },

  // Legacy V1 Aliases (for backward compatibility)
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
    systemInstructions: `## قواعد سكريبت الفيديو القصير
STRICT FORMAT:
The body MUST be a numbered sequence of scenes.

Each scene MUST contain:
[Scene X — Ns]
[Visual] What the viewer sees, including framing, movement, product/action and transitions.
[Audio] Spoken dialogue, voiceover, natural sound, or music direction.
[On-screen text] Optional text overlay.

### Structure
1. HOOK — 0–3s
- Start immediately. No greeting, introduction, or "today we're going to..."
- Create curiosity, tension, surprise, or a clear benefit.
- The first visual and spoken line should work together.

2. VALUE — 3–25s
- Deliver 2–4 concrete points, demonstrations, or story beats.
- Keep scenes short and visually distinct.
- Every scene must add new information or emotion.

3. CTA — final 3–5s
- One clear action.
- Match the CTA to the user's goal.`,
  },

  marketing_email: {
    forbiddenClaims: ["medical_claim", "guarantee"],
    systemInstructions: `## قواعد الرسالة التسويقية
- ابدأ بعنوان يجبر المستلم على الفتح.
- اجعل الرسالة شخصية قدر الإمكان.
- CTA واحد وواضح جداً.`,
  },
};
