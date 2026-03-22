import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { getPostById, invalidatePostCache, updateMultiplePlatforms } from "@/lib/n8n-sheet"
import { writePlatformFile } from "@/lib/content-store"
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
// POST /api/callback/repurpose
// Called by n8n Workflow 1 when text generation is complete.
//
// Polling model (Option A):
// The UI polls /api/posts/[id] every 3 seconds while generationStatus is
// 'generating_text'. This callback just writes content files and returns 200.
// The next poll cycle will pick up the updated Sheet data.
//
// Option B (SSE) can replace this for better UX in a future iteration.
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
      console.error(`[callback/repurpose] Generation failed for ${postId}:`, error)
      // Mark all platforms as failed in Sheet so the UI stops polling
      const failedVariants = Object.fromEntries(
        PLATFORMS.map((p) => [p, { status: "failed" as const, error: error ?? "n8n generation failed" }])
      ) as Partial<Record<Platform, { status: "failed"; error: string }>>
      await updateMultiplePlatforms(postId, failedVariants).catch(() => {})
      return NextResponse.json({ received: true })
    }

    // Re-fetch the post from Sheet — n8n has already written the text variants.
    // Invalidate first so we bypass any stale cached snapshot from before generation.
    invalidatePostCache(postId)
    const post = await getPostById(postId)
    if (!post) {
      console.warn(`[callback/repurpose] Post not found in Sheet: ${postId}`)
      return NextResponse.json({ received: true })
    }

    // Write platform content files for all platforms that now have text
    const writePromises = PLATFORMS.map(async (platform) => {
      const variant = post.platforms[platform]
      if (variant?.text) {
        await writePlatformFile(postId, platform, variant)
      }
    })

    await Promise.allSettled(writePromises)

    return NextResponse.json({ received: true })
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error"
    console.error("[callback/repurpose] Error:", message)
    // Return 200 even on error — n8n should not retry callbacks for app-side issues
    return NextResponse.json({ received: true, warning: message })
  }
}
