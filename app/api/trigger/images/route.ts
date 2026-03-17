import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { getPostById, writeImagePrompts } from "@/lib/n8n-sheet"
import { getBrandVoice } from "@/lib/brand-voice"
import { generateImagePrompts } from "@/lib/anthropic"
import { fireImageRepurposeWebhook } from "@/lib/n8n"
import type { Platform } from "@/types"

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

const TriggerImagesSchema = z.object({
  postId: z.string().min(1),
  platforms: z.array(PlatformSchema).min(1),
})

// ---------------------------------------------------------------------------
// POST /api/trigger/images
// Generates image prompts via Claude, writes to Sheet, fires n8n image webhook.
// Always manually triggered — never auto-triggered.
// ---------------------------------------------------------------------------

export async function POST(req: NextRequest) {
  try {
    const body: unknown = await req.json()
    const parseResult = TriggerImagesSchema.safeParse(body)

    if (!parseResult.success) {
      return NextResponse.json(
        { error: "Invalid request body", details: parseResult.error.flatten() },
        { status: 400 }
      )
    }

    const { postId, platforms } = parseResult.data

    // 1. Fetch post from Sheet
    const post = await getPostById(postId)
    if (!post) {
      return NextResponse.json(
        { error: `Post not found: ${postId}` },
        { status: 404 }
      )
    }

    // 2. Load brand voice
    const brandVoice = await getBrandVoice()

    // 3. Generate image prompts via Claude (single fast call)
    let imagePrompts: Partial<Record<Platform, string>>
    try {
      imagePrompts = await generateImagePrompts({
        linkedinText: post.linkedinText,
        brandVoice,
        platforms: platforms as Platform[],
      })
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error"
      return NextResponse.json(
        { success: false, error: `Failed to generate image prompts: ${message}` },
        { status: 502 }
      )
    }

    // 4. Persist prompts to Sheet before firing webhook
    await writeImagePrompts(postId, imagePrompts)

    // 5. Fire the n8n image repurpose webhook
    const result = await fireImageRepurposeWebhook({
      post,
      imagePrompts,
    })

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error ?? "Webhook fire failed" },
        { status: 502 }
      )
    }

    return NextResponse.json({ success: true, imagePrompts })
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error"
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    )
  }
}
