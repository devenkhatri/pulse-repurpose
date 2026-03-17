/**
 * lib/platform-skills.ts
 *
 * Shared executor for platform skill files.
 * Called by /api/skills/platform-prompt (per-platform) and
 * /api/trigger/repurpose + /api/trigger/images (bulk parallel).
 *
 * Reads the skill .md file from skills/platforms/, calls OpenRouter to
 * produce structured JSON output, and returns typed ContentPromptOutput
 * or ImagePromptOutput.
 */

import fs from "fs/promises"
import path from "path"
import { executePrompt } from "@/lib/anthropic"
import { getBrandVoice } from "@/lib/brand-voice"
import type {
  Platform,
  ContentPromptOutput,
  ImagePromptOutput,
  BrandVoiceProfile,
} from "@/types"

// ---------------------------------------------------------------------------
// Internal: extract platform-relevant learnings from learnings.md
// ---------------------------------------------------------------------------

function extractPlatformLearnings(learnings: string, platform: string): string {
  if (!learnings.trim()) return ""

  const lines = learnings.split("\n")
  const extracted: string[] = []
  let capturing = false
  let depth = 0

  for (const line of lines) {
    const headerMatch = line.match(/^(#{1,4}) /)
    if (headerMatch) {
      const currentDepth = headerMatch[1].length
      const lower = line.toLowerCase()

      // Start capturing on platform-specific or approval-pattern sections
      if (
        lower.includes(platform) ||
        lower.includes("approval patterns") ||
        lower.includes("content performance")
      ) {
        capturing = true
        depth = currentDepth
        extracted.push(line)
        continue
      }

      // Stop capturing when a section of equal or higher level is found
      if (capturing && currentDepth <= depth) {
        capturing = false
      }
    }

    if (capturing) extracted.push(line)
  }

  return extracted.join("\n").trim()
}

// ---------------------------------------------------------------------------
// Shared context loader
// ---------------------------------------------------------------------------

async function loadSkillContext(
  platform: Platform,
  skillType: "content" | "image"
): Promise<{
  skillContent: string
  brandVoice: BrandVoiceProfile
  learnings: string
  userProfile: string
}> {
  const root = process.cwd()
  const skillPath = path.join(root, "skills", "platforms", `${platform}-${skillType}.md`)

  const [skillContent, learningsRaw, userProfileRaw, brandVoice] = await Promise.all([
    fs.readFile(skillPath, "utf-8"),
    fs.readFile(path.join(root, "memory", "learnings.md"), "utf-8").catch(() => ""),
    fs.readFile(path.join(root, "memory", "USER.md"), "utf-8").catch(() => ""),
    getBrandVoice(),
  ])

  const learnings = extractPlatformLearnings(learningsRaw, platform)

  return { skillContent, brandVoice, learnings, userProfile: userProfileRaw }
}

// ---------------------------------------------------------------------------
// Parse JSON from raw LLM response (handles code fences)
// ---------------------------------------------------------------------------

function parseJsonResponse<T>(raw: string): T {
  const fenceMatch = raw.match(/```(?:json)?\s*([\s\S]*?)```/)
  const objectMatch = raw.match(/(\{[\s\S]*\})/)
  const jsonStr = fenceMatch
    ? (fenceMatch[1] ?? fenceMatch[0])
    : objectMatch
    ? (objectMatch[1] ?? objectMatch[0])
    : raw
  return JSON.parse(jsonStr.trim()) as T
}

// ---------------------------------------------------------------------------
// executePlatformContentSkill
// Runs the {platform}-content.md skill and returns ContentPromptOutput.
// ---------------------------------------------------------------------------

export async function executePlatformContentSkill(params: {
  postId: string
  platform: Platform
  linkedinText: string
  brandVoice?: BrandVoiceProfile
}): Promise<ContentPromptOutput> {
  const { postId, platform, linkedinText } = params

  const { skillContent, brandVoice, learnings, userProfile } =
    await loadSkillContext(platform, "content")

  const bv = params.brandVoice ?? brandVoice

  const system = `You are executing a skill file for the Pulse Repurpose content system.
Read the skill file carefully and produce the exact output format it specifies.
Return JSON only. No markdown code fences. No explanation outside the JSON.`

  const user = `Execute this skill:

${skillContent}

With these inputs:
- postId: ${postId}
- linkedinText: ${linkedinText}
- brandVoice: ${JSON.stringify(bv)}
- learnings (platform-relevant): ${learnings || "None yet — early use, no learning data."}
- userProfile: ${userProfile || "Not configured yet."}

Return the structured ContentPromptOutput object as specified in the skill file.`

  const raw = await executePrompt({ system, user, maxTokens: 2048 })
  return parseJsonResponse<ContentPromptOutput>(raw)
}

// ---------------------------------------------------------------------------
// executePlatformImageSkill
// Runs the {platform}-image.md skill and returns ImagePromptOutput.
// ---------------------------------------------------------------------------

export async function executePlatformImageSkill(params: {
  postId: string
  platform: Platform
  linkedinText: string
  sourceImageUrl: string | null
  brandVoice?: BrandVoiceProfile
}): Promise<ImagePromptOutput> {
  const { postId, platform, linkedinText, sourceImageUrl } = params

  const { skillContent, brandVoice, learnings, userProfile } =
    await loadSkillContext(platform, "image")

  const bv = params.brandVoice ?? brandVoice

  const system = `You are executing a skill file for the Pulse Repurpose image system.
Read the skill file carefully and produce the exact output format it specifies.
Return JSON only. No markdown code fences. No explanation outside the JSON.`

  const user = `Execute this skill:

${skillContent}

With these inputs:
- postId: ${postId}
- linkedinText: ${linkedinText}
- sourceImageUrl: ${sourceImageUrl ?? "null"}
- brandVoice: ${JSON.stringify(bv)}
- learnings (image-relevant): ${learnings || "None yet — early use, no learning data."}
- userProfile: ${userProfile || "Not configured yet."}

Return the structured ImagePromptOutput object as specified in the skill file.`

  const raw = await executePrompt({ system, user, maxTokens: 2048 })
  return parseJsonResponse<ImagePromptOutput>(raw)
}
