import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { getPostById, writeContentPrompts } from "@/lib/n8n-sheet"
import { fireContentRepurposeWebhook } from "@/lib/n8n"
import { writeSourceFile, updatePlatformFileMeta } from "@/lib/content-store"
import { executePlatformContentSkill } from "@/lib/platform-skills"
import type { Platform, ContentPromptOutput } from "@/types"

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
//
// Updated flow (Session 8 — Platform Skills):
// 1. Fetch post from Sheet
// 2. Write _source.md (idempotent)
// 3. Execute content platform skills in parallel → per-platform prompt payloads
// 4. Persist content prompts to Sheet
// 5. Fire n8n content repurpose webhook with pre-built prompt payloads
//
// n8n no longer builds prompts from brand voice — it receives ready-to-use
// system + user prompt pairs per platform and passes them directly to Claude.
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
    const targetPlatforms = platforms.filter((p) => p !== "linkedin") as Platform[]

    // 1. Fetch post from Sheet
    const post = await getPostById(postId)
    if (!post) {
      return NextResponse.json(
        { error: `Post not found: ${postId}` },
        { status: 404 }
      )
    }

    // 2. Write _source.md (idempotent — won't overwrite if already exists)
    await writeSourceFile(post).catch(() => {})

    // 3. Execute content platform skills — staggered to avoid free-tier rate limits
    console.log(`[trigger/repurpose] Running skills for platforms: ${targetPlatforms.join(", ")}`)
    const skillResults = await Promise.allSettled(
      targetPlatforms.map((platform, i) =>
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
    const skillErrors: string[] = []

    for (const result of skillResults) {
      if (result.status === "fulfilled") {
        console.log(`[trigger/repurpose] Skill OK: ${result.value.platform}`)
        contentPrompts[result.value.platform] = result.value.output
      } else {
        skillErrors.push(String(result.reason))
        console.error("[trigger/repurpose] Skill failed:", result.reason)
      }
    }

    console.log(
      `[trigger/repurpose] Skills complete — OK: ${Object.keys(contentPrompts).join(", ") || "none"}, failed: ${skillErrors.length}`
    )

    if (Object.keys(contentPrompts).length === 0) {
      console.error("[trigger/repurpose] All skills failed — webhook NOT fired")
      return NextResponse.json(
        {
          success: false,
          error: "All platform content skills failed",
          details: skillErrors,
        },
        { status: 502 }
      )
    }

    // 4. Persist content prompts to Sheet + content files (best-effort)
    const promptStrings: Partial<Record<Platform, string>> = {}
    for (const [p, prompt] of Object.entries(contentPrompts)) {
      const cp = prompt as ContentPromptOutput
      promptStrings[p as Platform] = JSON.stringify({
        systemPrompt: cp.systemPrompt,
        userPrompt: cp.userPrompt,
      })
      // Also persist preview to content file
      updatePlatformFileMeta(postId, p as Platform, {
        content_prompt_preview: cp.userPrompt?.slice(0, 200),
      }).catch(() => {})
    }

    await writeContentPrompts(postId, promptStrings).catch((e) => {
      console.warn("[trigger/repurpose] writeContentPrompts failed:", e)
    })

    // 5. Fire the n8n content repurpose webhook with pre-built prompts
    const webhookUrl = process.env.N8N_CONTENT_REPURPOSE_WEBHOOK_URL
    console.log(
      `[trigger/repurpose] Firing n8n webhook — url configured: ${!!webhookUrl}, platforms: ${Object.keys(contentPrompts).join(", ")}`
    )
    const webhookResult = await fireContentRepurposeWebhook({
      post,
      platforms: Object.keys(contentPrompts) as Platform[],
      contentPrompts,
    })

    if (!webhookResult.success) {
      const errMsg = webhookResult.error ?? "Webhook fire failed"
      console.error("[trigger/repurpose] n8n webhook error:", errMsg)
      return NextResponse.json(
        { success: false, error: `n8n webhook: ${errMsg}` },
        { status: 502 }
      )
    }

    console.log("[trigger/repurpose] n8n webhook fired successfully")
    return NextResponse.json({
      success: true,
      ...(skillErrors.length > 0 ? { warnings: skillErrors } : {}),
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error"
    console.error("[trigger/repurpose] Unexpected error:", message)
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    )
  }
}
