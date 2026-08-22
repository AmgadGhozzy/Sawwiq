import { ContentStyleDefinition } from "@/types/content";
import { mysteryStyle } from "./mystery";
import { storytellingStyle } from "./storytelling";
import { contrarianStyle } from "./contrarian";
import { intellectualStyle } from "./intellectual";
import { cinematicStyle } from "./cinematic";
import { minimalistStyle } from "./minimalist";

export const ALL_STYLES: ContentStyleDefinition[] = [
  mysteryStyle,
  storytellingStyle,
  contrarianStyle,
  intellectualStyle,
  cinematicStyle,
  minimalistStyle,
];

export const STYLE_REGISTRY: Record<string, ContentStyleDefinition> = Object.fromEntries(
  ALL_STYLES.map((s) => [s.id, s])
);

export function getAvailableStyles(): ContentStyleDefinition[] {
  return ALL_STYLES.filter((s) => s.enabled);
}

export function getStyle(id: string): ContentStyleDefinition | undefined {
  return STYLE_REGISTRY[id];
}

export function isStyleSupported(id: string): boolean {
  return !!STYLE_REGISTRY[id];
}
