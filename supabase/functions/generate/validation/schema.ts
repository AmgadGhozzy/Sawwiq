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
export function getGeminiResponseSchema(contentType?: string) {
  const isThread = contentType === "thread";

  return {
    type: Type.OBJECT,
    properties: {
      title: { type: Type.STRING },
      hook: { type: Type.STRING },
      body: isThread ? {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            post_number: { type: Type.INTEGER },
            text: { type: Type.STRING },
            char_count: { type: Type.INTEGER },
          },
          required: ["post_number", "text"],
        }
      } : { type: Type.STRING },
      callToAction: { type: Type.STRING },
      hashtags: { type: Type.ARRAY, items: { type: Type.STRING } },
    },
    required: ["title", "hook", "body", "callToAction", "hashtags"],
  };
}
