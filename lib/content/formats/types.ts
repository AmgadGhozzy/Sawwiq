import {
  PlatformV2,
  PlatformFormat,
  ContentTypeV2,
  MarketingObjectiveV2,
  ContentConstraints,
} from "@/types/content";

export interface FormatCapabilities {
  text: boolean;
  images: boolean;
  video: boolean;
  audio: boolean;

  multipleScenes: boolean;
  hashtags: {
    supported: boolean;
    min?: number;
    max?: number;
  };
  mentions: boolean;
  links: boolean;

  emoji: boolean;
  cta: boolean;

  carousel: boolean;
  storySequence: boolean;
  thread: boolean;

  characterLimit?: number;
}

export interface ValidationProfile {
  // specific validation rules for this format
  requireHook?: boolean;
  maxVideoDuration?: number;
  // ... more rules can be added in Sprint 2.5/3
}

export interface FormatRegistryEntry {
  id: PlatformFormat;
  platform: PlatformV2;
  label: string;
  
  capabilities: FormatCapabilities;
  defaultConstraints: ContentConstraints;

  supportedContentTypes: ContentTypeV2[];
  supportedObjectives: MarketingObjectiveV2[];

  promptProfile?: string; // TBD in Sprint 3
  validationProfile?: ValidationProfile;
}
