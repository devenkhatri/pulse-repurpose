import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { getPostById, writeImagePrompts } from "@/lib/n8n-sheet"
import { updatePlatformFileMeta } from "@/lib/content-store"
import { fireImageRepurposeWebhook } from "@/lib/n8n"
import { executePlatformImageSkill } from "@/lib/platform-skills"
import type { Platform, ImagePromptOutput } from "@/types"

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
//
// Updated flow (Session 8 — Platform Skills):
// 1. Fetch post from Sheet
// 2. Execute image platform skills in parallel → per-platform ImagePromptOutput
// 3. Persist image prompts to Sheet
// 4. Fire n8n image repurpose webhook with pre-built full image payloads
//
// n8n receives complete { prompt, sourceImageUrl, styleDirectives, negativePrompt }
// per platform and passes them directly to fal.ai.
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

    const rawPlatforms = parseResult.data.platforms
    const { postId } = parseResult.data
    const targetPlatforms = rawPlatforms.filter((p) => p !== "linkedin") as Platform[]

    // 1. Fetch post from Sheet
    const post = await getPostById(postId)
    if (!post) {
      return NextResponse.json(
        { error: `Post not found: ${postId}` },
        { status: 404 }
      )
    }

    // 2. Execute image platform skills in parallel
    const skillResults = await Promise.allSettled(
      targetPlatforms.map((platform) =>
        executePlatformImageSkill({
          postId,
          platform,
          linkedinText: post.linkedinText,
          sourceImageUrl: post.linkedinImageUrl ?? null,
        }).then((output) => ({ platform, output }))
      )
    )

    const imagePayloads: Partial<Record<Platform, ImagePromptOutput>> = {}
    const skillErrors: string[] = []

    for (const result of skillResults) {
      if (result.status === "fulfilled") {
        imagePayloads[result.value.platform] = result.value.output
      } else {
        skillErrors.push(String(result.reason))
        console.error("[trigger/images] Image skill failed:", result.reason)
      }
    }

    if (Object.keys(imagePayloads).length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: "All platform image skills failed",
          details: skillErrors,
        },
        { status: 502 }
      )
    }

    // 3. Persist image prompts to Sheet + content files (best-effort)
    const imagePromptStrings: Partial<Record<Platform, string>> = {}
    for (const [p, payload] of Object.entries(imagePayloads)) {
      const ip = payload as ImagePromptOutput
      imagePromptStrings[p as Platform] = ip.prompt
      // Persist to content file
      updatePlatformFileMeta(postId, p as Platform, {
        image_prompt: ip.prompt,
      }).catch(() => {})
    }

    await writeImagePrompts(postId, imagePromptStrings).catch((e) => {
      console.warn("[trigger/images] writeImagePrompts failed:", e)
    })

    // 4. Fire the n8n image repurpose webhook with full image payloads
    const webhookResult = await fireImageRepurposeWebhook({
      post,
      imagePayloads,
    })

    if (!webhookResult.success) {
      return NextResponse.json(
        { success: false, error: webhookResult.error ?? "Webhook fire failed" },
        { status: 502 }
      )
    }

    return NextResponse.json({
      success: true,
      ...(skillErrors.length > 0 ? { warnings: skillErrors } : {}),
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error"
    console.error("[trigger/images] Unexpected error:", message)
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    )
  }
}
