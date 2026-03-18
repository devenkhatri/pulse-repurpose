/**
 * lib/anthropic.ts
 *
 * All direct LLM calls — chat sidebar, hashtag suggestions, image prompt generation.
 * Uses OpenRouter (openai-compatible API) instead of the Anthropic SDK.
 *
 * Required env var:  OPENROUTER_API_KEY
 * Optional env var:  OPENROUTER_MODEL  (default: "openrouter/auto")
 *                    Set to e.g. "meta-llama/llama-3.1-8b-instruct:free" for a
 *                    specific free-tier model, or leave as "openrouter/auto" to let
 *                    OpenRouter pick the best available model automatically.
 */

import { env } from "@/lib/env"
import { buildBrandVoiceSystemPrompt } from "@/lib/brand-voice"
import { PLATFORM_RULES } from "@/lib/platform-rules"
import type { BrandVoiceProfile, ChatMessage, Platform } from "@/types"

const OPENROUTER_BASE = "https://openrouter.ai/api/v1/chat/completions"

// ---------------------------------------------------------------------------
// executePrompt — exported generic single-turn prompt helper.
// Used by platform skill routes that need a raw LLM call.
// ---------------------------------------------------------------------------

export async function executePrompt(params: {
  system: string
  user: string
  maxTokens?: number
}): Promise<string> {
  return callOpenRouter({
    messages: [
      { role: "system", content: params.system },
      { role: "user", content: params.user },
    ],
    maxTokens: params.maxTokens ?? 2048,
  })
}

// Model to use for all LLM calls — overrideable via OPENROUTER_MODEL
const MODEL =
  (typeof process !== "undefined" && process.env.OPENROUTER_MODEL) ||
  "openrouter/auto"

// ---------------------------------------------------------------------------
// Internal: single HTTP call to OpenRouter
// ---------------------------------------------------------------------------

interface ORMessage {
  role: "system" | "user" | "assistant"
  content: string
}

async function callOpenRouter(params: {
  messages: ORMessage[]
  maxTokens?: number
}): Promise<string> {
  const apiKey = env.OPENROUTER_API_KEY
  if (!apiKey) {
    throw new Error("OPENROUTER_API_KEY is not configured")
  }

  const response = await fetch(OPENROUTER_BASE, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": env.NEXT_PUBLIC_APP_URL,
      "X-Title": "Pulse Repurpose",
    },
    body: JSON.stringify({
      model: MODEL,
      messages: params.messages,
      max_tokens: params.maxTokens ?? 1024,
    }),
  })

  if (!response.ok) {
    const errorBody = await response.text()
    throw new Error(`OpenRouter ${response.status}: ${errorBody}`)
  }

  const data = (await response.json()) as {
    choices: Array<{ message: { content: string } }>
    error?: { message: string }
  }

  if (data.error) {
    throw new Error(`OpenRouter error: ${data.error.message}`)
  }

  const content = data.choices?.[0]?.message?.content
  if (!content) {
    // Log full response to aid debugging (rate-limit, model refusal, etc.)
    console.warn("[openrouter] Empty content in response:", JSON.stringify(data).slice(0, 300))
    throw new Error("Empty response from LLM")
  }

  return content
}

// ---------------------------------------------------------------------------
// generateImagePrompts
// Called by POST /api/trigger/images before firing the n8n image webhook.
// Single call that returns all platform image prompts at once as JSON.
// ---------------------------------------------------------------------------

