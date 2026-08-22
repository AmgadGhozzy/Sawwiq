import { GeneratedContent, NormalizedGenerationConfig } from "@/types/content";

export interface CreatorEvaluationResult {
  personaAdherenceScore: number;
  styleAdherenceScore: number;
  genericnessScore: number;
  antiHallucinationScore: number;
  noEmojiScore: number;
  overallScore: number;
  clicheMatches: string[];
  hallucinationWarnings: string[];
  passed: boolean;
}

const CLICHE_PATTERNS = [
  "في عالمنا اليوم",
  "في عالمنا المتسارع",
  "لا يخفى على احد",
  "لا يخفى على أحد",
  "دعونا نتفق",
  "من الجدير بالذكر",
  "يلعب دورا هاما",
  "تلعب دورا كبيرا",
  "مما لا شك فيه",
  "في هذا المقال",
  "اليوم سنتحدث عن",
  "هل تساءلت يوما",
  "سر النجاح الذي لا يخبرك به احد",
];

const CREDENTIAL_HALLUCINATION_PATTERNS = [
  "بصفتي خبير",
  "خبرتي لاكثر من",
  "خبرتي لأكثر من",
  "عملت لسنوات في",
  "حصلت على شهادة",
  "درست في جامعة",
  "انا مؤسس شركة",
  "أنا مؤسس شركة",
];

const EMOJI_REGEX = /[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1F1E0}-\u{1F1FF}]/u;

export function evaluateCreatorOutput(
  output: GeneratedContent,
  config: NormalizedGenerationConfig
): CreatorEvaluationResult {
  const fullText = [output.title, output.hook, output.body, output.callToAction].join(" ");

  // 1. Cliche / Genericness Check (Higher score = less generic)
  const clicheMatches: string[] = [];
  for (const pattern of CLICHE_PATTERNS) {
    if (fullText.includes(pattern)) {
      clicheMatches.push(pattern);
    }
  }
  const genericnessScore = Math.max(0, 100 - clicheMatches.length * 25);

  // 2. Anti-Hallucination Credential Check
  const hallucinationWarnings: string[] = [];
  for (const pattern of CREDENTIAL_HALLUCINATION_PATTERNS) {
    if (fullText.includes(pattern)) {
      hallucinationWarnings.push(pattern);
    }
  }
  const antiHallucinationScore = Math.max(0, 100 - hallucinationWarnings.length * 50);

  // 3. No Emoji Score (100 if clean, 0 if contains emojis)
  const hasEmoji = EMOJI_REGEX.test(fullText) || output.hashtags.some((h) => EMOJI_REGEX.test(h));
  const noEmojiScore = hasEmoji ? 0 : 100;

  // 4. Persona Adherence Score
  let personaScore = 80;
  const persona = config.normalizedCreator?.persona || config.normalizedPersona;
  if (persona) {
    if (persona.vocabulary && persona.vocabulary.length > 0) {
      const vocabMatches = persona.vocabulary.filter((v: string) => fullText.includes(v));
      if (vocabMatches.length > 0) personaScore = 100;
    }
    if (persona.avoid) {
      for (const av of persona.avoid) {
        if (fullText.includes(av)) personaScore -= 30;
      }
    }
  }

  // 5. Style Adherence Score
  let styleScore = 80;
  const style = config.normalizedCreator?.style || config.normalizedStyle;
  if (style) {
    if (style.id === "mystery" && (output.hook.includes("؟") || output.body.includes("لكن") || output.body.includes("المفارقة") || output.body.includes("الغريب"))) {
      styleScore = 100;
    } else if (style.id === "contrarian" && (output.hook.includes("ليس") || output.hook.includes("خطأ") || output.body.includes("عكس") || output.body.includes("الحقيقة"))) {
      styleScore = 100;
    } else if (style.id === "minimalist" && fullText.length < 500) {
      styleScore = 100;
    }
  }

  const overallScore = Math.round(
    genericnessScore * 0.25 +
    antiHallucinationScore * 0.25 +
    noEmojiScore * 0.20 +
    personaScore * 0.15 +
    styleScore * 0.15
  );

  const passed =
    overallScore >= 75 &&
    genericnessScore >= 75 &&
    antiHallucinationScore >= 80 &&
    noEmojiScore === 100;

  return {
    personaAdherenceScore: personaScore,
    styleAdherenceScore: styleScore,
    genericnessScore,
    antiHallucinationScore,
    noEmojiScore,
    overallScore,
    clicheMatches,
    hallucinationWarnings,
    passed,
  };
}
