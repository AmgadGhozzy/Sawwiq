import { ContentStyleDefinition } from "@/types/content";

export const minimalistStyle: ContentStyleDefinition = {
  id: "minimalist",
  name: "الإيجاز المكثف والمباشر",
  description: "ينقي الفكرة من أي حشو لغوي، ويقدم المعنى الصافي بكلمات قليلة جداً وقوية التأثير",
  characteristics: [
    "كل كلمة تحمل وزناً حقيقياً",
    "حذف كل ما هو زائد أو توضيحي فائض",
    "وضوح قاطع يرسخ في الذهن",
  ],
  structure: [
    "عبارة أولى قاطعة",
    "نقطتان أو ثلاث نقاط مركزة كالسهم",
    "خلاصة مكثفة لا تتجاوز بضع كلمات",
  ],
  rhetoricalDevices: [
    "الإيجاز البليغ (Conciseness)",
    "التوازي اللفظي",
    "التركيز على الفكرة الجوهرية",
  ],
  avoid: [
    "الحشو، المقدمات، وجمل المجاملات",
    "الغموض الناتج عن قلة الوضوح",
  ],
  enabled: true,
};
