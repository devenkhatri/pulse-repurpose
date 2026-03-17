import Anthropic from "@anthropic-ai/sdk"
import { env } from "@/lib/env"
import { buildBrandVoiceSystemPrompt } from "@/lib/brand-voice"
import { PLATFORM_RULES } from "@/lib/platform-rules"
import type { BrandVoiceProfile, ChatMessage, Platform } from "@/types"

// Model used for all direct Claude calls (chat sidebar + image prompts + hashtags)
const MODEL = "claude-sonnet-4-5-20251101"

function getClient(): Anthropic {
  if (!env.ANTHROPIC_API_KEY || env.ANTHROPIC_API_KEY === "your_key_here") {
    throw new Error("ANTHROPIC_API_KEY is not configured")
  }
  return new Anthropic({ apiKey: env.ANTHROPIC_API_KEY })
}

// ---------------------------------------------------------------------------
// generateImagePrompts
// Called by POST /api/trigger/images before firing the n8n image webhook.
// Single Claude call that returns all platform image prompts at once.
// ---------------------------------------------------------------------------

export async function generateImagePrompts(params: {
  linkedinText: string
  brandVoice: BrandVoiceProfile
  platforms: Platform[]
}): Promise<Partial<Record<Platform, string>>> {
  const { linkedinText, brandVoice, platforms } = params
  const client = getClient()

  const platformsJson = platforms.reduce<Record<string, string>>((acc, p) => {
    acc[p] = `prompt for ${PLATFORM_RULES[p].label} image (${PLATFORM_RULES[p].imageAspectRatio}, ${PLATFORM_RULES[p].imageWidth}x${PLATFORM_RULES[p].imageHeight}px)`
    return acc
  }, {})

  const prompt = `Given this LinkedIn post, generate image generation prompts for each platform listed.
Each prompt should describe a professional, clean image that visually represents the post's key idea.
No text overlays in the image. Match the brand tone: ${brandVoice.toneDescriptors.join(", ")}.

Post:
${linkedinText}

Platforms: ${platforms.join(", ")}

Respond in JSON only, with exactly these keys: ${platforms.join(", ")}
Example format:
${JSON.stringify(platformsJson, null, 2)}`

  const message = await client.messages.create({
    model: MODEL,
    max_tokens: 1024,
    messages: [{ role: "user", content: prompt }],
  })

  const text =
    message.content[0].type === "text" ? message.content[0].text : ""

  // Extract JSON — handle markdown code fences
  const jsonMatch =
    text.match(/```(?:json)?\s*([\s\S]*?)```/) ?? text.match(/(\{[\s\S]*\})/)
  const jsonStr = jsonMatch ? (jsonMatch[1] ?? jsonMatch[0]) : text

  try {
    return JSON.parse(jsonStr) as Partial<Record<Platform, string>>
  } catch {
    // If parsing fails, return empty (caller will handle gracefully)
    console.error("[anthropic] Failed to parse image prompts JSON", text)
    return {}
  }
}

// ---------------------------------------------------------------------------
// chatWithAI
// Called by POST /api/chat — interactive in-session edits.
// Fully implemented in Session 7; stub here so routes can import it now.
// ---------------------------------------------------------------------------

export async function chatWithAI(params: {
  messages: ChatMessage[]
  currentVariantText: string
  platform: Platform
  brandVoice: BrandVoiceProfile
  instruction: string
}): Promise<{ updatedText: string; explanation: string }> {
  const { messages, currentVariantText, platform, brandVoice, instruction } =
    params
  const client = getClient()

  const rules = PLATFORM_RULES[platform]
  const systemPrompt = `${buildBrandVoiceSystemPrompt(brandVoice)}

You are editing a ${rules.label} post. Platform rules:
- Max characters: ${rules.maxChars}
- Tone: ${rules.tone}
- Format: ${rules.formatRules}
- Avoid: ${rules.avoidPatterns.join(", ")}

Current post text:
${currentVariantText}

The user will give you an edit instruction. Return ONLY valid JSON in this exact format:
{"updatedText": "...", "explanation": "one sentence explaining what changed"}`

  const anthropicMessages: Anthropic.MessageParam[] = [
    ...messages.map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    })),
    { role: "user", content: instruction },
  ]

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 2048,
    system: systemPrompt,
    messages: anthropicMessages,
  })

  const text =
    response.content[0].type === "text" ? response.content[0].text : ""
  const jsonMatch =
    text.match(/```(?:json)?\s*([\s\S]*?)```/) ?? text.match(/(\{[\s\S]*\})/)
  const jsonStr = jsonMatch ? (jsonMatch[1] ?? jsonMatch[0]) : text

  try {
    return JSON.parse(jsonStr) as { updatedText: string; explanation: string }
  } catch {
    return { updatedText: currentVariantText, explanation: "Could not parse AI response" }
  }
}

// ---------------------------------------------------------------------------
// generateHashtagSuggestions
// Called by POST /api/hashtags.
// Fully implemented in Session 7; minimal implementation here.
// ---------------------------------------------------------------------------

export async function generateHashtagSuggestions(params: {
  postText: string
  platform: Platform
  brandVoice: BrandVoiceProfile
  existingHashtags: string[]
  count: number
}): Promise<string[]> {
  const { postText, platform, brandVoice, existingHashtags, count } = params
  const client = getClient()

  const rules = PLATFORM_RULES[platform]

  const prompt = `Suggest ${count} hashtags for this ${rules.label} post.
Rules: max ${rules.hashtagCount.max} hashtags for this platform, no # prefix, no spaces.
Brand pillars: ${brandVoice.topicPillars.join(", ") || "none"}.
Already using: ${existingHashtags.join(", ") || "none"} — do not repeat these.

Post:
${postText}

Respond with a JSON array of strings only:
["hashtag1", "hashtag2", ...]`

  const message = await client.messages.create({
    model: MODEL,
    max_tokens: 256,
    messages: [{ role: "user", content: prompt }],
  })

  const text =
    message.content[0].type === "text" ? message.content[0].text : "[]"
  const jsonMatch =
    text.match(/```(?:json)?\s*([\s\S]*?)```/) ?? text.match(/(\[[\s\S]*\])/)
  const jsonStr = jsonMatch ? (jsonMatch[1] ?? jsonMatch[0]) : "[]"

  try {
    return (JSON.parse(jsonStr) as string[]).slice(0, count)
  } catch {
    return []
  }
}