export async function generateImagePrompts(params: {
  linkedinText: string
  brandVoice: BrandVoiceProfile
  platforms: Platform[]
}): Promise<Partial<Record<Platform, string>>> {
  const { linkedinText, brandVoice, platforms } = params

  const platformsJson = platforms.reduce<Record<string, string>>((acc, p) => {
    acc[p] = `prompt for ${PLATFORM_RULES[p].label} image (${PLATFORM_RULES[p].imageAspectRatio}, ${PLATFORM_RULES[p].imageWidth}x${PLATFORM_RULES[p].imageHeight}px)`
    return acc
  }, {})

  const text = await callOpenRouter({
    maxTokens: 1024,
    messages: [
      {
        role: "user",
        content: `Given this LinkedIn post, generate image generation prompts for each platform listed.
Each prompt should describe a professional, clean image that visually represents the post's key idea.
No text overlays in the image. Match the brand tone: ${brandVoice.toneDescriptors.join(", ")}.

Post:
${linkedinText}

Platforms: ${platforms.join(", ")}

Respond in JSON only, with exactly these keys: ${platforms.join(", ")}
Example format:
${JSON.stringify(platformsJson, null, 2)}`,
      },
    ],
  })

  const jsonMatch =
    text.match(/```(?:json)?\s*([\s\S]*?)```/) ?? text.match(/(\{[\s\S]*\})/)
  const jsonStr = jsonMatch ? (jsonMatch[1] ?? jsonMatch[0]) : text

  try {
    return JSON.parse(jsonStr) as Partial<Record<Platform, string>>
  } catch {
    console.error("[openrouter] Failed to parse image prompts JSON", text)
    return {}
  }
}

// ---------------------------------------------------------------------------
// chatWithAI
// Called by POST /api/chat — interactive in-session edits via the AI sidebar.
// Returns { updatedText, explanation } as structured JSON.
// ---------------------------------------------------------------------------

export async function chatWithAI(params: {
  messages: ChatMessage[]
  currentVariantText: string
  platform: Platform
  brandVoice: BrandVoiceProfile
  instruction: string
}): Promise<{ updatedText: string; explanation: string }> {
  const { messages, currentVariantText, platform, brandVoice, instruction } = params

  const rules = PLATFORM_RULES[platform]

  const systemPrompt = `${buildBrandVoiceSystemPrompt(brandVoice)}

You are editing a ${rules.label} post. Platform rules:
- Max characters: ${rules.maxChars}
- Tone: ${rules.tone}
- Format: ${rules.formatRules}
- Avoid: ${rules.avoidPatterns.join(", ")}

Current post text:
${currentVariantText}

The user will give you an edit instruction. Return ONLY valid JSON in this exact format (no markdown, no code fences):
{"updatedText": "...", "explanation": "one sentence explaining what changed"}`

  const orMessages: ORMessage[] = [
    { role: "system", content: systemPrompt },
    ...messages.map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    })),
    { role: "user", content: instruction },
  ]

  const text = await callOpenRouter({ messages: orMessages, maxTokens: 2048 })

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
// Returns a plain JSON array of hashtag strings (no # prefix).
// ---------------------------------------------------------------------------

export async function generateHashtagSuggestions(params: {
  postText: string
  platform: Platform
  brandVoice: BrandVoiceProfile
  existingHashtags: string[]
  count: number
}): Promise<string[]> {
  const { postText, platform, brandVoice, existingHashtags, count } = params

  const rules = PLATFORM_RULES[platform]

  const text = await callOpenRouter({
    maxTokens: 256,
    messages: [
      {
        role: "user",
        content: `Suggest ${count} hashtags for this ${rules.label} post.
Rules: max ${rules.hashtagCount.max} hashtags for this platform, no # prefix, no spaces.
Brand pillars: ${brandVoice.topicPillars.join(", ") || "none"}.
Already using: ${existingHashtags.join(", ") || "none"} — do not repeat these.

Post:
${postText}

Respond with a JSON array of strings only (no markdown, no code fences):
["hashtag1", "hashtag2", ...]`,
      },
    ],
  })

  const jsonMatch =
    text.match(/```(?:json)?\s*([\s\S]*?)```/) ?? text.match(/(\[[\s\S]*\])/)
  const jsonStr = jsonMatch ? (jsonMatch[1] ?? jsonMatch[0]) : "[]"

  try {
    return (JSON.parse(jsonStr) as string[]).slice(0, count)
  } catch {
    return []
  }
}
