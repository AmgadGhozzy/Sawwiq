import { z } from "zod";

/**
 * Zod schema for a single scene within a video script.
 * - `index`       : 1-based sequential scene number
 * - `durationSec` : scene duration in seconds (min 1)
 * - `visual`      : on-screen visual direction
 * - `audio`       : voiceover / audio direction
 */
export const videoSceneSchema = z.object({
  index: z.number().int().min(1),
  durationSec: z.number().int().min(1),
  visual: z.string().min(1),
  audio: z.string().min(1),
});

/**
 * Zod schema for a fully-structured video script.
 * - `scenes` : ordered array of scenes (at least 1)
 * - `hook`   : opening hook line (optional but validated when present)
 */
export const videoScriptSchema = z.object({
  scenes: z.array(videoSceneSchema).min(1),
  hook: z.string().optional(),
});

export type VideoScene = z.infer<typeof videoSceneSchema>;
export type VideoScript = z.infer<typeof videoScriptSchema>;
