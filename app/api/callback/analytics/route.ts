import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { getAllPosts, invalidatePostCache } from "@/lib/n8n-sheet"
import { appendToLearnings } from "@/lib/docs-sync"
import type { Platform } from "@/types"

// ---------------------------------------------------------------------------
// Zod schema
// ---------------------------------------------------------------------------

const CallbackSchema = z.object({
  fetched: z.number().int().min(0),
  failed: z.number().int().min(0),
  timestamp: z.string().min(1),
})

// ---------------------------------------------------------------------------
// POST /api/callback/analytics
//
// Called by n8n Workflow 4 after engagement metrics have been written to the
// Sheet. Invalidates all post caches and runs Cron Operation 9 logic inline:
//   - High performers (engagementRate ≥ 5%) → learnings.md content section
//   - Low performers (engagementRate < 1%, ≥ 10 impressions) → patterns to avoid
// ---------------------------------------------------------------------------

const PLATFORMS: Platform[] = ["twitter", "threads", "instagram", "facebook"]
const HIGH_PERFORMER_THRESHOLD = 5   // % engagement rate
const LOW_PERFORMER_THRESHOLD = 1    // %
const MIN_IMPRESSIONS_FOR_LOW = 10   // avoid flagging posts nobody saw

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

    const { fetched, failed, timestamp } = parseResult.data
    console.log(`[callback/analytics] Received: fetched=${fetched}, failed=${failed}, ts=${timestamp}`)

    // Invalidate post list caches so fresh analytics data is loaded
    // (individual IDs unknown here, so we just let getAllPosts re-fetch)

    // Run Operation 9 — performance learning
    try {
      const posts = await getAllPosts({})

      for (const post of posts) {
        for (const platform of PLATFORMS) {
          const v = post.platforms[platform]
          if (!v?.fetchedAt || v.engagementRate == null) continue

          if (v.engagementRate >= HIGH_PERFORMER_THRESHOLD) {
            const preview = post.linkedinText.slice(0, 80).replace(/\n/g, " ")
            await appendToLearnings(
              platform,
              `${platform}: HIGH performer — post ${post.id} ` +
              `(${v.engagementRate.toFixed(1)}% engagement, ${v.impressions ?? 0} impressions). ` +
              `Preview: "${preview}...". ` +
              `Pattern: ${v.hashtags?.length ? `hashtags=[${v.hashtags.slice(0, 3).join(",")}]` : "no hashtags"}.`
            ).catch(() => {})
          } else if (
            v.engagementRate < LOW_PERFORMER_THRESHOLD &&
            (v.impressions ?? 0) >= MIN_IMPRESSIONS_FOR_LOW
          ) {
            const preview = post.linkedinText.slice(0, 80).replace(/\n/g, " ")
            await appendToLearnings(
              platform,
              `${platform}: LOW performer — post ${post.id} ` +
              `(${v.engagementRate.toFixed(1)}% engagement, ${v.impressions ?? 0} impressions). ` +
              `Preview: "${preview}...". ` +
              `Avoid similar tone/format on this platform.`
            ).catch(() => {})
          }

          // Invalidate individual post cache
          invalidatePostCache(post.id)
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error("[callback/analytics] Op9 learning update failed:", msg)
    }

    return NextResponse.json({ received: true, fetched, failed })
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error"
    console.error("[callback/analytics] Error:", message)
    return NextResponse.json({ received: true, warning: message })
  }
}
