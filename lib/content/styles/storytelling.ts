import { ContentStyleDefinition } from "@/types/content";

export const storytellingStyle: ContentStyleDefinition = {
  id: "storytelling",
  name: "السرد القصصي المشوق",
  description: "ينقل الفكرة عبر قصة حية وتفاصيل مكان وزمان وشخصيات لتوليد تفاعل عاطفي وذهني",
  characteristics: [
    "بداية مشهدية حركية",
    "صراع أو تحدٍ واضح",
    "عبرة ورسالة واضحة في الختام",
  ],
  structure: [
    "مدخل قصصي في قلب الحدث (In Media Res)",
    "تصاعد التحدي والمشاعر",
    "الانفراجة والحكمة المستخلصة",
  ],
  rhetoricalDevices: [
    "الوصف الحسي",
    "الحوار الداخلي أو القصير",
    "الإيقاع المتسارع",
  ],
  avoid: [
    "المقدمات التمهيدية الطويلة والمملة",
    "التفاصيل الجانبية غير المفيدة للحبكة",
  ],
  enabled: true,
};
