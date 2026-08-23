import { Type } from "@google/genai";
import { z } from "zod";
import {
  generateInputSchema,
  generatedContentSchema,
} from "@/lib/validation/generation";

export {
  generateInputSchema as inputSchema,
  generatedContentSchema,
};

export type InputDTO = z.infer<typeof generateInputSchema>;

// We keep this local because it imports from @google/genai,
// and we don't want to bundle @google/genai in Next.js client code.
// body stays a single string for every content type — this must match
// generatedContentSchema in lib/validation/generation.ts.
export const GEMINI_RESPONSE_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    title: { type: Type.STRING },
    hook: { type: Type.STRING },
    body: { type: Type.STRING },
    callToAction: { type: Type.STRING },
    hashtags: { type: Type.ARRAY, items: { type: Type.STRING } },
  },
  required: ["title", "hook", "body", "callToAction", "hashtags"],
} as const;
