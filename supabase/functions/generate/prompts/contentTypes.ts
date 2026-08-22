export interface ContentTypeRule {
    systemInstructions: string;
    forbiddenClaims: string[];
}

export const CONTENT_TYPE_RULES: Record<string, ContentTypeRule> = {
    // Canonical V2 Types
    social_post: {
        forbiddenClaims: ["medical_claim", "guarantee", "financial_return"],
        systemInstructions: `OBJECTIVE: Generate interactive and thought-provoking content.
- اطرح فكرة أو زاوية نظر ذكية ومثيرة للاهتمام.
- شجع القارئ على التفكير وإبداء الرأي بشكل طبيعي.`,
    },

    advertisement: {
        forbiddenClaims: ["medical_claim", "guarantee"],
        systemInstructions: `FRAMEWORK: Use PAS (Problem-Agitate-Solution).
1. Problem: ابدأ بلمس مشكلة حقيقية وتلامس واقع العميل.
2. Agitate: ضخم أثرها العاطفي والعملي.
3. Solution: قدم المنتج/الخدمة كالحل المثالي والمباشر.`,
    },

    product_description: {
        forbiddenClaims: ["medical_claim", "guarantee"],
        systemInstructions: `OBJECTIVE: Transform product features into tangible benefits.
- ركز على تجربة المستخدم والشعور عند الاقتناء بدلاً من سرد المواصفات.
- استخدم لغة حيوية تزيد من القيمة المدركة للمنتج.`,
    },

    real_estate_listing: {
        forbiddenClaims: ["medical_claim", "guarantee", "financial_return"],
        systemInstructions: `OBJECTIVE: Sell a lifestyle, not just walls.
- ركز على الموقع، المساحة، والخصوصية والراحة النفسية.
- استخدم كلمات تثير الخيال وترسم صورة ذهنية جذابة للعيش في هذا العقار.`,
    },

    video_script: {
        forbiddenClaims: ["medical_claim", "guarantee"],
        systemInstructions: `FORMAT REQUIREMENT: The body MUST be a numbered sequence of scenes.
Each scene MUST strictly follow this structure:
[Scene X — Ns]
[Visual] (Describe what the viewer sees, framing, action)
[Audio] (Spoken dialogue, voiceover, sound effects)
[Text] (On-screen text, if any)

PACING RULE: Audio text MUST match the visual time. Assume 2-3 words per second. Keep audio punchy and short.

SCENE STRUCTURE:
1. HOOK (0-3s): Start immediately. NO greetings. Create tension, surprise, or state a clear benefit. Visual and audio must synchronize for maximum impact.
2. VALUE (3-25s): Deliver 2-4 concrete points or story beats. Keep scenes visually distinct and fast-paced.
3. CTA (Final 3-5s): One clear, value-driven action.`,
    },

    email: {
        forbiddenClaims: ["medical_claim", "guarantee"],
        systemInstructions: `OBJECTIVE: Write a high-converting marketing email.
- Subject Line: ابدأ بعنوان يثير الفضول ويجبر المستلم على الفتح.
- Body: اجعل الرسالة شخصية، مباشرة، وكانك تراسل صديقاً.
- CTA: إجراء واحد واضح جداً ومقنع.`,
    },

    thread: {
        forbiddenClaims: ["medical_claim", "guarantee"],
        systemInstructions: `FORMAT REQUIREMENT: Create a cohesive, intellectually stimulating thread.
- Tweet 1 (Hook): The hook MUST be compelling enough to read the entire thread. Pose a paradox, a contrarian thought, or a high-value promise.
- Body Tweets: Each tweet MUST deliver concentrated value. No fluff. Maintain momentum and curiosity between tweets.
- Final Tweet: Conclude with a strong summary or a thought-provoking CTA.`,
    },

    carousel_copy: {
        forbiddenClaims: ["medical_claim", "guarantee"],
        systemInstructions: `FORMAT REQUIREMENT: Divide content into clear sequential slides (Slide 1, Slide 2, etc.).
- Slide 1 (Hook): شريحة العنوان للفت الانتباه الفوري.
- Middle Slides: قيمة مركزة، فكرة واحدة لكل شريحة.
- Final Slide: CTA واضح.`,
    },

    story_sequence: {
        forbiddenClaims: ["medical_claim", "guarantee"],
        systemInstructions: `OBJECTIVE: Create an engaging story sequence.
- نبرة عفوية، سريعة، وتفاعلية.
- المدخل: قصة أو معلومة خاطفة تشد الانتباه.
- الخاتمة: سؤال أو ملصق تفاعل (Poll/Question) في الشريحة الأخيرة.`,
    },

    ugc_script: {
        forbiddenClaims: ["medical_claim", "guarantee"],
        systemInstructions: `OBJECTIVE: Write a User-Generated Content (UGC) script.
TONE: Authentic, raw, and relatable. Not overly polished.
- التركيز على المعاناة السابقة (Pain point) والحل العملي (Solution) ببساطة وبدون تكلف إعلاني.
- يبدو وكأنه نصيحة من صديق لصديقه.`,
    },

    landing_page_copy: {
        forbiddenClaims: ["medical_claim", "guarantee"],
        systemInstructions: `OBJECTIVE: Write high-converting landing page copy.
- Headline: وضوح قاطع للقيمة والفوائد الرئيسية.
- Sub-headlines: عناوين فرعية مقنعة تقود القارئ.
- CTA: دعوة واضحة ومباشرة لاتخاذ القرار.`,
    },

    // Legacy V1 Aliases (for backward compatibility)
    sponsored_ad: {
        forbiddenClaims: ["medical_claim", "guarantee"],
        systemInstructions: `FRAMEWORK: Use PAS (Problem-Agitate-Solution).
1. Problem: ابدأ بلمس مشكلة حقيقية وتلامس واقع العميل.
2. Agitate: ضخم أثرها العاطفي والعملي.
3. Solution: قدم المنتج/الخدمة كالحل المثالي والمباشر.`,
    },

    interactive_post: {
        forbiddenClaims: ["medical_claim", "guarantee", "financial_return"],
        systemInstructions: `OBJECTIVE: Generate interactive and thought-provoking content.
- اطرح فكرة أو زاوية نظر ذكية ومثيرة للاهتمام.
- شجع القارئ على التفكير وإبداء الرأي بشكل طبيعي.`,
    },

    ecommerce_product: {
        forbiddenClaims: ["medical_claim", "guarantee"],
        systemInstructions: `OBJECTIVE: Transform product features into tangible benefits.
- ركز على تجربة المستخدم والشعور عند الاقتناء بدلاً من سرد المواصفات.
- استخدم لغة حيوية تزيد من القيمة المدركة للمنتج.`,
    },

    real_estate: {
        forbiddenClaims: ["medical_claim", "guarantee", "financial_return"],
        systemInstructions: `OBJECTIVE: Sell a lifestyle, not just walls.
- ركز على الموقع، المساحة، والخصوصية والراحة النفسية.
- استخدم كلمات تثير الخيال وترسم صورة ذهنية جذابة للعيش في هذا العقار.`,
    },

    short_video_script: {
        forbiddenClaims: ["medical_claim", "guarantee"],
        systemInstructions: `FORMAT REQUIREMENT: The body MUST be a numbered sequence of scenes.
Each scene MUST strictly follow this structure:
[Scene X — Ns]
[Visual] (Describe what the viewer sees, framing, action)
[Audio] (Spoken dialogue, voiceover, sound effects)
[Text] (On-screen text, if any)

PACING RULE: Audio text MUST match the visual time. Assume 2-3 words per second. Keep audio punchy and short.

SCENE STRUCTURE:
1. HOOK (0-3s): Start immediately. NO greetings. Create tension, surprise, or state a clear benefit. Visual and audio must synchronize for maximum impact.
2. VALUE (3-25s): Deliver 2-4 concrete points or story beats. Keep scenes visually distinct and fast-paced.
3. CTA (Final 3-5s): One clear, value-driven action.`,
    },

    marketing_email: {
        forbiddenClaims: ["medical_claim", "guarantee"],
        systemInstructions: `OBJECTIVE: Write a high-converting marketing email.
- Subject Line: ابدأ بعنوان يثير الفضول ويجبر المستلم على الفتح.
- Body: اجعل الرسالة شخصية، مباشرة، وكانك تراسل صديقاً.
- CTA: إجراء واحد واضح جداً ومقنع.`,
    },
};
