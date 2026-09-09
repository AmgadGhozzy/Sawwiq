import { z } from "zod";
import type { PlannerOutputNode } from "../ir/compiler.ts";
import type { GeneratedContent } from "../../../types/content.ts";

// ─── UTILS ───────────────────────────────────────────────────────────────────

/**
 * Extracts raw JSON from an LLM response string.
 * Hardened: Only strips markdown fences if they wrap the entire output.
 * Does NOT blindly search for the first JSON-like block to avoid extracting malicious payloads hidden in conversational text.
 */
export function extractJSON(raw: string): unknown {
  let text = raw.trim();
  
  if (text.startsWith("\`\`\`json") && text.endsWith("\`\`\`")) {
    text = text.substring(7, text.length - 3).trim();
  } else if (text.startsWith("\`\`\`") && text.endsWith("\`\`\`")) {
    text = text.substring(3, text.length - 3).trim();
  }

  try {
    return JSON.parse(text);
  } catch (e) {
    throw new Error("Parser Error: Failed to parse LLM output as JSON. Output must be strictly JSON without conversational text.");
  }
}

// ─── PLANNER PARSER ──────────────────────────────────────────────────────────

const PlannerOutputNodeSchema = z.object({
  id: z.string().min(1),
  content: z.string().min(1),
  confidence: z.number().min(0).max(1).optional()
}).strict();

const PlannerOutputSchema = z.object({
  nodes: z.array(PlannerOutputNodeSchema),
  angles: z.array(z.object({
    type: z.string(),
    priority: z.enum(["high", "medium", "low"]),
    content: z.string(),
    sourceNodes: z.array(z.string()).optional()
  })).optional()
}).strict();

/**
 * Parses and strictly validates the raw string output from the Planner LLM.
 */
export function parsePlannerOutput(raw: string): { nodes: PlannerOutputNode[], angles?: any[] } {
  const json = extractJSON(raw);
  const result = PlannerOutputSchema.safeParse(json);
  
  if (!result.success) {
    throw new Error(`Parser Error: Planner output validation failed - ${result.error.message}`);
  }
  
  if (result.data.nodes.length === 0) {
    throw new Error("Parser Error: Planner output contains empty nodes array");
  }

  return result.data;
}

// ─── RENDERER PARSER ─────────────────────────────────────────────────────────

const RendererOutputSchema = z.object({
  title: z.string(),
  hook: z.string(),
  body: z.string(),
  callToAction: z.string(),
  hashtags: z.array(z.string())
}).strict(); // strict ensures no extra fields are added


/**
 * Parses and validates the raw string output from the Renderer LLM.
 * Length checking is performed by the validator (soft signal), not here.
 */
export function parseRendererOutput(raw: string): GeneratedContent {
  const json = extractJSON(raw);
  const result = RendererOutputSchema.safeParse(json);
  
  if (!result.success) {
    throw new Error(`Parser Error: Renderer output validation failed - ${result.error.message}`);
  }

  return result.data;
}
