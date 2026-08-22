import { FormatRegistryEntry } from "./types";
import { MarketingObjectiveV2 } from "@/types/content";

const ALL_OBJECTIVES: MarketingObjectiveV2[] = [
  "awareness", "engagement", "traffic", "leads", "sales", "messages", "app_installs", "retention", "community", "education"
];

export const instagramFormats: FormatRegistryEntry[] = [
  {
    id: "post",
    platform: "instagram",
    label: "Instagram Post",
    capabilities: {
      text: true, images: true, video: false, audio: false,
      multipleScenes: false, hashtags: { supported: true, min: 5, max: 30 },
      mentions: true, links: false, emoji: true, cta: true,
      carousel: false, storySequence: false, thread: false,
      characterLimit: 2200,
    },
    supportedContentTypes: ["social_post", "advertisement", "product_description", "real_estate_listing"],
    supportedObjectives: ALL_OBJECTIVES,
    defaultConstraints: {
      maxLength: 2200,
      emojiLevel: "moderate",
      hashtags: { enabled: true, count: 15, strategy: "mixed" },
    },
  },
  {
    id: "reel",
    platform: "instagram",
    label: "Instagram Reel",
    capabilities: {
      text: true, images: false, video: true, audio: true,
      multipleScenes: true, hashtags: { supported: true, min: 3, max: 30 },
      mentions: true, links: false, emoji: true, cta: true,
      carousel: false, storySequence: false, thread: false,
      characterLimit: 2200,
    },
    supportedContentTypes: ["video_script", "ugc_script", "advertisement"],
    supportedObjectives: ALL_OBJECTIVES,
    defaultConstraints: {
      length: "short",
      emojiLevel: "moderate",
      hashtags: { enabled: true, count: 10, strategy: "mixed" },
      includeHook: true,
    },
  },
  {
    id: "carousel",
    platform: "instagram",
    label: "Instagram Carousel",
    capabilities: {
      text: true, images: true, video: true, audio: false,
      multipleScenes: true, hashtags: { supported: true, min: 5, max: 30 },
      mentions: true, links: false, emoji: true, cta: true,
      carousel: true, storySequence: false, thread: false,
      characterLimit: 2200,
    },
    supportedContentTypes: ["carousel_copy", "social_post"],
    supportedObjectives: ["awareness", "education", "engagement", "sales"],
    defaultConstraints: {
      length: "medium",
      emojiLevel: "moderate",
      hashtags: { enabled: true, count: 15, strategy: "mixed" },
    },
  },
  {
    id: "story",
    platform: "instagram",
    label: "Instagram Story",
    capabilities: {
      text: true, images: true, video: true, audio: true,
      multipleScenes: false, hashtags: { supported: true, max: 3 },
      mentions: true, links: true, emoji: true, cta: true,
      carousel: false, storySequence: false, thread: false,
    },
    supportedContentTypes: ["social_post", "advertisement"],
    supportedObjectives: ["engagement", "traffic", "sales", "messages"],
    defaultConstraints: {
      length: "short",
      emojiLevel: "high",
      hashtags: { enabled: true, count: 1 },
      cta: { type: "learn_more", strength: "medium" }
    },
  },
  {
    id: "story_sequence",
    platform: "instagram",
    label: "Instagram Story Sequence",
    capabilities: {
      text: true, images: true, video: true, audio: true,
      multipleScenes: true, hashtags: { supported: false },
      mentions: true, links: true, emoji: true, cta: true,
      carousel: false, storySequence: true, thread: false,
    },
    supportedContentTypes: ["story_sequence", "product_description"],
    supportedObjectives: ["awareness", "education", "sales", "traffic"],
    defaultConstraints: {
      length: "medium",
      emojiLevel: "high",
      hashtags: { enabled: false },
      cta: { type: "learn_more", strength: "strong" }
    },
  }
];
