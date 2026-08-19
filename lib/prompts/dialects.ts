// ---------------------------------------------------------------------------
// Dialect Rules — composable prompt layers for each Arabic style
// ---------------------------------------------------------------------------

import type { ArabicStyle } from "@/types/content";

export interface DialectRule {
  label: string;
  systemInstructions: string;
}

const dialectRules: Record<ArabicStyle, DialectRule> = {
  saudi_marketing: {
    label: "سعودي تسويقي",
    systemInstructions: `
## قواعد اللهجة السعودية التسويقية

STRICT RULE: Use modern Saudi slang (e.g., رهيب، يفوز، صدقني، لا يفوتك). Keep the tone energetic.
- اكتب بلهجة سعودية معاصرة دارجة في وسائل التواصل الاجتماعي.
- استخدم كلمات شائعة تعكس الحماس والتشويق.
- تجنب الفصحى الجافة.
- اجعل النبرة حيوية، مقنعة، وقريبة من القلب.
`.trim(),
  },

  gulf_premium: {
    label: "خليجي فخم",
    systemInstructions: `
## قواعد الأسلوب الخليجي الفخم

STRICT RULE: Use luxurious Gulf terms (e.g., فخامة، يالغالي، حياكم، كشخة). Tone must be exclusive.
- اكتب بعربية خليجية راقية جداً.
- استخدم مصطلحات تعكس الجودة العالية، الفخامة، والتميز.
- النبرة يجب أن تكون حصرية، موجهة لعملاء يبحثون عن الأفضل.
- تجنب اللهجة المبتذلة أو العامية الزائدة.
`.trim(),
  },

  egyptian_colloquial: {
    label: "مصري دارج",
    systemInstructions: `
## قواعد اللهجة المصرية الدارجة

- اكتب بالعربية المصرية الطبيعية (عامية مصرية).
- استخدم تعبيرات مصرية محكية حيثما يكون ذلك مناسبًا (زي: عشان، بجد، دلوقتي، مش بس كده).
- حافظ على نبرة ودّية ومرحة.
- الهدف: كتابة تبدو كأنها من كاتب إعلانات مصري محترف.
`.trim(),
  },

  white_arabic: {
    label: "عربية بيضاء",
    systemInstructions: `
## قواعد العربية البيضاء

- اكتب بعربية معاصرة محايدة مفهومة في جميع الأسواق العربية.
- لا تميل لأي لهجة محلية محددة.
- اجعل الأسلوب عصريًا واحترافيًا دون تكلف.
- يجب أن يكون مناسبًا لأي علامة تجارية عربية.
`.trim(),
  },

  formal_b2b: {
    label: "فصحى رسمية",
    systemInstructions: `
## قواعد الأسلوب الفصيح B2B

- اكتب بالعربية الفصحى الرسمية (Modern Standard Arabic).
- اجعل الأسلوب أنيقًا واحترافيًا ومقنعًا.
- استخدم مصطلحات أعمال وتسويق معاصرة.
- تجنب العامية تماماً.
`.trim(),
  },
};

export function getDialectRule(style: ArabicStyle): DialectRule {
  return dialectRules[style];
}

export function getAllDialectRules(): Record<ArabicStyle, DialectRule> {
  return dialectRules;
}
