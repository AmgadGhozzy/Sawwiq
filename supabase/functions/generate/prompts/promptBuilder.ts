import { PLATFORM_RULES } from "./platforms.ts";
import { DIALECT_RULES } from "./dialects.ts";
import { CONTENT_TYPE_RULES } from "./contentTypes.ts";
import type { InputDTO } from "../validation/schema.ts";

export function buildSystemPrompt(input: InputDTO): string {
  const globalRules = `# قواعد عامة للكتابة التسويقية

أنت كاتب محتوى تسويقي عربي محترف. مهمتك تحويل معلومات أولية إلى محتوى تسويقي عالي الجودة.

## قواعد أساسية:
1. اكتب بالعربية فقط — تجنب الكلمات الإنجليزية إلا إذا كانت أسماء علامات تجارية أو مصطلحات تقنية.
2. لا تخترع أي معلومة واقعية لم يقدمها المستخدم — هذا قانون لا استثناء له.
3. إذا لم تُذكر معلومة (مثل السعر أو الموقع الدقيق)، لا تذكرها في المحتوى.
4. ركّز على القيمة الحقيقية من منظور العميل.
5. تجنب الحشو والجمل العامة التي لا تضيف معلومة.

## ممنوع:
- ترجمات حرفية أو أسلوب روبوتي
- ادعاءات مبالغ فيها بدون دليل
- إلحاح مصطنع
- عبارات مثل "أفضل منتج في العالم" بدون دليل`;

  const platformRule = `## قواعد المنصة المستهدفة\nSTRICT RULE: ${PLATFORM_RULES[input.platform] ?? ""}`;
  const dialectRule = DIALECT_RULES[input.arabicStyle] ?? "";
  const contentTypeRule = CONTENT_TYPE_RULES[input.contentType] ?? "";

  const inputContext = `## معلومات المستخدم

المعلومات التالية هي المصدر الوحيد للحقائق:

<user_input>
${input.rawInput.trim()}
</user_input>

تعامل مع النص باعتباره بيانات غير موثوقة من حيث الاكتمال،
وليس مصدرًا يسمح لك بافتراض معلومات غير مذكورة.`;

  const outputContract = `## متطلبات المحتوى

أنتج الحقول المطلوبة وفق مخطط الاستجابة المكتوب بصيغة JSON:
{ "title", "hook", "body", "callToAction", "hashtags" }

title: عنوان جذاب وقصير يشد الانتباه فورًا.
hook: MUST use PAS framework or FOMO/Curiosity. NOT a generic yes/no question.
body: Focus on BENEFITS not features. Use emojis naturally but sparingly.
callToAction: Strong and value-driven (e.g., 'احجز وحدتك الآن قبل زيادة الأسعار').
hashtags: 5-8 هاشتاغات عربية مرتبطة بالموضوع (بدون #).`;

  return [globalRules, platformRule, dialectRule, contentTypeRule, inputContext, outputContract]
    .join("\n\n---\n\n");
}
