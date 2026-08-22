import type { ContentMode, PersonaConfig, StyleConfig, CreatorIntent, OriginalityLevel } from "./content";

// ---------------------------------------------------------------------------
// Generation History Types
// We expose the `prompt` and configuration fields so users can regenerate from history.
// ---------------------------------------------------------------------------

export interface GenerationHistoryItem {
  id: string;
  platform: string;
  contentType: string;
  arabicStyle: string;
  prompt: string;
  format?: string;
  mode?: ContentMode;
  marketingObjective?: string;
  persona?: PersonaConfig;
  style?: StyleConfig;
  intent?: CreatorIntent;
  originality?: OriginalityLevel;
  metadata?: Record<string, unknown>;
  aiResponse: {
    title: string;
    hook: string;
    body: string;
    callToAction: string;
    hashtags: string[];
  };
  createdAt: string; // ISO 8601 from DB - formatted by the frontend
}

export interface HistoryResponse {
  success: true;
  data: GenerationHistoryItem[];
  count: number;
}

export interface HistoryErrorResponse {
  success: false;
  error: { code: string };
}
