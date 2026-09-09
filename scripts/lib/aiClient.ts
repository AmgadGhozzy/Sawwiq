/**
 * Vertex AI Client for Sawwiq Experiments
 *
 * Endpoint: Vertex AI Standard Mode (via GCP Service Account)
 * Quota: 1000 RPM (Tier 1)
 */
import { GoogleGenAI } from "@google/genai";
import { config } from "dotenv";
import * as path from "path";
config({ path: path.join(process.cwd(), ".env.local") });

// ─── Models ─────────────────────────────────────────────────────────────────
export const MODEL = {
  GENERATION: "gemini-2.5-flash-lite",
  EVALUATION: "gemini-2.5-flash-lite",
  LITE:       "gemini-2.5-flash-lite",
} as const;

export type ModelAlias = typeof MODEL[keyof typeof MODEL];

// ─── Client Init ─────────────────────────────────────────────────────────────
// Node.js environment automatically picks up GOOGLE_APPLICATION_CREDENTIALS
const ai = new GoogleGenAI({
  vertexai: true,
  project: 'gen-lang-client-0841388254',
  location: 'us-central1'
});

// ─── Rate Limiter (1000ms Mutex) ─────────────────────────────────────────────
let lastRequestTime = 0;
let requestMutex = Promise.resolve();
const BASE_DELAY_MS = 1000;

async function enforceRateLimit() {
  await requestMutex;
  let unlock: () => void;
  requestMutex = new Promise(resolve => unlock = resolve);
  
  const now = Date.now();
  const waitTime = Math.max(0, BASE_DELAY_MS - (now - lastRequestTime));
  if (waitTime > 0) {
    await new Promise(r => setTimeout(r, waitTime));
  }
  lastRequestTime = Date.now();
  unlock!();
}

// ─── Types ───────────────────────────────────────────────────────────────────
export interface AICallParams {
  model: ModelAlias;
  contents: string;
  config?: Record<string, any>;
}

// ─── Core Call ───────────────────────────────────────────────────────────────
export async function callAI(params: AICallParams): Promise<string> {
  const MAX_GLOBAL_RETRIES = 5;
  let lastError: any = new Error("Max retries exceeded");

  for (let attempt = 1; attempt <= MAX_GLOBAL_RETRIES; attempt++) {
    try {
      await enforceRateLimit();

      const response = await ai.models.generateContent({
        model:    params.model,
        contents: params.contents,
        config:   params.config as any,
      });

      if (!response.text) throw new Error("Empty response from model");
      return response.text;

    } catch (err: any) {
      lastError = err;

      const status: number = err?.status ?? err?.error?.code ?? 0;
      const msg: string    = err?.message ?? "";

      const isRetriable =
        status === 429 ||
        status === 503 ||
        err.code === "UND_ERR_CONNECT_TIMEOUT" ||
        err.code === "ECONNRESET" ||
        err.cause?.code === "ECONNRESET" ||
        msg.includes("fetch failed") ||
        msg.includes("read ECONNRESET") ||
        msg.includes("RESOURCE_EXHAUSTED");

      if (isRetriable) {
        const waitMs = Math.min(5_000 * Math.pow(1.6, attempt - 1) + Math.random() * 2_000, 30_000);
        const remaining = MAX_GLOBAL_RETRIES - attempt;
        console.log(`     [Rate Limit / Net] Attempt ${attempt} failed. Waiting ${(waitMs / 1000).toFixed(1)}s (${remaining} left)...`);
        await new Promise(res => setTimeout(res, waitMs));
        continue;
      }

      // Non-retriable (400, 401, 404, etc.) — fail fast
      throw err;
    }
  }

  throw lastError;
}

// ─── JSON variant ─────────────────────────────────────────────────────────────
export async function callAIJson<T = any>(params: AICallParams): Promise<T> {
  const text = await callAI(params);
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error(`Model returned invalid JSON:\n${text.slice(0, 300)}`);
  }
}
