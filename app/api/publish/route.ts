import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { getPostById, updateStatus } from "@/lib/n8n-sheet"
import { updatePlatformFileMeta } from "@/lib/content-store"
import { firePublishWebhook } from "@/lib/n8n"
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

const PublishSchema = z.object({
  postId: z.string().min(1),
  platform: PlatformSchema,
  scheduledAt: z.string().nullable().default(null),
})

// ---------------------------------------------------------------------------
// POST /api/publish
// Validates approval status, builds payload, fires n8n publish webhook.
// ---------------------------------------------------------------------------

export async function POST(req: NextRequest) {
  try {
    const body: unknown = await req.json()
    const parseResult = PublishSchema.safeParse(body)

    if (!parseResult.success) {
      return NextResponse.json(
        { error: "Invalid request body", details: parseResult.error.flatten() },
        { status: 400 }
      )
    }

    const { postId, platform, scheduledAt } = parseResult.data

    // 1. Fetch post from Sheet
    const post = await getPostById(postId)
    if (!post) {
      return NextResponse.json(
        { error: `Post not found: ${postId}` },
        { status: 404 }
      )
    }

    const variant = post.platforms[platform as Platform]

    // 2. Validate text exists and status is approved
    if (!variant?.text) {
      return NextResponse.json(
        { success: false, error: "No text available for this platform" },
        { status: 422 }
      )
    }

    if (variant.status !== "approved") {
      return NextResponse.json(
        {
          success: false,
          error: `Platform status must be 'approved' before publishing (current: ${variant.status})`,
        },
        { status: 422 }
      )
    }

    // 3. Build publish payload
    const { env } = await import("@/lib/env")
    const publishPayload = {
      platform: platform as Platform,
      text: variant.text,
      imageUrl: variant.imageUrl ?? null,
      hashtags: variant.hashtags ?? [],
      scheduledAt,
      sheetRowId: post.id,
      postId,
      callbackUrl: `${env.NEXT_PUBLIC_APP_URL}/api/callback/publish`,
    }

    // 4. Fire publish webhook
    const result = await firePublishWebhook(publishPayload)

    if (!result.success) {
      // Keep status as approved — user can retry
      await updateStatus(postId, platform as Platform, "approved", {
        error: result.error,
      })
      await updatePlatformFileMeta(postId, platform as Platform, {
        status: "approved",
      })

      return NextResponse.json(
        { success: false, error: result.error ?? "Publish webhook failed" },
        { status: 502 }
      )
    }

    // 5. Update Sheet + content file status
    // Immediate publishes → "published" right away (n8n will also call /api/callback/publish)
    // Scheduled publishes → "scheduled" until n8n calls back after the post goes live
    const newStatus = scheduledAt ? "scheduled" : "published"
    const now = new Date().toISOString()
    await updateStatus(postId, platform as Platform, newStatus, {
      publishedAt: scheduledAt ? undefined : now,
    })
    await updatePlatformFileMeta(postId, platform as Platform, {
      status: newStatus,
      scheduled_at: scheduledAt ?? null,
      published_at: scheduledAt ? null : now,
    })

    return NextResponse.json({ success: true })
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error"
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    )
  }
}
