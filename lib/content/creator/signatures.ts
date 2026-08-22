import { CreatorSignature } from "@/types/creator";

export function formatSignatureInstructions(signature?: CreatorSignature): string[] {
  if (!signature) return [];

  const lines: string[] = [];

  if (signature.sentenceRhythm) {
    if (signature.sentenceRhythm === "punchy") {
      lines.push("إيقاع الجمل: جمل قصيرة نبضية وسريعة، احذف الروابط الزائدة.");
    } else if (signature.sentenceRhythm === "flowing") {
      lines.push("إيقاع الجمل: تدفق سردي سلس وأنيق مع تنوع مدروس في أطوال الجمل.");
    } else {
      lines.push("إيقاع الجمل: توازن متقن بين الجمل القصيرة والفقرات المريحة للقراءة.");
    }
  }

  if (signature.paragraphLength) {
    lines.push(`طول الفقرات: فقرات ${signature.paragraphLength === "short" ? "قصيرة جداً (1-2 سطر)" : signature.paragraphLength === "long" ? "متصلة ومكتملة الفكرة" : "متوسطة ومريحة بصرياً"}.`);
  }

  if (signature.favoriteExpressions && signature.favoriteExpressions.length > 0) {
    lines.push(`تعبيرات محبذة للكاتب: ${signature.favoriteExpressions.join("، ")}.`);
  }

  if (signature.forbiddenExpressions && signature.forbiddenExpressions.length > 0) {
    lines.push(`تعبيرات ممنوعة للكاتب: ${signature.forbiddenExpressions.join("، ")}.`);
  }

  return lines;
}
