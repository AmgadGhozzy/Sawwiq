import { ContentPersona } from "@/types/content";
import { developerPersona } from "./developer";
import { psychologyPersona } from "./psychology";
import { intellectualPersona } from "./intellectual";
import { sciencePersona } from "./science";
import { creativePersona } from "./creative";

export const ALL_PERSONAS: ContentPersona[] = [
  developerPersona,
  psychologyPersona,
  intellectualPersona,
  sciencePersona,
  creativePersona,
];

export const PERSONA_REGISTRY: Record<string, ContentPersona> = Object.fromEntries(
  ALL_PERSONAS.map((p) => [p.id, p])
);

export function getAvailablePersonas(): ContentPersona[] {
  return ALL_PERSONAS.filter((p) => p.enabled);
}

export function getPersona(id: string): ContentPersona | undefined {
  return PERSONA_REGISTRY[id];
}

export function isPersonaSupported(id: string): boolean {
  return !!PERSONA_REGISTRY[id];
}
