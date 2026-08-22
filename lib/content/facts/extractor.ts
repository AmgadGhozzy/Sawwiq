import { GenerationConfig, FactLedger, Fact, FactType, FactConfidence } from "@/types/content";

function generateFactId(): string {
  return `fact_${Math.random().toString(36).substring(2, 9)}`;
}

export function extractFacts(config: GenerationConfig): FactLedger {
  const ledger: FactLedger = {
    explicit: [],
    uncertain: [],
    missing: [],
    prohibitedClaims: []
  };

  const rawInput = (config.content.topic + "\n" + (config.content.sourceFacts || "")).trim();
  if (!rawInput) return ledger;

  // Basic deterministic extraction rules (Regex based for MVP)
  // Extract Prices
  const priceRegex = /([\d,]+)\s*(جنيه|ريال|دولار|درهم|EGP|SAR|USD|AED)/g;
  let match;
  while ((match = priceRegex.exec(rawInput)) !== null) {
    ledger.explicit.push({
      id: generateFactId(),
      key: "price",
      value: match[0],
      type: "commercial",
      source: "user_input",
      confidence: "explicit",
      status: "verified"
    });
  }

  // Extract battery sizes as an example
  const batteryRegex = /([\d,]+)\s*(mAh|ملي أمبير)/gi;
  while ((match = batteryRegex.exec(rawInput)) !== null) {
    ledger.explicit.push({
      id: generateFactId(),
      key: "battery",
      value: match[0],
      type: "technical",
      source: "user_input",
      confidence: "explicit",
      status: "verified"
    });
  }

  // Extract guarantees/warranties
  const warrantyRegex = /ضمان\s+([أ-ي0-9]+)\s+(سنوات|سنة|سنتين|أشهر|شهر)/g;
  while ((match = warrantyRegex.exec(rawInput)) !== null) {
    ledger.explicit.push({
      id: generateFactId(),
      key: "warranty",
      value: match[0],
      type: "commercial",
      source: "user_input",
      confidence: "explicit",
      status: "verified"
    });
  }

  // Detect conflicts: if we have multiple prices, mark them as conflicting
  const prices = ledger.explicit.filter(f => f.key === "price");
  if (prices.length > 1) {
    // Basic check: if values are different
    const uniqueValues = new Set(prices.map(p => p.value));
    if (uniqueValues.size > 1) {
      prices.forEach(p => p.status = "conflicting");
    }
  }

  // Example of finding subjective claims that should be "uncertain"
  const subjectiveRegex = /(أفضل|أقوى|أسرع)\s+([أ-ي]+)/g;
  while ((match = subjectiveRegex.exec(rawInput)) !== null) {
    ledger.uncertain.push({
      id: generateFactId(),
      key: "claim",
      value: match[0],
      type: "claim",
      source: "user_input",
      confidence: "uncertain",
      status: "uncertain"
    });
  }

  // For anything else, we might just store a chunk
  // In a real system, we'd use a small NLP model or advanced heuristics here.

  return ledger;
}
