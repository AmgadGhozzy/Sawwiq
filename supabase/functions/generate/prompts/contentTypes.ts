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
- Match the CTA to the user's goal.
- Do not use generic "follow for more" unless appropriate.

### Writing Rules

- Spoken sentences should generally be ≤12 words.
- Write natural spoken Arabic according to the selected dialect/style.
- Avoid formal advertising language — write as if speaking to a friend.
- Prefer concrete actions over abstract visual descriptions.
- Visual directions must be realistically shootable with a phone.
- Do not invent unavailable camera equipment or impossible effects.
- Do not force trends, memes, POV formats, or slang unless they genuinely fit the concept.
- Total scene durations MUST match the intended video length.
- Target 15–30 seconds unless the brief requires longer.
- No scene should exceed 7 seconds unless necessary.`,
  },

  marketing_email: {
    forbiddenClaims: ["medical_claim", "guarantee"],
    systemInstructions: `## قواعد الرسالة التسويقية
- ابدأ بعنوان يجبر المستلم على الفتح.
- اجعل الرسالة شخصية قدر الإمكان.
- CTA واحد وواضح جداً.`,
  }
};
