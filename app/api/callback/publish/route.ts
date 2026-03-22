import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { updateStatus, invalidatePostCache } from "@/lib/n8n-sheet"
import { updatePlatformFileMeta } from "@/lib/content-store"
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

const CallbackSchema = z.object({
  postId: z.string().min(1),
  platform: PlatformSchema,
  status: z.enum(["published", "failed"]),
  publishedUrl: z.string().nullable().optional(),
  error: z.string().optional(),
})

// ---------------------------------------------------------------------------
// POST /api/callback/publish
// Called by n8n Workflow 3 after a social post is published (or fails).
// Updates Sheet + content file with final published/failed status.
// ---------------------------------------------------------------------------

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

    const { postId, platform, status, publishedUrl, error } = parseResult.data

    if (status === "published") {
      const now = new Date().toISOString()
      await updateStatus(postId, platform as Platform, "published", { publishedAt: now })
      await updatePlatformFileMeta(postId, platform as Platform, {
        status: "published",
        published_at: now,
        ...(publishedUrl ? { published_url: publishedUrl } : {}),
      })
      console.log(`[callback/publish] Published ${platform} for postId=${postId}`)
    } else {
      // status === "failed"
      console.error(`[callback/publish] Publish failed for ${platform} postId=${postId}:`, error)
      // Revert to "approved" so the user can retry
      await updateStatus(postId, platform as Platform, "approved", { error })
      await updatePlatformFileMeta(postId, platform as Platform, {
        status: "approved",
      })
    }

    invalidatePostCache(postId)
    return NextResponse.json({ received: true })
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error"
    console.error("[callback/publish] Error:", message)
    // Return 200 — n8n should not retry for app-side issues
    return NextResponse.json({ received: true, warning: message })
  }
}
