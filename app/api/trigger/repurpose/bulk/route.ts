import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { getPostById, writeContentPrompts } from "@/lib/n8n-sheet"
import { fireContentRepurposeWebhook } from "@/lib/n8n"
import { writeSourceFile, updatePlatformFileMeta } from "@/lib/content-store"
import { executePlatformContentSkill } from "@/lib/platform-skills"
import type { Platform, LinkedInPost, ContentPromptOutput } from "@/types"

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const ALL_PLATFORMS: Platform[] = ["twitter", "threads", "instagram", "facebook", "skool"]
const MAX_POSTS = 20
const INTER_POST_DELAY_MS = 2000

const PlatformSchema = z.enum(["twitter", "threads", "instagram", "facebook", "skool", "linkedin"])

const BulkRepurposeSchema = z.object({
  postIds: z.array(z.string().min(1)).min(1).max(MAX_POSTS),
  platforms: z.array(PlatformSchema).optional(),
})

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type BulkPostResult = {
  postId: string
  status: "queued" | "skipped" | "failed"
  reason?: string
}

export type BulkRepurposeResponse = {
  success: boolean
  summary: { queued: number; skipped: number; failed: number; total: number }
  results: BulkPostResult[]
  error?: string
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function sleep(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms))
}

async function processPost(post: LinkedInPost, platforms: Platform[]): Promise<BulkPostResult> {
  const postId = post.id

  // Only queue posts where ALL target platforms are pending
  const allPending = platforms.every((p) => post.platforms[p]?.status === "pending")
  if (!allPending) {
    return { postId, status: "skipped", reason: "One or more platforms not pending" }
  }

  // Write _source.md (idempotent)
  await writeSourceFile(post).catch(() => {})

  // Execute content platform skills — staggered 500ms to avoid LLM rate limits
  const skillResults = await Promise.allSettled(
    platforms.map((platform, i) =>
      new Promise<void>((resolve) => setTimeout(resolve, i * 500))
        .then(() =>
          executePlatformContentSkill({
            postId,
            platform,
            linkedinText: post.linkedinText,
          })
        )
        .then((output) => ({ platform, output }))
    )
  )

  const contentPrompts: Partial<Record<Platform, ContentPromptOutput>> = {}
  for (const result of skillResults) {
    if (result.status === "fulfilled") {
      contentPrompts[result.value.platform] = result.value.output
    } else {
      console.warn(`[bulk] Skill failed for ${postId}:`, result.reason)
    }
  }

  if (Object.keys(contentPrompts).length === 0) {
    return { postId, status: "failed", reason: "All platform content skills failed" }
  }

  // Persist content prompts to Sheet + content files
  const promptStrings: Partial<Record<Platform, string>> = {}
  for (const [p, prompt] of Object.entries(contentPrompts)) {
    const cp = prompt as ContentPromptOutput
    promptStrings[p as Platform] = JSON.stringify({
      systemPrompt: cp.systemPrompt,
      userPrompt: cp.userPrompt,
    })
    updatePlatformFileMeta(postId, p as Platform, {
      content_prompt_preview: cp.userPrompt?.slice(0, 200),
    }).catch(() => {})
  }

  await writeContentPrompts(postId, promptStrings).catch((e) => {
    console.warn(`[bulk] writeContentPrompts failed for ${postId}:`, e)
  })

  // Fire n8n content repurpose webhook
  const webhookResult = await fireContentRepurposeWebhook({
    post,
    platforms: Object.keys(contentPrompts) as Platform[],
    contentPrompts,
  })

  if (!webhookResult.success) {
    return {
      postId,
      status: "failed",
      reason: webhookResult.error ?? "n8n webhook failed",
    }
  }

  return { postId, status: "queued" }
}

// ---------------------------------------------------------------------------
// POST /api/trigger/repurpose/bulk
//
// Accepts { postIds, platforms? } — processes posts sequentially with a 2s
// delay between each to avoid n8n rate limits. Only queues posts where ALL
// target platforms are `pending`; skips any in-progress or already-repurposed
// posts. Returns per-post results.
// ---------------------------------------------------------------------------

export async function POST(req: NextRequest) {
  try {
    const body: unknown = await req.json()
    const parseResult = BulkRepurposeSchema.safeParse(body)

    if (!parseResult.success) {
      return NextResponse.json(
        { error: "Invalid request body", details: parseResult.error.flatten() },
        { status: 400 }
      )
    }

    const { postIds, platforms = ALL_PLATFORMS } = parseResult.data
    const targetPlatforms = platforms.filter((p) => p !== "linkedin") as Platform[]

    console.log(
      `[trigger/repurpose/bulk] Processing ${postIds.length} posts on platforms: ${targetPlatforms.join(", ")}`
    )

    const results: BulkPostResult[] = []

    for (let i = 0; i < postIds.length; i++) {
      if (i > 0) await sleep(INTER_POST_DELAY_MS)

      const postId = postIds[i]
      let result: BulkPostResult

      try {
        const post = await getPostById(postId)
        if (!post) {
          result = { postId, status: "failed", reason: "Post not found" }
        } else {
          result = await processPost(post, targetPlatforms)
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : "Unknown error"
        result = { postId, status: "failed", reason: message }
      }

      console.log(`[trigger/repurpose/bulk] ${postId}: ${result.status}${result.reason ? ` — ${result.reason}` : ""}`)
      results.push(result)
    }

    const queued = results.filter((r) => r.status === "queued").length
    const skipped = results.filter((r) => r.status === "skipped").length
    const failed = results.filter((r) => r.status === "failed").length

    console.log(
      `[trigger/repurpose/bulk] Done — queued: ${queued}, skipped: ${skipped}, failed: ${failed}`
    )

    return NextResponse.json({
      success: true,
      summary: { queued, skipped, failed, total: results.length },
      results,
    } satisfies BulkRepurposeResponse)
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error"
    console.error("[trigger/repurpose/bulk] Unexpected error:", message)
    return NextResponse.json(
      { success: false, error: message } as BulkRepurposeResponse,
      { status: 500 }
    )
  }
}
