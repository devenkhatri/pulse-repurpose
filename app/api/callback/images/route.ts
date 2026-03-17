import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { getPostById } from "@/lib/n8n-sheet"
import { updatePlatformFileMeta } from "@/lib/content-store"
import type { Platform } from "@/types"

// ---------------------------------------------------------------------------
// Zod schema
// ---------------------------------------------------------------------------

const CallbackSchema = z.object({
  postId: z.string().min(1),
  status: z.enum(["done", "failed"]),
  error: z.string().optional(),
})

// ---------------------------------------------------------------------------
// POST /api/callback/images
// Called by n8n Workflow 2 when image generation is complete.
// n8n has already written image URLs back to the Sheet before calling this.
// Updates content file frontmatter (image_url, image_prompt) for each platform.
//
// Polling model (Option A) — same as callback/repurpose.
// ---------------------------------------------------------------------------

const PLATFORMS: Platform[] = [
  "twitter",
  "threads",
  "instagram",
  "facebook",
  "skool",
]

export async function POST(req: NextRequest) {
  try {
    const body: unknown = await req.json()
    const parseResult = CallbackSchema.safeParse(body)

    if (!parseResult.success) {
      return NextResponse.json(
        { error: "Invalid callback payload", details: parseResult.error.flatten() },
        { status: 400 }
      )
    }

    const { postId, status, error } = parseResult.data

    if (status === "failed") {
      console.error(`[callback/images] Image generation failed for ${postId}:`, error)
      return NextResponse.json({ received: true })
    }

    // Re-fetch post — n8n has written image URLs to Sheet
    const post = await getPostById(postId)
    if (!post) {
      console.warn(`[callback/images] Post not found in Sheet: ${postId}`)
      return NextResponse.json({ received: true })
    }

    // Update image_url + image_prompt frontmatter in existing content files
    const updatePromises = PLATFORMS.map(async (platform) => {
      const variant = post.platforms[platform]
      if (variant?.imageUrl) {
        await updatePlatformFileMeta(postId, platform, {
          image_url: variant.imageUrl,
          image_prompt: variant.imagePrompt ?? null,
        })
      }
    })

    await Promise.allSettled(updatePromises)

    return NextResponse.json({ received: true })
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error"
    console.error("[callback/images] Error:", message)
    return NextResponse.json({ received: true, warning: message })
  }
}
