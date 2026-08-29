import { tiktokFormats } from "./tiktok";
import { instagramFormats } from "./instagram";
import { facebookFormats } from "./facebook";
import { linkedinFormats } from "./linkedin";
import { xFormats } from "./x";
import { youtubeFormats } from "./youtube";
import { FormatRegistryEntry } from "./types";
import { PlatformV2 } from "@/types/content";

export const ALL_FORMATS: FormatRegistryEntry[] = [
  ...tiktokFormats,
  ...instagramFormats,
  ...facebookFormats,
  ...linkedinFormats,
  ...xFormats,
  ...youtubeFormats,
];

export function normalizePlatform(platform: string): PlatformV2 {
  if (platform === "x_twitter") return "x";
  return platform as PlatformV2;
}

export const REGISTERED_PLATFORMS = Array.from(
  new Set(ALL_FORMATS.map((f) => f.platform))
) as readonly PlatformV2[];

export function getRegisteredPlatforms(): PlatformV2[] {
  return [...REGISTERED_PLATFORMS];
}

export function getFormatsForPlatform(platform: PlatformV2 | string): FormatRegistryEntry[] {
  const norm = normalizePlatform(platform);
  return ALL_FORMATS.filter((f) => f.platform === norm);
}

export function getFormat(platform: PlatformV2 | string, formatId: string): FormatRegistryEntry | undefined {
  const norm = normalizePlatform(platform);
  return ALL_FORMATS.find((f) => f.platform === norm && f.id === formatId);
}
