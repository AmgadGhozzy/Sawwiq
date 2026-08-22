import { FormatRegistryEntry } from "./types";
import { MarketingObjectiveV2 } from "@/types/content";

const ALL_OBJECTIVES: MarketingObjectiveV2[] = [
  "awareness", "engagement", "traffic", "leads", "sales", "messages", "app_installs", "retention", "community", "education"
];

export const linkedinFormats: FormatRegistryEntry[] = [
  {
    id: "text_post",
    platform: "linkedin",
    label: "LinkedIn Text Post",
    capabilities: {
      text: true, images: false, video: false, audio: false,
      multipleScenes: false, hashtags: { supported: true, min: 2, max: 5 },
      mentions: true, links: true, emoji: true, cta: true,
      carousel: false, storySequence: false, thread: false,
      characterLimit: 3000,
    },
    supportedContentTypes: ["social_post", "product_description", "real_estate_listing"],
    supportedObjectives: ALL_OBJECTIVES,
    defaultConstraints: {
      maxLength: 3000,
      emojiLevel: "minimal",
      hashtags: { enabled: true, count: 5, strategy: "niche" },
    },
  },
  {
    id: "image_post",
    platform: "linkedin",
    label: "LinkedIn Image Post",
    capabilities: {
      text: true, images: true, video: false, audio: false,
      multipleScenes: false, hashtags: { supported: true, min: 2, max: 5 },
      mentions: true, links: true, emoji: true, cta: true,
      carousel: false, storySequence: false, thread: false,
      characterLimit: 3000,
    },
    supportedContentTypes: ["social_post", "advertisement"],
    supportedObjectives: ALL_OBJECTIVES,
    defaultConstraints: {
      length: "medium",
      emojiLevel: "minimal",
      hashtags: { enabled: true, count: 5, strategy: "niche" },
    },
  },
  {
    id: "document",
    platform: "linkedin",
    label: "LinkedIn Document (PDF)",
    capabilities: {
      text: true, images: true, video: false, audio: false,
      multipleScenes: true, hashtags: { supported: true, min: 2, max: 4 },
      mentions: true, links: true, emoji: true, cta: true,
      carousel: true, storySequence: false, thread: false,
      characterLimit: 3000,
    },
    supportedContentTypes: ["carousel_copy", "social_post"],
    supportedObjectives: ["awareness", "education", "leads", "community"],
    defaultConstraints: {
      length: "long",
      emojiLevel: "minimal",
      hashtags: { enabled: true, count: 3, strategy: "niche" },
    },
  },
  {
    id: "poll",
    platform: "linkedin",
    label: "LinkedIn Poll",
    capabilities: {
      text: true, images: false, video: false, audio: false,
      multipleScenes: false, hashtags: { supported: true, min: 1, max: 3 },
      mentions: true, links: false, emoji: true, cta: false,
      carousel: false, storySequence: false, thread: false,
    },
    supportedContentTypes: ["social_post"],
    supportedObjectives: ["engagement", "community", "awareness"],
    defaultConstraints: {
      length: "short",
      emojiLevel: "none",
      hashtags: { enabled: true, count: 2, strategy: "niche" },
    },
  },
  {
    id: "article",
    platform: "linkedin",
    label: "LinkedIn Article",
    capabilities: {
      text: true, images: true, video: true, audio: false,
      multipleScenes: false, hashtags: { supported: true, min: 2, max: 5 },
      mentions: true, links: true, emoji: false, cta: true,
      carousel: false, storySequence: false, thread: false,
      characterLimit: 110000,
    },
    supportedContentTypes: ["social_post"],
    supportedObjectives: ["awareness", "education", "community", "leads"],
    defaultConstraints: {
      length: "long",
      emojiLevel: "none",
      hashtags: { enabled: true, count: 3, strategy: "broad" },
    },
  }
];
