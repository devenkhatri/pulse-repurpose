import fs from "fs/promises"
import path from "path"
import type { BrandVoiceProfile } from "@/types"
import { cacheGetOrSet, cacheDelete } from "@/lib/cache"

const BRAND_VOICE_CACHE_KEY = "file:brand-voice"
const BRAND_VOICE_TTL_MS = 5 * 60 * 1000

const CONFIG_PATH = path.join(process.cwd(), "config", "brand-voice.json")

const DEFAULT_BRAND_VOICE: BrandVoiceProfile = {
  toneDescriptors: ["clear", "practical"],
  writingStyle:
    "Writes in a direct, no-nonsense way. Gets to the point fast. Uses real examples over theory.",
  topicPillars: [],
  avoidList: ["synergy", "leverage", "game-changer", "thought leader"],
  examplePosts: [],
  imageBrandKit: {
    primaryColor: "#7C3AED",
    secondaryColor: "#A78BFA",
    visualStyle: [],
    photographyStyle: [],
    moodKeywords: [],
    avoidInImages: [],
  },
  lastUpdated: "",
}

// ---------------------------------------------------------------------------
// Read
// ---------------------------------------------------------------------------

export async function getBrandVoice(): Promise<BrandVoiceProfile> {
  return cacheGetOrSet(BRAND_VOICE_CACHE_KEY, BRAND_VOICE_TTL_MS, async () => {
    try {
      const raw = await fs.readFile(CONFIG_PATH, "utf-8")
      const parsed = JSON.parse(raw) as BrandVoiceProfile
      // Backfill imageBrandKit for profiles saved before Session 17
      if (!parsed.imageBrandKit) {
        parsed.imageBrandKit = DEFAULT_BRAND_VOICE.imageBrandKit
      }
      return parsed
    } catch {
      return DEFAULT_BRAND_VOICE
    }
  })
}

// ---------------------------------------------------------------------------
// Write
// ---------------------------------------------------------------------------

export async function saveBrandVoice(profile: BrandVoiceProfile): Promise<void> {
  const updated: BrandVoiceProfile = {
    ...profile,
    lastUpdated: new Date().toISOString(),
  }
  await fs.writeFile(CONFIG_PATH, JSON.stringify(updated, null, 2))
  cacheDelete(BRAND_VOICE_CACHE_KEY)
}

// ---------------------------------------------------------------------------
// Prompt builder
// ---------------------------------------------------------------------------

export function buildBrandVoiceSystemPrompt(profile: BrandVoiceProfile): string {
  const lines: string[] = [
    "You are repurposing content for a personal brand with the following voice profile:",
    "",
    `TONE: ${profile.toneDescriptors.join(", ")}`,
    `WRITING STYLE: ${profile.writingStyle}`,
    `TOPIC PILLARS: ${profile.topicPillars.join(", ") || "none specified"}`,
    `WORDS AND PHRASES TO NEVER USE: ${profile.avoidList.join(", ") || "none specified"}`,
  ]

  if (profile.examplePosts.length > 0) {
    lines.push("")
    lines.push(
      "Here are example posts from this brand that represent the ideal voice:"
    )
    for (const post of profile.examplePosts) {
      lines.push("---")
      lines.push(post)
    }
    lines.push("---")
  }

  lines.push("")
  lines.push(
    "Always match this voice. Never deviate from the avoid list. Ensure the content feels authored by this specific person, not generic AI."
  )

  return lines.join("\n")
}
