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
import { cacheGetOrSet } from "@/lib/cache"

const FILE_TTL_MS = 5 * 60 * 1000
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
    cacheGetOrSet(`file:skill:${platform}-${skillType}`, FILE_TTL_MS, () => fs.readFile(skillPath, "utf-8")),
    cacheGetOrSet("file:learnings", FILE_TTL_MS, () => fs.readFile(path.join(root, "memory", "learnings.md"), "utf-8").catch(() => "")),
    cacheGetOrSet("file:user-profile", FILE_TTL_MS, () => fs.readFile(path.join(root, "memory", "USER.md"), "utf-8").catch(() => "")),
    getBrandVoice(),
  ])

  const learnings = extractPlatformLearnings(learningsRaw, platform)

  return { skillContent, brandVoice, learnings, userProfile: userProfileRaw }
}

// ---------------------------------------------------------------------------
// Parse JSON from raw LLM response (handles code fences, empty responses,
// and malformed JSON with control characters)
// ---------------------------------------------------------------------------

function parseJsonResponse<T>(raw: string): T {
  // Handle empty or whitespace-only responses
  if (!raw || !raw.trim()) {
    throw new Error("Empty response from LLM")
  }

  // Try to extract JSON from code fences first
  const fenceMatch = raw.match(/```(?:json)?\s*([\s\S]*?)```/)
  let jsonStr = ""

  if (fenceMatch) {
    jsonStr = fenceMatch[1] ?? fenceMatch[0]
  } else {
    // Try to find JSON object in the response
    const objectMatch = raw.match(/(\{[\s\S]*\})/)
    jsonStr = objectMatch ? (objectMatch[1] ?? objectMatch[0]) : raw
  }

  // Clean up the JSON string:
  // 1. Trim whitespace
  // 2. Remove non-printable control characters that are always invalid in JSON
  //    (preserves \x09 tab, \x0A newline, \x0D carriage return for next step)
  jsonStr = jsonStr.trim().replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "")

  // 3. Escape literal newlines/carriage returns that appear inside JSON string
  //    values — the LLM often embeds raw multiline text (e.g. linkedinText) in
  //    a string field, producing invalid JSON like: "text": "line1\nline2"
  //    where \n is a real newline character, not the two-char escape sequence.
  jsonStr = jsonStr.replace(/"((?:[^"\\]|\\.)*)"/g, (_, content: string) =>
    '"' +
    content
      .replace(/\r\n/g, "\\n")
      .replace(/\r/g, "\\n")
      .replace(/\n/g, "\\n") +
    '"'
  )

  try {
    return JSON.parse(jsonStr) as T
  } catch (parseError) {
    // If parsing fails, try one more approach - extract just the JSON object
    // by finding the outermost braces/brackets
    const lastBrace = raw.lastIndexOf("{")
    const lastBracket = raw.lastIndexOf("[")

    if (lastBrace !== -1 || lastBracket !== -1) {
      const start = lastBrace > lastBracket ? lastBrace : lastBracket
      const end = raw.lastIndexOf("}") > raw.lastIndexOf("]")
        ? raw.lastIndexOf("}")
        : raw.lastIndexOf("]")

      if (start !== -1 && end !== -1 && end > start) {
        const attempt = raw.slice(start, end + 1).trim()
        // Clean control characters and escape literal newlines inside strings
        const cleanedAttempt = attempt
          .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "")
          .replace(/"((?:[^"\\]|\\.)*)"/g, (_, content: string) =>
            '"' + content.replace(/\r\n/g, "\\n").replace(/\r/g, "\\n").replace(/\n/g, "\\n") + '"'
          )
        try {
          return JSON.parse(cleanedAttempt) as T
        } catch {
          // Fall through to throw original error
        }
      }
    }

    // Provide more context in the error message
    const preview = jsonStr.slice(0, 200)
    throw new Error(
      `Failed to parse JSON response: ${parseError instanceof Error ? parseError.message : "Unknown error"}. Response preview: ${preview}`
    )
  }
}

// ---------------------------------------------------------------------------
// Helper: Retry wrapper for transient failures
// ---------------------------------------------------------------------------

async function withRetry<T>(
  fn: () => Promise<T>,
  options: { maxRetries: number; delayMs: number } = { maxRetries: 2, delayMs: 1000 }
): Promise<T> {
  let lastError: Error | unknown

  for (let attempt = 0; attempt <= options.maxRetries; attempt++) {
    try {
      return await fn()
    } catch (error) {
      lastError = error

      // Don't retry on parse errors — malformed LLM output won't improve on retry
      const errorMessage = error instanceof Error ? error.message : String(error)
      if (errorMessage.includes("Failed to parse JSON")) {
        throw error
      }
      // Empty responses ARE retried — they're transient (rate limits, free-tier throttling)

      // Only retry on transient errors (network, provider issues)
      if (attempt < options.maxRetries) {
        console.warn(
          `[platform-skills] Attempt ${attempt + 1} failed, retrying in ${options.delayMs}ms:`,
          errorMessage
        )
        await new Promise((resolve) => setTimeout(resolve, options.delayMs))
      }
    }
  }

  throw lastError
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

  const raw = await withRetry(() => executePrompt({ system, user, maxTokens: 4096 }))
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

  const raw = await withRetry(() => executePrompt({ system, user, maxTokens: 4096 }))
  return parseJsonResponse<ImagePromptOutput>(raw)
}
