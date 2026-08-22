import { ContentStyleDefinition } from "@/types/content";

export const cinematicStyle: ContentStyleDefinition = {
  id: "cinematic",
  name: "المشهدية والسينمائية",
  description: "يعتمد على تقطيع المشاهد السريع والتركيز على التفاصيل البصرية والصوتية لنقل القارئ إلى قلب التجربة",
  characteristics: [
    "جمل قصيرة ذات إيقاع نبضي",
    "توجيه انتباه القارئ لحركة المشهد",
    "ترك مساحات للتأمل بين الأسطر",
  ],
  structure: [
    "لقطة مقربة (Close-up) لبدء الإثارة",
    "تتابع سريع للأحداث أو الأفكار",
    "لقطة ختامية واسعة ذات أثر دائم",
  ],
  rhetoricalDevices: [
    "التجسيد البصري",
    "الإيقاع النبضي للجمل",
    "الصمت التعبيري (White Space)",
  ],
  avoid: [
    "الشرح التقريري الجاف",
    "الجمل الطويلة المتشابكة",
  ],
  enabled: true,
};
