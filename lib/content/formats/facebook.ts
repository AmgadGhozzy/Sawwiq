import { FormatRegistryEntry } from "./types";
import { MarketingObjectiveV2 } from "@/types/content";

const ALL_OBJECTIVES: MarketingObjectiveV2[] = [
  "awareness", "engagement", "traffic", "leads", "sales", "messages", "app_installs", "retention", "community", "education"
];

export const facebookFormats: FormatRegistryEntry[] = [
  {
    id: "post",
    platform: "facebook",
    label: "Facebook Post",
    capabilities: {
      text: true, images: false, video: false, audio: false,
      multipleScenes: false, hashtags: { supported: true, min: 1, max: 5 },
      mentions: true, links: true, emoji: true, cta: true,
      carousel: false, storySequence: false, thread: false,
      characterLimit: 63206, // FB limit is high, but realistically less
    },
    supportedContentTypes: ["social_post", "advertisement", "product_description", "real_estate_listing"],
    supportedObjectives: ALL_OBJECTIVES,
    defaultConstraints: {
      maxLength: 2000,
      emojiLevel: "minimal",
      hashtags: { enabled: true, count: 3, strategy: "broad" },
    },
  },
  {
    id: "image",
    platform: "facebook",
    label: "Facebook Image Post",
    capabilities: {
      text: true, images: true, video: false, audio: false,
      multipleScenes: false, hashtags: { supported: true, min: 1, max: 5 },
      mentions: true, links: true, emoji: true, cta: true,
      carousel: false, storySequence: false, thread: false,
    },
    supportedContentTypes: ["social_post", "advertisement", "product_description"],
    supportedObjectives: ALL_OBJECTIVES,
    defaultConstraints: {
      length: "short",
      emojiLevel: "minimal",
      hashtags: { enabled: true, count: 2, strategy: "broad" },
    },
  },
  {
    id: "carousel",
    platform: "facebook",
    label: "Facebook Carousel Ad",
    capabilities: {
      text: true, images: true, video: true, audio: false,
      multipleScenes: true, hashtags: { supported: false },
      mentions: false, links: true, emoji: true, cta: true,
      carousel: true, storySequence: false, thread: false,
    },
    supportedContentTypes: ["carousel_copy", "advertisement", "product_description"],
    supportedObjectives: ["sales", "traffic", "leads"],
    defaultConstraints: {
      length: "short",
      emojiLevel: "minimal",
      hashtags: { enabled: false },
      cta: { type: "learn_more", strength: "medium" },
    },
  },
  {
    id: "reel",
    platform: "facebook",
    label: "Facebook Reel",
    capabilities: {
      text: true, images: false, video: true, audio: true,
      multipleScenes: true, hashtags: { supported: true, min: 3, max: 10 },
      mentions: true, links: false, emoji: true, cta: true,
      carousel: false, storySequence: false, thread: false,
    },
    supportedContentTypes: ["video_script", "ugc_script"],
    supportedObjectives: ["awareness", "engagement", "sales"],
    defaultConstraints: {
      length: "short",
      emojiLevel: "moderate",
      hashtags: { enabled: true, count: 5, strategy: "mixed" },
      includeHook: true,
    },
  },
  {
    id: "story",
    platform: "facebook",
    label: "Facebook Story",
    capabilities: {
      text: true, images: true, video: true, audio: true,
      multipleScenes: false, hashtags: { supported: false },
      mentions: true, links: true, emoji: true, cta: true,
      carousel: false, storySequence: false, thread: false,
    },
    supportedContentTypes: ["social_post", "advertisement"],
    supportedObjectives: ["engagement", "traffic", "sales", "messages"],
    defaultConstraints: {
      length: "short",
      emojiLevel: "moderate",
      hashtags: { enabled: false },
    },
  }
];
