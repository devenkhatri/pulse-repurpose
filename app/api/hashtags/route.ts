import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { callLLMWebhook } from "@/lib/n8n"
import { getBrandVoice } from "@/lib/brand-voice"
import { PLATFORM_RULES } from "@/lib/platform-rules"

// ---------------------------------------------------------------------------
// Zod schema
// ---------------------------------------------------------------------------

const PlatformSchema = z.enum([
  "twitter",
  "threads",
  "instagram",
  "facebook",
  "skool",
  "linkedin",
])

const HashtagsRequestSchema = z.object({
  postText: z.string().min(1),
  platform: PlatformSchema,
  existingHashtags: z.array(z.string()).default([]),
})

// ---------------------------------------------------------------------------
// POST /api/hashtags
// Calls the n8n LLM proxy webhook and returns { suggestions: string[] }.
// ---------------------------------------------------------------------------

export async function POST(req: NextRequest) {
  try {
    const body: unknown = await req.json()
    const parseResult = HashtagsRequestSchema.safeParse(body)

    if (!parseResult.success) {
      return NextResponse.json(
        { error: "Invalid request body", details: parseResult.error.flatten() },
        { status: 400 }
      )
    }

    const { postText, platform, existingHashtags } = parseResult.data
    const brandVoice = await getBrandVoice()
    const rules = PLATFORM_RULES[platform]
    const count = 8

    const text = await callLLMWebhook({
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

    let suggestions: string[]
    try {
      suggestions = (JSON.parse(jsonStr) as string[]).slice(0, count)
    } catch {
      suggestions = []
    }

    return NextResponse.json({ suggestions })
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error"
    if (message.includes("N8N_LLM_WEBHOOK_URL")) {
      return NextResponse.json(
        { error: "LLM webhook not configured — set N8N_LLM_WEBHOOK_URL in .env.local" },
        { status: 503 }
      )
    }
    console.error("[api/hashtags] LLM webhook error:", message)
    return NextResponse.json(
      { error: `Hashtag suggestion failed: ${message}` },
      { status: 502 }
    )
  }
}
