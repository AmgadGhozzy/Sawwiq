/**
 * Rotating AI Client for Sawwiq Experiments
 */
import { GoogleGenAI } from "@google/genai";
import { config } from "dotenv";
import * as path from "path";
config({ path: path.join(process.cwd(), ".env.local") });

// ─── Models ─────────────────────────────────────────────────────────────────
export const MODEL = {
  GENERATION: "gemini-2.5-flash-lite",
  EVALUATION: "gemini-2.5-flash-lite",
  LITE: "gemini-2.5-flash-lite",
} as const;

export type ModelAlias = typeof MODEL[keyof typeof MODEL];

// ─── Key Pool ────────────────────────────────────────────────────────────────
// Reads VERTEX_AI_API_KEY, VERTEX_AI_API_KEY_2, VERTEX_AI_API_KEY_3, ...
// Rotates across all available keys so a 429 on one key falls back immediately.
function buildKeyPool(): Array<{ label: string; client: GoogleGenAI }> {
  const pool: Array<{ label: string; client: GoogleGenAI }> = [];

  // Primary key
  const primary = process.env.VERTEX_AI_API_KEY;
  if (!primary) throw new Error("VERTEX_AI_API_KEY is not configured");
  pool.push({ label: "KEY_1", client: new GoogleGenAI({ vertexai: true, apiKey: primary }) });

  // Additional keys: VERTEX_AI_API_KEY_2, _3, _4 ...
  for (let i = 2; i <= 10; i++) {
    const key = process.env[`VERTEX_AI_API_KEY_${i}`];
    if (!key) break;
    pool.push({ label: `KEY_${i}`, client: new GoogleGenAI({ vertexai: true, apiKey: key }) });
  }

  console.log(`   🔑 Key pool: ${pool.map(p => p.label).join(", ")}`);
  return pool;
}

const KEY_POOL = buildKeyPool();

// ─── Rotating Call ───────────────────────────────────────────────────────────

export interface AICallParams {
  model: ModelAlias;
  contents: string;
  config?: Record<string, any>;
}

export async function callAI(params: AICallParams): Promise<string> {
  const MAX_GLOBAL_RETRIES = 5;
  let lastError: any = new Error("All keys exhausted after max retries");

  for (let attempt = 1; attempt <= MAX_GLOBAL_RETRIES; attempt++) {
    const shuffled = [...KEY_POOL].sort(() => Math.random() - 0.5);

    for (const { label, client } of shuffled) {
      try {
        const response = await client.models.generateContent({
          model: params.model,
          contents: params.contents,
          config: params.config as any,
        });
        if (!response.text) throw new Error("Empty response from model");
        return response.text;
      } catch (err: any) {
        lastError = err;
        const status: number = err?.status ?? err?.error?.code ?? 0;

        const isRetriable =
          status === 429 || status === 404 || status === 503 ||
          err.code === 'UND_ERR_CONNECT_TIMEOUT' ||
          err.code === 'ECONNRESET' ||
          err.cause?.code === 'ECONNRESET' ||
          err.message?.includes('fetch failed') ||
          err.message?.includes('read ECONNRESET');

        if (isRetriable) {
          console.log(`     [${status || err.code || 'NETWORK'}] ${label} failed. Trying next key...`);
          continue;
        }

        throw err;
      }
    }

    const waitSec = 12 * attempt;
    console.log(`     [Rate Limit] All keys exhausted. Waiting ${waitSec}s before retry (${MAX_GLOBAL_RETRIES - attempt} left)...`);
    await new Promise(res => setTimeout(res, waitSec * 1000));
  }

  throw lastError;
}

export async function callAIJson<T = any>(params: AICallParams): Promise<T> {
  const text = await callAI(params);
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error(`Model returned invalid JSON:\n${text.slice(0, 300)}`);
  }
}

