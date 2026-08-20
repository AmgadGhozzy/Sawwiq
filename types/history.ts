// ---------------------------------------------------------------------------
// Generation History Types
// No `prompt` field — we don't expose user input to the client unnecessarily.
// ---------------------------------------------------------------------------

export interface GenerationHistoryItem {
  id: string;
  platform: string;
  contentType: string;
  arabicStyle: string;
  aiResponse: {
    title: string;
    hook: string;
    body: string;
    callToAction: string;
    hashtags: string[];
  };
  createdAt: string; // ISO 8601 from DB — formatted by the frontend
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
