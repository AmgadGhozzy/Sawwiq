import { CreatorIntent, CreatorBlueprint, ContentBeat, OriginalityLevel } from "@/types/creator";
import { getIntentDefinition } from "./intents";

export interface BlueprintParams {
  intent: CreatorIntent;
  styleId?: string;
  topic: string;
  personaId?: string;
  originality?: OriginalityLevel;
  perspective?: string;
}

export function generateCreatorBlueprint({
  intent,
  styleId = "mystery",
  topic,
  personaId = "developer",
  originality = "balanced",
  perspective,
}: BlueprintParams): CreatorBlueprint {
  const intentDef = getIntentDefinition(intent);

  const progression: ContentBeat[] = [
    {
      index: 1,
      type: "hook",
      description: `${intentDef.openingPattern} — شد القارئ فوراً بجملة أولى قاطعة وبدون مقدمات.`,
    },
    {
      index: 2,
      type: "observation",
      description: `توضيح الموقف أو الظاهرة في الموضوع المطروح (${topic.slice(0, 80)}...) وإبراز المفارقة.`,
    },
    {
      index: 3,
      type: "tension",
      description: `تفكيك التعقيد أو السبب الخفي، ولماذا لا يعمل التفكير التقليدي في هذه الحالة.`,
    },
    {
      index: 4,
      type: "insight",
      description: `كشف الرؤية العميقة والمبدأ الجوهري من منظور الكاتب، مع صياغة لا تُنسى.`,
    },
    {
      index: 5,
      type: "takeaway",
      description: `${intentDef.closingDirective} — خاتمة ذات أثر ذهني يتردد صداه.`,
    },
  ];

  let hookStrategy = "افتتاحية كسر الافتراض الشائع أو ملاحظة مباغتة";
  if (styleId === "mystery") {
    hookStrategy = "ملاحظة غامضة أو مفارقة تطرح سؤالاً لا يمكن تجاهله";
  } else if (styleId === "contrarian") {
    hookStrategy = "إعلان صريح بأن الفكرة السائدة خاطئة والبديل الصادم هو الحقيقة";
  } else if (styleId === "storytelling") {
    hookStrategy = "الدخول فوراً في ذروة الموقف الحركي بدون تمهيد";
  } else if (styleId === "minimalist") {
    hookStrategy = "عبارة أولى مكثفة وقاطعة لا تتجاوز 7 كلمات";
  }

  let endingStrategy = "خاتمة استبصار تفتح أفقاً جديداً وتترك مساحة للقارئ ليتأمل";
  if (styleId === "contrarian") {
    endingStrategy = "معيار جديد يقلب طريقة تقييم الأمور رأساً على عقب";
  } else if (styleId === "minimalist") {
    endingStrategy = "سطر ختامي مكثف يحمل خلاصة الحكمة كالسهم";
  }

  const resolvedPerspective =
    perspective ||
    `التحدث من موقع الممارس الشغوف والمستبصر الخبير، وليس من برج عاجي أو كأستاذ نظري.`;

  return {
    hookStrategy,
    coreIdea: topic.trim(),
    perspective: resolvedPerspective,
    progression,
    emotionalArc: ["فضول واستهداف", "توتر واكتشاف", "إدراك واستنارة"],
    endingStrategy,
  };
}
