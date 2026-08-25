import {
  getPromptLayers as getProductionLayers,
  USER_PROMPT,
} from "../../../supabase/functions/generate/prompts/promptBuilder";
import { buildPerspectiveConstraint } from "../personas/perspectiveConstraint";
import type { InputDTO } from "../../../supabase/functions/generate/validation/schema";
import type { PersonaId } from "../../evaluation/types";

interface PromptLayer {
  tag: string;
  content: string;
}

interface PersonaOptions {
  id?: string;
  usePerspectiveConstraint?: boolean;
  perspectiveVersion?: "v1" | "v2";
}

function normalizeInput(input: InputDTO): InputDTO {
  const meta = input.metadata as Record<string, unknown> | undefined;
  const aliases = input as InputDTO & { creatorIntent?: string };
  const persona = input.persona ?? meta?.persona;
  const style = input.style ?? meta?.style;

  return {
    ...input,
    persona: (typeof persona === "string" ? { id: persona, name: persona } : persona) as InputDTO["persona"],
    style: (typeof style === "string" ? { name: style } : style) as InputDTO["style"],
    intent: input.intent ?? (meta?.intent as string | undefined) ?? aliases.creatorIntent,
    originality: input.originality ?? (meta?.originality as string | undefined),
  };
}

function injectPerspective(layers: PromptLayer[], input: InputDTO): PromptLayer[] {
  if (input.mode !== "creator" && input.mode !== "personal_creator") return layers;

  const personaSource = (input.persona ?? input.metadata?.persona) as
    | string
    | (PersonaOptions & Record<string, unknown>)
    | undefined;
  if (!personaSource) return layers;

  const opts: PersonaOptions = typeof personaSource === "string" ? {} : personaSource;
  const personaId = typeof personaSource === "string" ? personaSource : (opts.id ?? "");
  if (!personaId) return layers;

  // 🔴 EXP-005: Rejected for production (34.36% prompt growth, 0pp accuracy improvement).
  // Disabled by default. Must explicitly pass usePerspectiveConstraint: true to enable.
  if (opts.usePerspectiveConstraint !== true) return layers;

  const constraint = buildPerspectiveConstraint(personaId as PersonaId, opts.perspectiveVersion ?? "v2");
  if (!constraint) return layers;

  return layers.map((layer) => {
    if (layer.tag !== "persona") return layer;
    const ruleIndex = layer.content.lastIndexOf("\n<rule>");
    if (ruleIndex === -1) return layer;
    return {
      ...layer,
      content: `${layer.content.slice(0, ruleIndex)}\n${constraint}${layer.content.slice(ruleIndex)}`,
    };
  });
}

export function getPromptLayers(input: InputDTO): PromptLayer[] {
  const normalized = normalizeInput(input);
  return injectPerspective(getProductionLayers(normalized), normalized);
}

export function buildSystemPrompt(input: InputDTO): string {
  return getPromptLayers(input)
    .map((layer) => `<${layer.tag}>\n${layer.content}\n</${layer.tag}>`)
    .join("\n\n");
}

export function buildUserPrompt(): string {
  return USER_PROMPT;
}
