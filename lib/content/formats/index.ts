import { tiktokFormats } from "./tiktok";
import { instagramFormats } from "./instagram";
import { facebookFormats } from "./facebook";
import { linkedinFormats } from "./linkedin";
import { xFormats } from "./x";
import { youtubeFormats } from "./youtube";
import { FormatRegistryEntry, FormatCapabilities } from "./types";
import { PlatformV2, PlatformFormat, ContentTypeV2, MarketingObjectiveV2, ContentConstraints } from "@/types/content";

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

export function getSupportedFormats(): FormatRegistryEntry[] {
  return ALL_FORMATS;
}

export function getFormatsForPlatform(platform: PlatformV2 | string): FormatRegistryEntry[] {
  const norm = normalizePlatform(platform);
  return ALL_FORMATS.filter((f) => f.platform === norm);
}

export function getDefaultFormatForPlatform(platform: PlatformV2 | string): FormatRegistryEntry | undefined {
  const formats = getFormatsForPlatform(platform);
  return formats[0];
}

export function getFormat(platform: PlatformV2 | string, formatId: string): FormatRegistryEntry | undefined {
  const norm = normalizePlatform(platform);
  return ALL_FORMATS.find((f) => f.platform === norm && f.id === formatId);
}

export function resolveFormat(platform: PlatformV2 | string, formatId: PlatformFormat | string): FormatRegistryEntry {
  const norm = normalizePlatform(platform);
  const format = getFormat(norm, formatId);
  if (!format) {
    throw new Error(`Unsupported format '${formatId}' for platform '${platform}'`);
  }
  return format;
}

export function isFormatSupported(platform: PlatformV2 | string, formatId: string): boolean {
  return !!getFormat(platform, formatId);
}

export function getDefaultConstraints(platform: PlatformV2 | string, formatId: string): ContentConstraints | undefined {
  return getFormat(platform, formatId)?.defaultConstraints;
}

export function getFormatCapabilities(platform: PlatformV2 | string, formatId: string): FormatCapabilities | undefined {
  return getFormat(platform, formatId)?.capabilities;
}

export function getSupportedContentTypes(platform: PlatformV2 | string, formatId: string): ContentTypeV2[] {
  return getFormat(platform, formatId)?.supportedContentTypes || [];
}

export function getSupportedObjectives(platform: PlatformV2 | string, formatId: string): MarketingObjectiveV2[] {
  return getFormat(platform, formatId)?.supportedObjectives || [];
}

export function getContentTypesForPlatform(platform: PlatformV2 | string): ContentTypeV2[] {
  const formats = getFormatsForPlatform(platform);
  const set = new Set<ContentTypeV2>();
  for (const f of formats) {
    for (const ct of f.supportedContentTypes) {
      set.add(ct);
    }
  }
  return Array.from(set);
}

export function getAllRegisteredContentTypes(): ContentTypeV2[] {
  const set = new Set<ContentTypeV2>();
  for (const f of ALL_FORMATS) {
    for (const ct of f.supportedContentTypes) {
      set.add(ct);
    }
  }
  return Array.from(set);
}

export function getAllRegisteredObjectives(): MarketingObjectiveV2[] {
  const set = new Set<MarketingObjectiveV2>();
  for (const f of ALL_FORMATS) {
    for (const obj of f.supportedObjectives) {
      set.add(obj);
    }
  }
  return Array.from(set);
}
