import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { getPostById } from "@/lib/n8n-sheet"
import { getBrandVoice } from "@/lib/brand-voice"
import { getHashtagBank } from "@/lib/hashtag-bank"
import { fireContentRepurposeWebhook } from "@/lib/n8n"
import { writeSourceFile } from "@/lib/content-store"
import type { Platform } from "@/types"

// ---------------------------------------------------------------------------
// Zod schema
// ---------------------------------------------------------------------------

const ALL_PLATFORMS: Platform[] = [
  "twitter",
  "threads",
  "instagram",
  "facebook",
  "skool",
]

const PlatformSchema = z.enum([
  "twitter",
  "threads",
  "instagram",
  "facebook",
  "skool",
  "linkedin",
])

const TriggerRepurposeSchema = z.object({
  postId: z.string().min(1),
  platforms: z.array(PlatformSchema).optional(),
})

// ---------------------------------------------------------------------------
// POST /api/trigger/repurpose
// Fires the n8n content repurpose webhook.
// Called manually (user clicks Repurpose) or automatically (auto-trigger).
// ---------------------------------------------------------------------------

export async function POST(req: NextRequest) {
  try {
    const body: unknown = await req.json()
    const parseResult = TriggerRepurposeSchema.safeParse(body)

    if (!parseResult.success) {
      return NextResponse.json(
        { error: "Invalid request body", details: parseResult.error.flatten() },
        { status: 400 }
      )
    }

    const { postId, platforms = ALL_PLATFORMS } = parseResult.data

    // 1. Fetch post from Sheet
    const post = await getPostById(postId)
    if (!post) {
      return NextResponse.json(
        { error: `Post not found: ${postId}` },
        { status: 404 }
      )
    }

    // 2. Write _source.md (idempotent — won't overwrite if it already exists)
    await writeSourceFile(post)

    // 3. Load brand voice + hashtag bank
    const [brandVoice, hashtagBank] = await Promise.all([
      getBrandVoice(),
      getHashtagBank(),
    ])

    // 4. Fire the n8n content repurpose webhook
    const result = await fireContentRepurposeWebhook({
      post,
      platforms: platforms as Platform[],
      brandVoice,
      hashtagBank,
    })

    if (!result.success) {
      const errMsg = result.error ?? "Webhook fire failed"
      console.error("[trigger/repurpose] n8n webhook error:", errMsg)
      return NextResponse.json(
        { success: false, error: `n8n webhook: ${errMsg}` },
        { status: 502 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error"
    console.error("[trigger/repurpose] Unexpected error:", message)
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    )
  }
}
