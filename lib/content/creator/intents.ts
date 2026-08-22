import { CreatorIntent } from "@/types/creator";

export interface IntentDefinition {
  id: CreatorIntent;
  label: string;
  description: string;
  primaryObjective: string;
  openingPattern: string;
  pacingDirective: string;
  closingDirective: string;
  avoidDirective: string;
}

export const INTENT_DEFINITIONS: Record<CreatorIntent, IntentDefinition> = {
  insight: {
    id: "insight",
    label: "رؤية غير بديهية",
    description: "كشف حقيقة أو مبدأ خفي خلف ظاهرة مألوفة، وتغيير طريقة تفكير القارئ",
    primaryObjective: "تقديم زاوية فهم عميقة وغير مسبوقة تثير لحظة إدراك لدى القارئ",
    openingPattern: "ابدأ بملاحظة شاذة أو افتراض شائع ثم أظهر الثغرة فيه فوراً",
    pacingDirective: "تدرج من المألوف إلى المفاجأة ثم إلى المبدأ الجوهري",
    closingDirective: "اختم بخلاصة مركزة تترك القارئ ينظر للأمر بشكل مختلف",
    avoidDirective: "تجنب النصائح العامة والمباشرة التي يعلمها الجميع",
  },
  story: {
    id: "story",
    label: "سرد وتجربة",
    description: "نقل الفكرة عبر قصة حية أو موقف واقعي يحمل مغزى عميقاً",
    primaryObjective: "إشراك القارئ عاطفياً وذهنياً في تجربة حية واستخلاص درس بليغ",
    openingPattern: "ادخل فوراً في قلب المشهد أو الحدث بدون مقدمات تمهيدية",
    pacingDirective: "تسارع درامي مع تصاعد التحدي ثم لحظة تحول واضحة",
    closingDirective: "اختم بالحكمة أو الأثر الإنساني الباقي",
    avoidDirective: "تجنب الإسهاب في تفاصيل غير مؤثرة على جوهر الحدث",
  },
  opinion: {
    id: "opinion",
    label: "رأي وموقف صريح",
    description: "طرح وجهة نظر قوية وجريئة مدعومة بمنطق متماسك وحجج مقنعة",
    primaryObjective: "إعلان موقف فكري حاسم والدفاع عنه بمنطق محكم لا يقبل المواربة",
    openingPattern: "اطرح الحكم أو الرأي الجريء في السطر الأول بوضوح قاطع",
    pacingDirective: "حجة وراء حجة مع تفنيد الاعتراضات المسبقة",
    closingDirective: "دعوة صريحة للتأمل في منطق الموقف أو مناقشته",
    avoidDirective: "تجنب التردد والعبارات الرمادية أو الهجوم الشخصي",
  },
  observation: {
    id: "observation",
    label: "ملاحظة ذكية",
    description: "التقاط تفصيلة دقيقة من الحياة أو العمل يمر عليها الأغلب دون انتباه",
    primaryObjective: "إبراز نمط متكرر خفي في السلوك أو الأنظمة يستحق التوقف عنده",
    openingPattern: "صف المشهد أو السلوك اليومي العادي بدقة متناهية",
    pacingDirective: "تكبير التفصيلة (Zoom-in) وربطها بنظام أو قانون أوسع",
    closingDirective: "سؤال تأملي يفتح أفقاً جديداً للقارئ",
    avoidDirective: "تجنب الشكوى السطحية أو الملاحظات البديهية",
  },
  lesson: {
    id: "lesson",
    label: "درس مستفاد",
    description: "تحويل خطأ أو تجربة صعبة إلى خلاصة حكمة عملية متينة",
    primaryObjective: "نقل خلاصة ثمينة تحمي القارئ من نفس الخطأ أو تختصر عليه الطريق",
    openingPattern: "اذكر الثمن المدفوع أو الافتراض الخاطئ الذي قاد للتجربة",
    pacingDirective: "توضيح الخطأ ثم القاعدة الذهبية المستخلصة منه",
    closingDirective: "قاعدة تطبيقية موجزة قابلة للتنفيذ فوراً",
    avoidDirective: "تجنب نبرة الأستاذية أو التظاهر بعدم ارتكاب أخطاء",
  },
  question: {
    id: "question",
    label: "تساؤل وإشكالية",
    description: "طرح معضلة فكرية أو سؤال محير يستفز العقل ويدعو للنقاش العالي",
    primaryObjective: "خلخلة اليقينيات الزائفة وفتح مساحة تفكير مشتركة وراقية",
    openingPattern: "اطرح السؤال المحوري والمفارقة التي يستند إليها فوراً",
    pacingDirective: "استعراض وجهي المعضلة ولماذا الإجابة السريعة ليست سهلة",
    closingDirective: "توجيه السؤال للقارئ مع زاوية غير تقليدية للتفكير",
    avoidDirective: "تجنب الأسئلة البسيطة بنعم/لا أو الأسئلة الاستنكارية السطحية",
  },
  contrarian: {
    id: "contrarian",
    label: "تحدي السائد",
    description: "كسر المعتقدات الرائجة وإثبات أن الحقيقة غالباً في الاتجاه المعاكس",
    primaryObjective: "إثبات أن ما يفعله أو يعتقده الأغلب خاطئ أو غير مكتمل",
    openingPattern: "صرح بالخرافة الشائعة واهدمها فوراً بالحقيقة المضادة",
    pacingDirective: "كشف التناقضات بالأدلة والبراهين المنطقية الصارمة",
    closingDirective: "إعلان المعيار الجديد الذي ينبغي الاحتكام إليه",
    avoidDirective: "تجنب خالف تُعرف بدون دليل منطقي حقيقي",
  },
  reflection: {
    id: "reflection",
    label: "تأمل هادئ",
    description: "وقفة تأملية عميقة في مسار الحياة، العمل، المعنى، والنضج الداخلي",
    primaryObjective: "مشاركة حالة وعي وصفاء ذهني تعيد ترتيب أولويات القارئ",
    openingPattern: "بداية هادئة تسلط الضوء على شعور أو فكرة دفينة",
    pacingDirective: "إيقاع تأملي بطيء متزن يفسح مجالاً للقارئ ليتنفس المعنى",
    closingDirective: "عبارة وجدانية أو فكرية ذات صدى عميق وطويل",
    avoidDirective: "تجنب الصخب اللغوي أو الإثارة المفتعلة",
  },
  explainer: {
    id: "explainer",
    label: "تفكيك وتبسيط",
    description: "أخذ مفهوم معقد وتحليله بلغة سلسة وتشبيهات بديعة ترسخ في الذهن",
    primaryObjective: "جعل الصعب بدهياً والغامض واضحاً كالشمس دون تسطيح مخل",
    openingPattern: "عرف المشكلة أو المفهوم بتشبيه ذكي ملموس",
    pacingDirective: "تفكيك العناصر المعقدة خطوة بخطوة مع أمثلة حية",
    closingDirective: "تلخيص جوهر الفكرة في سطر واحد لا يُنسى",
    avoidDirective: "تجنب الغرق في المصطلحات التقنية غير المشروحة",
  },
  experiment: {
    id: "experiment",
    label: "تجربة واستنتاج",
    description: "مشاركة نتائج تجربة غير تقليدية (في العمل، العادات، الأفكار)",
    primaryObjective: "عرض فرضية تم اختبارها عملياً وما الذي أثبتته الأرقام أو النتائج",
    openingPattern: "ما هي الفرضية الغريبة التي تم اختبارها ولماذا؟",
    pacingDirective: "مراحل التجربة ← المفاجأة في النتائج ← الاستنتاج الواقعي",
    closingDirective: "ماذا يعني هذا لمن يريد خوض نفس التجربة؟",
    avoidDirective: "تجنب تقديم الاستنتاجات النظرية دون سند تجريبي",
  },
};

export function getIntentDefinition(intent: CreatorIntent): IntentDefinition {
  return INTENT_DEFINITIONS[intent] || INTENT_DEFINITIONS.insight;
}
