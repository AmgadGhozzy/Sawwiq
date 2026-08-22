import { FormatRegistryEntry } from "./types";
import { MarketingObjectiveV2 } from "@/types/content";

const ALL_OBJECTIVES: MarketingObjectiveV2[] = [
  "awareness", "engagement", "traffic", "leads", "sales", "messages", "app_installs", "retention", "community", "education"
];

export const youtubeFormats: FormatRegistryEntry[] = [
  {
    id: "short",
    platform: "youtube",
    label: "YouTube Short",
    capabilities: {
      text: true, images: false, video: true, audio: true,
      multipleScenes: true, hashtags: { supported: true, min: 1, max: 3 },
      mentions: true, links: true, emoji: true, cta: true,
      carousel: false, storySequence: false, thread: false,
    },
    supportedContentTypes: ["video_script", "ugc_script"],
    supportedObjectives: ["awareness", "engagement", "sales", "traffic", "leads"],
    defaultConstraints: {
      length: "short",
      emojiLevel: "minimal",
      hashtags: { enabled: true, count: 3, strategy: "broad" },
      includeHook: true,
    },
  },
  {
    id: "community_post",
    platform: "youtube",
    label: "YouTube Community Post",
    capabilities: {
      text: true, images: true, video: false, audio: false,
      multipleScenes: false, hashtags: { supported: false },
      mentions: true, links: true, emoji: true, cta: true,
      carousel: false, storySequence: false, thread: false,
    },
    supportedContentTypes: ["social_post"],
    supportedObjectives: ["engagement", "community", "retention"],
    defaultConstraints: {
      length: "short",
      emojiLevel: "moderate",
      hashtags: { enabled: false },
    },
  },
  {
    id: "video",
    platform: "youtube",
    label: "YouTube Long-form Video",
    capabilities: {
      text: true, images: false, video: true, audio: true,
      multipleScenes: true, hashtags: { supported: true, min: 3, max: 15 },
      mentions: true, links: true, emoji: true, cta: true,
      carousel: false, storySequence: false, thread: false,
    },
    supportedContentTypes: ["video_script"],
    supportedObjectives: ["awareness", "education", "sales", "community", "retention"],
    defaultConstraints: {
      length: "long",
      emojiLevel: "none",
      hashtags: { enabled: true, count: 5, strategy: "niche" },
      includeHook: true,
    },
  }
];
