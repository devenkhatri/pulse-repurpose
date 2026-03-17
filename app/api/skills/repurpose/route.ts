import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { getPostById, writeContentPrompts, writeImagePrompts } from "@/lib/n8n-sheet"
import { writeSourceFile } from "@/lib/content-store"
import { fireContentRepurposeWebhook, fireImageRepurposeWebhook } from "@/lib/n8n"
import {
  executePlatformContentSkill,
  executePlatformImageSkill,
} from "@/lib/platform-skills"
import type { Platform, ContentPromptOutput, ImagePromptOutput } from "@/types"

// ---------------------------------------------------------------------------
// Zod schema
// ---------------------------------------------------------------------------

const ALL_PLATFORMS: Platform[] = ["twitter", "threads", "instagram", "facebook", "skool"]

const PlatformSchema = z.enum(["twitter", "threads", "instagram", "facebook", "skool"])

const RequestSchema = z.object({
  postId: z.string().min(1),
  platforms: z.array(PlatformSchema).optional(),
  mode: z.enum(["content", "images", "both"]).default("content"),
})

// ---------------------------------------------------------------------------
// GET /api/skills/repurpose — health/info (browser-friendly)
// ---------------------------------------------------------------------------

export function GET() {
  return NextResponse.json({
    endpoint: "POST /api/skills/repurpose",
    description: "Master repurpose skill executor — runs platform skills in parallel and fires n8n webhooks.",
    body: {
      postId: "string",
      platforms: "Platform[] (optional, defaults to all 5)",
      mode: "content | images | both (default: content)",
    },
  })
}

// ---------------------------------------------------------------------------
// POST /api/skills/repurpose
//
// Memory-aware master repurpose skill executor — 8-step runbook:
//
// Step 1  — Fetch source post from Sheet
// Step 2  — Write _source.md (idempotent)
// Step 3  — Execute content platform skills in parallel → ContentPromptOutput per platform
// Step 4  — Persist content prompts to Sheet
// Step 5  — Fire content repurpose webhook with pre-built prompt payloads
// Step 6  — (mode: 'images' or 'both') Execute image platform skills in parallel
// Step 7  — Persist image prompts to Sheet
// Step 8  — Fire image repurpose webhook with pre-built image payloads
// ---------------------------------------------------------------------------

export async function POST(req: NextRequest) {
  try {
    const body: unknown = await req.json()
    const parseResult = RequestSchema.safeParse(body)

    if (!parseResult.success) {
      return NextResponse.json(
        { error: "Invalid request body", details: parseResult.error.flatten() },
        { status: 400 }
      )
    }

    const { postId, platforms = ALL_PLATFORMS, mode } = parseResult.data
    const targetPlatforms = platforms as Platform[]

    // ── Step 1 — Fetch post ──────────────────────────────────────────────────
    const post = await getPostById(postId)
    if (!post) {
      return NextResponse.json({ error: `Post not found: ${postId}` }, { status: 404 })
    }

    // ── Step 2 — Write source file (idempotent) ──────────────────────────────
    await writeSourceFile(post).catch(() => {})

    const result: {
      success: boolean
      contentPrompts?: Partial<Record<Platform, ContentPromptOutput>>
      imagePayloads?: Partial<Record<Platform, ImagePromptOutput>>
      errors: string[]
    } = { success: true, errors: [] }

    // ── Steps 3–5 — Content ──────────────────────────────────────────────────
    if (mode === "content" || mode === "both") {
      // Step 3: Execute content skills in parallel
      const contentSkillResults = await Promise.allSettled(
        targetPlatforms.map((platform) =>
          executePlatformContentSkill({
            postId,
            platform,
            linkedinText: post.linkedinText,
          }).then((output) => ({ platform, output }))
        )
      )

      const contentPrompts: Partial<Record<Platform, ContentPromptOutput>> = {}
      for (const r of contentSkillResults) {
        if (r.status === "fulfilled") {
          contentPrompts[r.value.platform] = r.value.output
        } else {
          result.errors.push(`Content skill failed: ${String(r.reason)}`)
        }
      }

      if (Object.keys(contentPrompts).length === 0) {
        return NextResponse.json(
          { error: "All content skills failed", errors: result.errors },
          { status: 502 }
        )
      }

      // Step 4: Persist content prompts to Sheet
      const promptStrings: Partial<Record<Platform, string>> = {}
      for (const [p, prompt] of Object.entries(contentPrompts)) {
        const cp = prompt as ContentPromptOutput
        promptStrings[p as Platform] = JSON.stringify({
          systemPrompt: cp.systemPrompt,
          userPrompt: cp.userPrompt,
        })
      }
      await writeContentPrompts(postId, promptStrings).catch((e) => {
        result.errors.push(`writeContentPrompts: ${String(e)}`)
      })

      // Step 5: Fire content repurpose webhook
      const contentResult = await fireContentRepurposeWebhook({
        post,
        platforms: targetPlatforms,
        contentPrompts,
      })

      if (!contentResult.success) {
        return NextResponse.json(
          {
            error: contentResult.error ?? "Content webhook fire failed",
            errors: result.errors,
          },
          { status: 502 }
        )
      }

      result.contentPrompts = contentPrompts
    }

    // ── Steps 6–8 — Images ───────────────────────────────────────────────────
    if (mode === "images" || mode === "both") {
      // Step 6: Execute image skills in parallel
      const imageSkillResults = await Promise.allSettled(
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
      for (const r of imageSkillResults) {
        if (r.status === "fulfilled") {
          imagePayloads[r.value.platform] = r.value.output
        } else {
          result.errors.push(`Image skill failed: ${String(r.reason)}`)
        }
      }

      if (Object.keys(imagePayloads).length === 0) {
        return NextResponse.json(
          { error: "All image skills failed", errors: result.errors },
          { status: 502 }
        )
      }

      // Step 7: Persist image prompts to Sheet
      const imagePromptStrings: Partial<Record<Platform, string>> = {}
      for (const [p, payload] of Object.entries(imagePayloads)) {
        imagePromptStrings[p as Platform] = (payload as ImagePromptOutput).prompt
      }
      await writeImagePrompts(postId, imagePromptStrings).catch((e) => {
        result.errors.push(`writeImagePrompts: ${String(e)}`)
      })

      // Step 8: Fire image repurpose webhook
      const imageResult = await fireImageRepurposeWebhook({
        post,
        imagePayloads,
      })

      if (!imageResult.success) {
        return NextResponse.json(
          {
            error: imageResult.error ?? "Image webhook fire failed",
            errors: result.errors,
          },
          { status: 502 }
        )
      }

      result.imagePayloads = imagePayloads
    }

    return NextResponse.json({
      success: true,
      ...(result.contentPrompts ? { contentPrompts: result.contentPrompts } : {}),
      ...(result.imagePayloads ? { imagePayloads: result.imagePayloads } : {}),
      ...(result.errors.length > 0 ? { warnings: result.errors } : {}),
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error"
    console.error("[skills/repurpose] Unexpected error:", message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
