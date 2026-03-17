import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { generateHashtagSuggestions } from "@/lib/anthropic"
import { getBrandVoice } from "@/lib/brand-voice"

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
// Calls Claude directly and returns { suggestions: string[] }.
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

    const suggestions = await generateHashtagSuggestions({
      postText,
      platform,
      brandVoice,
      existingHashtags,
      count: 8,
    })

    return NextResponse.json({ suggestions })
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error"
    if (message.includes("OPENROUTER_API_KEY")) {
      return NextResponse.json(
        { error: "OpenRouter API not configured — set OPENROUTER_API_KEY in .env.local" },
        { status: 503 }
      )
    }
    console.error("[api/hashtags] OpenRouter API error:", message)
    return NextResponse.json(
      { error: `Hashtag suggestion failed: ${message}` },
      { status: 502 }
    )
  }
}
