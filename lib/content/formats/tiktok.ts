import { FormatRegistryEntry } from "./types";
import { MarketingObjectiveV2 } from "@/types/content";

const ALL_OBJECTIVES: MarketingObjectiveV2[] = [
  "awareness", "engagement", "traffic", "leads", "sales", "messages", "app_installs", "retention", "community", "education"
];

export const tiktokFormats: FormatRegistryEntry[] = [
  {
    id: "video",
    platform: "tiktok",
    label: "TikTok Video",
    capabilities: {
      text: true, images: false, video: true, audio: true,
      multipleScenes: true, hashtags: { supported: true, min: 2, max: 5 },
      mentions: true, links: false, emoji: true, cta: true,
      carousel: false, storySequence: false, thread: false,
      characterLimit: 2200,
    },
    supportedContentTypes: ["video_script", "advertisement", "product_description"],
    supportedObjectives: ALL_OBJECTIVES,
    defaultConstraints: {
      length: "short",
      emojiLevel: "moderate",
      hashtags: { enabled: true, count: 5, strategy: "mixed" },
      includeHook: true,
    },
  },
  {
    id: "carousel",
    platform: "tiktok",
    label: "TikTok Carousel (Photos)",
    capabilities: {
      text: true, images: true, video: false, audio: true,
      multipleScenes: true, hashtags: { supported: true, min: 2, max: 5 },
      mentions: true, links: false, emoji: true, cta: true,
      carousel: true, storySequence: false, thread: false,
      characterLimit: 2200,
    },
    supportedContentTypes: ["carousel_copy", "product_description"],
    supportedObjectives: ALL_OBJECTIVES,
    defaultConstraints: {
      length: "medium",
      emojiLevel: "moderate",
      hashtags: { enabled: true, count: 3 },
    },
  },
  {
    id: "spark_ad",
    platform: "tiktok",
    label: "Spark Ad",
    capabilities: {
      text: true, images: false, video: true, audio: true,
      multipleScenes: true, hashtags: { supported: true, min: 2, max: 5 },
      mentions: true, links: true, emoji: true, cta: true,
      carousel: false, storySequence: false, thread: false,
    },
    supportedContentTypes: ["advertisement", "ugc_script"],
    supportedObjectives: ["sales", "leads", "app_installs", "traffic"],
    defaultConstraints: {
      length: "short",
      emojiLevel: "minimal",
      hashtags: { enabled: true, count: 3 },
      includeHook: true,
      cta: { type: "learn_more", strength: "strong" },
    },
  },
  {
    id: "ugc",
    platform: "tiktok",
    label: "UGC Video",
    capabilities: {
      text: true, images: false, video: true, audio: true,
      multipleScenes: true, hashtags: { supported: true, min: 3, max: 6 },
      mentions: true, links: false, emoji: true, cta: true,
      carousel: false, storySequence: false, thread: false,
    },
    supportedContentTypes: ["ugc_script", "product_description"],
    supportedObjectives: ["awareness", "engagement", "sales", "education"],
    defaultConstraints: {
      length: "medium",
      emojiLevel: "moderate",
      hashtags: { enabled: true, count: 4, strategy: "niche" },
      includeHook: true,
    },
  }
];
