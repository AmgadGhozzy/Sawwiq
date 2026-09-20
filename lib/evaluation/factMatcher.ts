// ─────────────────────────────────────────────────────────────────────────────
// factMatcher.ts — shared deterministic fact-matching engine
//
// Used by:
//   - lib/evaluation/evaluator.ts  (Structural Gate — mustContain check)
//   - lib/content/facts/factPreservationChecker.ts  (Fact Preservation Gate)
//
// Semantics:
//   matchFact("300", text)  →  true if text contains 300, ٣٠٠, or ثلاثمائة
//   matchFact("مسبح", text) →  true if text contains مسبح or مسابح
//   matchFact("سباح", text) →  false for مسبح (no false positives)
//   matchFact("3", text)    →  false if text only has 30 or 300 (word-boundary safe)
// ─────────────────────────────────────────────────────────────────────────────

// ---------------------------------------------------------------------------
// Arabic orthographic normalization — NOT stemming.
// Alef variants, taa marbuta, ya, kashida only.
// ---------------------------------------------------------------------------
export function normalizeArabicText(text: string): string {
  return text
    .normalize("NFKC")
    .replace(/[أإآٱ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/ؤ/g, "و")
    .replace(/ئ/g, "ي")
    .replace(/ـ/g, "")
    .toLowerCase()
    .trim();
}

// ---------------------------------------------------------------------------
// Eastern Arabic digit → ASCII digit (٠١٢٣٤٥٦٧٨٩ → 0-9)
// ---------------------------------------------------------------------------
function convertEasternDigits(text: string): string {
  return text.replace(/[٠-٩]/g, d => String(d.charCodeAt(0) - 0x0660));
}

// ---------------------------------------------------------------------------
// Arabic number words → digit strings.
// Only whole-word replacements — regex uses \b-like anchors safe for Arabic.
// ---------------------------------------------------------------------------
const WORD_NUMBER_MAP: Array<[RegExp, string]> = [
  // Longest words first to prevent partial matches (ثلاثمائة before ثلاثة)
  // Both original and taa-marbuta-collapsed forms (ة → ه after normalizeArabicText)
  // Boundaries: only prevent adjacency with digits (not Arabic letters)
  [/(?<![0-9])ثلاثمائه(?![0-9])/g, "300"],
  [/(?<![0-9])ثلاثمائة(?![0-9])/g, "300"],
  [/(?<![0-9])ثلاثميه(?![0-9])/g, "300"],
  [/(?<![0-9])ثلاثمية(?![0-9])/g, "300"],
  [/(?<![0-9])مائتان(?![0-9])/g, "200"],
  [/(?<![0-9])مئتان(?![0-9])/g, "200"],
  [/(?<![0-9])متين(?![0-9])/g, "200"],
  [/(?<![0-9])اربعمائه(?![0-9])/g, "400"],
  [/(?<![0-9])أربعمائة(?![0-9])/g, "400"],
  [/(?<![0-9])اربعميه(?![0-9])/g, "400"],
  [/(?<![0-9])خمسمائه(?![0-9])/g, "500"],
  [/(?<![0-9])خمسمائة(?![0-9])/g, "500"],
  [/(?<![0-9])خمسميه(?![0-9])/g, "500"],
  [/(?<![0-9])ستمائه(?![0-9])/g, "600"],
  [/(?<![0-9])ستمائة(?![0-9])/g, "600"],
  [/(?<![0-9])ستميه(?![0-9])/g, "600"],
  [/(?<![0-9])سبعمائه(?![0-9])/g, "700"],
  [/(?<![0-9])سبعمائة(?![0-9])/g, "700"],
  [/(?<![0-9])سبعميه(?![0-9])/g, "700"],
  [/(?<![0-9])ثمانمائه(?![0-9])/g, "800"],
  [/(?<![0-9])ثمانمائة(?![0-9])/g, "800"],
  [/(?<![0-9])ثمانميه(?![0-9])/g, "800"],
  [/(?<![0-9])تسعمائه(?![0-9])/g, "900"],
  [/(?<![0-9])تسعمائة(?![0-9])/g, "900"],
  [/(?<![0-9])تسعميه(?![0-9])/g, "900"],
  [/(?<![0-9])مائه(?![0-9])/g, "100"],
  [/(?<![0-9])مائة(?![0-9])/g, "100"],
  [/(?<![0-9])مئه(?![0-9])/g, "100"],
  [/(?<![0-9])مئة(?![0-9])/g, "100"],
  [/(?<![0-9])ميه(?![0-9])/g, "100"],
  [/(?<![0-9\u0600-\u06FF])الف(?![0-9\u0600-\u06FF])/g, "1000"],
  [/(?<![0-9])عشره(?![0-9])/g, "10"],
  [/(?<![0-9])عشرة(?![0-9])/g, "10"],
  [/(?<![0-9])ثمانيه(?![0-9])/g, "8"],
  [/(?<![0-9])ثمانية(?![0-9])/g, "8"],
  [/(?<![0-9])تسعه(?![0-9])/g, "9"],
  [/(?<![0-9])تسعة(?![0-9])/g, "9"],
  [/(?<![0-9])سبعه(?![0-9])/g, "7"],
  [/(?<![0-9])سبعة(?![0-9])/g, "7"],
  [/(?<![0-9])سته(?![0-9])/g, "6"],
  [/(?<![0-9])ستة(?![0-9])/g, "6"],
  [/(?<![0-9])خمسه(?![0-9])/g, "5"],
  [/(?<![0-9])خمسة(?![0-9])/g, "5"],
  [/(?<![0-9])اربعه(?![0-9])/g, "4"],
  [/(?<![0-9])اربعة(?![0-9])/g, "4"],
  [/(?<![0-9])ثلاثه(?![0-9])/g, "3"],
  [/(?<![0-9])ثلاثة(?![0-9])/g, "3"],
  [/(?<![0-9])تلاته(?![0-9])/g, "3"],
  [/(?<![0-9])اتنين(?![0-9])/g, "2"],
  [/(?<![0-9])اثنان(?![0-9])/g, "2"],
  [/(?<![0-9])واحد(?![0-9])/g, "1"],
];/**
 * Normalizes number representations in a text string.
 * Converts Eastern Arabic digits and spelled-out Arabic numbers to Western digits.
 * Uses proper boundary detection to avoid substring collisions (3 ≠ 30).
 */
export function normalizeNumbers(text: string): string {
  // First: Eastern Arabic digits → Western digits
  let normalized = convertEasternDigits(text);
  
  // Second: Spelled-out words → digits (longest match first, already ordered above)
  for (const [regex, digit] of WORD_NUMBER_MAP) {
    normalized = normalized.replace(regex, digit);
  }
  
  return normalized;
}

// ---------------------------------------------------------------------------
// Synonym groups for Arabic morphological variants
// Keys must be normalizeArabicText()-normalized.
// Only high-confidence, semantically identical variants — no paraphrases.
// ---------------------------------------------------------------------------
const SYNONYM_GROUPS: Array<string[]> = [
  ["مسبح", "مسابح", "حمام سباحه", "حمام سباحي"],
  ["غرفه", "غرف", "حجره", "حجر", "اوضه", "اوض"],
  ["مطبخ", "مطابخ"],
  ["سياره", "عربيه", "مركبه", "سيارات", "عربيات"],
];

/**
 * Builds the set of normalized variants for a required fact.
 * For numeric facts: only the digit form is checked (applied to output text).
 * For Arabic words: orthographic variants only; no paraphrases.
 */
export function buildMatchVariants(fact: string): string[] {
  const normalizedFact = normalizeArabicText(fact);
  const variants = new Set<string>();

  variants.add(normalizedFact);

  // Add synonym variants if this fact belongs to a known group
  for (const group of SYNONYM_GROUPS) {
    const normalizedGroup = group.map(normalizeArabicText);
    if (normalizedGroup.includes(normalizedFact)) {
      normalizedGroup.forEach(v => variants.add(v));
      break;
    }
  }

  return Array.from(variants);
}

/**
 * Normalizes a text for numeric comparison:
 * - Applies Arabic orthographic normalization
 * - Converts Eastern Arabic digits and spelled-out numbers to Western digits
 */
function normalizeForMatch(text: string): string {
  // Apply number-word substitution FIRST (on raw Arabic text before ة→ه conversion)
  // Then apply Arabic orthographic normalization
  return normalizeArabicText(normalizeNumbers(text));
}

/**
 * Returns true if the requiredFact is semantically present in generatedText.
 *
 * For numeric facts (the required fact is a digit string like "300"):
 *   - The generated text is number-normalized before checking.
 *   - Matching is done with word boundaries to prevent 3 from matching inside 300.
 *
 * For Arabic word facts:
 *   - Variant matching is used (orthographic synonyms only).
 *   - Substring matching within normalized text.
 *
 * False-positive guards:
 *   - "3" does NOT match "30" or "300"
 *   - "200" does NOT match "300"
 *   - "سباح" does NOT match "مسبح"
 */
export function matchFact(requiredFact: string, generatedText: string): boolean {
  const normalizedText = normalizeForMatch(generatedText);
  const requiredNormalized = normalizeArabicText(requiredFact);
  const requiredNormalizedWithNumbers = normalizeForMatch(requiredFact);

  // ─── Numeric fact matching ────────────────────────────────────────────────
  // If the required fact is a pure number (after normalization), use word-boundary regex
  if (/^\d+$/.test(requiredNormalizedWithNumbers)) {
    // Match the number only when not immediately adjacent to another digit
    const numRegex = new RegExp(`(?<![0-9])${requiredNormalizedWithNumbers}(?![0-9])`);
    return numRegex.test(normalizedText);
  }

  // ─── Mixed / English fact matching ───────────────────────────────────────
  // For English terms (technical names, brands), do case-insensitive substring match
  if (/[a-zA-Z]/.test(requiredFact) && !/[\u0600-\u06FF]/.test(requiredFact)) {
    return generatedText.toLowerCase().includes(requiredFact.toLowerCase());
  }

  // ─── Arabic word fact matching ────────────────────────────────────────────
  const variants = buildMatchVariants(requiredFact);
  for (const variant of variants) {
    if (normalizedText.includes(variant)) {
      return true;
    }
  }

  return false;
}
