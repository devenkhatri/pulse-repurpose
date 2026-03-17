import fs from "fs/promises"
import path from "path"
import type { BrandVoiceProfile } from "@/types"

const CONFIG_PATH = path.join(process.cwd(), "config", "brand-voice.json")

const DEFAULT_BRAND_VOICE: BrandVoiceProfile = {
  toneDescriptors: ["clear", "practical"],
  writingStyle:
    "Writes in a direct, no-nonsense way. Gets to the point fast. Uses real examples over theory.",
  topicPillars: [],
  avoidList: ["synergy", "leverage", "game-changer", "thought leader"],
  examplePosts: [],
  lastUpdated: "",
}

// ---------------------------------------------------------------------------
// Read
// ---------------------------------------------------------------------------

export async function getBrandVoice(): Promise<BrandVoiceProfile> {
  try {
    const raw = await fs.readFile(CONFIG_PATH, "utf-8")
    return JSON.parse(raw) as BrandVoiceProfile
  } catch {
    return DEFAULT_BRAND_VOICE
  }
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
