import type { MarketingToneId } from "@/types/content.ts";

export interface ToneContract {
  id: MarketingToneId;
  sentenceStyle: string;
  vocabulary: string;
  emotionalIntensity: string;
  urgency: string;
  punctuation: string;
  directness: string;
  rhythm: string;
  audienceDistance: string;
  persuasionStyle: string;
  forbiddenPatterns: string[];
}

export const TONE_CONTRACTS: Record<MarketingToneId, ToneContract> = {
  premium: {
    id: "premium",
    sentenceStyle: "Short, deliberate sentences. White space is a feature.",
    vocabulary: "Sensory specificity over adjective stacking. No hype words.",
    emotionalIntensity: "Restrained confidence.",
    urgency: "None. Imply exclusivity through precision.",
    punctuation: "No exclamation marks.",
    directness: "Indirect, allowing the user to desire rather than being sold to.",
    rhythm: "Slow, methodical, allowing concepts to land with weight.",
    audienceDistance: "Arm's length. Respectful and elevated, not overly familiar.",
    persuasionStyle: "Aspirational. We don't convince; we present undeniable value.",
    forbiddenPatterns: ["ACT NOW", "Hurry", "Amazing", "Exclusive offer"],
  },
  friendly: {
    id: "friendly",
    sentenceStyle: "Conversational warmth. Natural rhythm.",
    vocabulary: "Accessible. No jargon. Relatable.",
    emotionalIntensity: "Welcoming and empathetic.",
    urgency: "Gentle nudges, no pressure.",
    punctuation: "Standard, occasional exclamation mark.",
    directness: "Highly direct but soft. Feels like advice from a trusted friend.",
    rhythm: "Breezy and flowing. Easy to read quickly.",
    audienceDistance: "Very close. First-name basis feel.",
    persuasionStyle: "Relational. Building trust through shared understanding.",
    forbiddenPatterns: ["Corporate-speak", "Synergy", "Utilize"],
  },
  professional: {
    id: "professional",
    sentenceStyle: "Precise, credible, restrained.",
    vocabulary: "Industry-appropriate, data-driven.",
    emotionalIntensity: "Objective and competent.",
    urgency: "Logical next steps.",
    punctuation: "Strictly standard.",
    directness: "Direct and respectful of the reader's time.",
    rhythm: "Structured and predictable. Clear headings or bullet points if needed.",
    audienceDistance: "Professional distance. Peer-to-peer in a business context.",
    persuasionStyle: "Evidence-based. Logic and ROI lead the way.",
    forbiddenPatterns: ["Hype", "Miracle", "Guaranteed", "!!!", "😎"],
  },
  energetic: {
    id: "energetic",
    sentenceStyle: "High energy, action-oriented. Short punchy sentences.",
    vocabulary: "Active verbs. Momentum-driven.",
    emotionalIntensity: "Enthusiastic and motivating.",
    urgency: "High, but genuine.",
    punctuation: "Strategic exclamation marks.",
    directness: "Extremely direct. No beating around the bush.",
    rhythm: "Fast-paced, staccato. Builds momentum rapidly.",
    audienceDistance: "Close, like a coach motivating an athlete.",
    persuasionStyle: "Action-driven. FOMO and high energy.",
    forbiddenPatterns: ["Passive voice", "Slow build-ups"],
  },
  conversational: {
    id: "conversational",
    sentenceStyle: "Write as you speak. Fragments and contractions allowed.",
    vocabulary: "Everyday language.",
    emotionalIntensity: "Relaxed, peer-to-peer.",
    urgency: "Low-pressure invitation.",
    punctuation: "Casual.",
    directness: "Meandering but purposeful, like a good chat.",
    rhythm: "Natural, uneven, mimicking spoken pauses.",
    audienceDistance: "Close and casual.",
    persuasionStyle: "Story-driven. Sharing an experience rather than pitching.",
    forbiddenPatterns: ["Stuffy academic terms", "Overselling"],
  },
  minimal: {
    id: "minimal",
    sentenceStyle: "Say less. Every word must earn its place.",
    vocabulary: "Stark, direct.",
    emotionalIntensity: "Detached, confident.",
    urgency: "None.",
    punctuation: "Bare minimum.",
    directness: "Ultra-direct. Just the facts.",
    rhythm: "Stark and abrupt. Forces the reader to pause.",
    audienceDistance: "Distant. The product speaks for itself.",
    persuasionStyle: "Subtractive. Persuading by what is left unsaid.",
    forbiddenPatterns: ["Adjectives (unless necessary)", "Fluff", "Elaboration"],
  },
  bold: {
    id: "bold",
    sentenceStyle: "Confident declarations. Direct address.",
    vocabulary: "Strong verbs, provocative statements.",
    emotionalIntensity: "Challenging but commercial.",
    urgency: "Immediate action required.",
    punctuation: "Forceful.",
    directness: "Confrontational in a healthy, engaging way.",
    rhythm: "Punchy and disruptive.",
    audienceDistance: "In their face, demanding attention.",
    persuasionStyle: "Challenger sale. Disrupting their current beliefs.",
    forbiddenPatterns: ["Hedging", "Maybe", "I think", "Perhaps"],
  },
  playful: {
    id: "playful",
    sentenceStyle: "Light touch. Smart over random.",
    vocabulary: "Wit, occasional wordplay if it serves the message.",
    emotionalIntensity: "Amusing but keeps the product serious.",
    urgency: "Fun, low stakes.",
    punctuation: "Expressive.",
    directness: "Playfully indirect. Uses humor or irony to make the point.",
    rhythm: "Bouncy and unpredictable.",
    audienceDistance: "Friendly and conspiratorial.",
    persuasionStyle: "Entertainment-first. Winning hearts before minds.",
    forbiddenPatterns: ["Dad jokes", "Cliches", "Overly serious corporate tone"],
  },
};

export function renderToneContract(contract: ToneContract): string {
  return `
[TONE CONTRACT — ${contract.id.toUpperCase()}]
- Sentence Style: ${contract.sentenceStyle}
- Vocabulary: ${contract.vocabulary}
- Emotional Intensity: ${contract.emotionalIntensity}
- Urgency: ${contract.urgency}
- Punctuation: ${contract.punctuation}
- Directness: ${contract.directness}
- Rhythm: ${contract.rhythm}
- Audience Distance: ${contract.audienceDistance}
- Persuasion Style: ${contract.persuasionStyle}
- FORBIDDEN: ${contract.forbiddenPatterns.join(", ")}
  `.trim();
}
