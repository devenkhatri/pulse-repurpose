import type { Platform } from "@/types"

export interface PlatformRule {
  label: string
  color: string
  maxChars: number
  threadEnabled: boolean
  maxThreadTweets: number | null
  imageAspectRatio: string
  imageWidth: number
  imageHeight: number
  hashtagCount: { min: number; max: number }
  tone: string
  formatRules: string
  avoidPatterns: string[]
}

export const PLATFORM_RULES: Record<Platform, PlatformRule> = {
  twitter: {
    label: "Twitter / X",
    color: "#000000",
    maxChars: 280,
    threadEnabled: true,
    maxThreadTweets: 10,
    imageAspectRatio: "16:9",
    imageWidth: 1200,
    imageHeight: 675,
    hashtagCount: { min: 1, max: 3 },
    tone: "punchy, hook-first, no filler words, each tweet self-contained",
    formatRules:
      "Start with a bold hook. Use short punchy sentences. If thread, number tweets 1/ 2/ etc. No corporate language.",
    avoidPatterns: [
      "Let me know your thoughts",
      "Comment below",
      "long sentences over 20 words",
    ],
  },
  threads: {
    label: "Threads",
    color: "#000000",
    maxChars: 500,
    threadEnabled: false,
    maxThreadTweets: null,
    imageAspectRatio: "1:1",
    imageWidth: 1080,
    imageHeight: 1080,
    hashtagCount: { min: 0, max: 5 },
    tone: "conversational, casual, like texting a smart friend",
    formatRules:
      "Write as if talking to someone directly. Short paragraphs. Casual contractions ok. Can end with a soft question.",
    avoidPatterns: ["hashtag spam", "overly formal language"],
  },
  instagram: {
    label: "Instagram",
    color: "#E1306C",
    maxChars: 2200,
    threadEnabled: false,
    maxThreadTweets: null,
    imageAspectRatio: "1:1",
    imageWidth: 1080,
    imageHeight: 1080,
    hashtagCount: { min: 5, max: 15 },
    tone: "story-driven, personal, visual-first mindset",
    formatRules:
      "Lead with a strong first line (visible before \"more\"). Tell a mini story. Put hashtags at the very end, separated by line breaks. Use line breaks generously for readability.",
    avoidPatterns: ["link in bio (no links work)", "excessive emojis"],
  },
  facebook: {
    label: "Facebook",
    color: "#1877F2",
    maxChars: 63206,
    threadEnabled: false,
    maxThreadTweets: null,
    imageAspectRatio: "16:9",
    imageWidth: 1200,
    imageHeight: 630,
    hashtagCount: { min: 0, max: 3 },
    tone: "warm, community-oriented, slightly longer form ok",
    formatRules:
      "Can be longer than other platforms. End with a direct question to drive comments. Paragraphs over bullet points. Personal tone.",
    avoidPatterns: ["aggressive CTAs", "spammy hashtags"],
  },
  skool: {
    label: "Skool Community",
    color: "#00A693",
    maxChars: 10000,
    threadEnabled: false,
    maxThreadTweets: null,
    imageAspectRatio: "16:9",
    imageWidth: 1200,
    imageHeight: 675,
    hashtagCount: { min: 0, max: 0 },
    tone: "community discussion starter, teaching mindset, inviting participation",
    formatRules:
      "Reframe as a discussion prompt or lesson for the community. Start with \"I want to share...\" or a direct insight. End with a question that invites replies. No hashtags.",
    avoidPatterns: ["sales language", "hashtags", "external links without context"],
  },
  linkedin: {
    label: "LinkedIn",
    color: "#0A66C2",
    maxChars: 3000,
    threadEnabled: false,
    maxThreadTweets: null,
    imageAspectRatio: "1.91:1",
    imageWidth: 1200,
    imageHeight: 627,
    hashtagCount: { min: 0, max: 5 },
    tone: "professional but personal, insight-driven",
    formatRules:
      "Lead with the key insight. Use short paragraphs. End with a question or call-to-action.",
    avoidPatterns: ["corporate jargon", "humble bragging"],
  },
} as const
