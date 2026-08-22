import { FormatRegistryEntry } from "./types";
import { MarketingObjectiveV2 } from "@/types/content";

const ALL_OBJECTIVES: MarketingObjectiveV2[] = [
  "awareness", "engagement", "traffic", "leads", "sales", "messages", "app_installs", "retention", "community", "education"
];

export const xFormats: FormatRegistryEntry[] = [
  {
    id: "thread",
    platform: "x",
    label: "X Thread",
    capabilities: {
      text: true, images: true, video: true, audio: false,
      multipleScenes: true, hashtags: { supported: true, min: 1, max: 2 },
      mentions: true, links: true, emoji: true, cta: true,
      carousel: false, storySequence: false, thread: true,
      characterLimit: 280, // per tweet
    },
    supportedContentTypes: ["thread", "social_post"],
    supportedObjectives: ["awareness", "education", "engagement", "community"],
    defaultConstraints: {
      maxLength: 280,
      emojiLevel: "minimal",
      hashtags: { enabled: false }, // threads usually don't need heavy hashtags
      includeHook: true,
    },
  },
  {
    id: "video_post",
    platform: "x",
    label: "X Video Post",
    capabilities: {
      text: true, images: false, video: true, audio: true,
      multipleScenes: false, hashtags: { supported: true, min: 1, max: 3 },
      mentions: true, links: true, emoji: true, cta: true,
      carousel: false, storySequence: false, thread: false,
      characterLimit: 280,
    },
    supportedContentTypes: ["video_script", "social_post"],
    supportedObjectives: ALL_OBJECTIVES,
    defaultConstraints: {
      maxLength: 280,
      emojiLevel: "minimal",
      hashtags: { enabled: true, count: 2, strategy: "broad" },
    },
  },
  {
    id: "post",
    platform: "x",
    label: "X Standard Post",
    capabilities: {
      text: true, images: true, video: false, audio: false,
      multipleScenes: false, hashtags: { supported: true, min: 1, max: 3 },
      mentions: true, links: true, emoji: true, cta: true,
      carousel: false, storySequence: false, thread: false,
      characterLimit: 280,
    },
    supportedContentTypes: ["social_post", "advertisement"],
    supportedObjectives: ALL_OBJECTIVES,
    defaultConstraints: {
      maxLength: 280,
      emojiLevel: "minimal",
      hashtags: { enabled: true, count: 3, strategy: "broad" },
    },
  }
];
