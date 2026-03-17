import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { getPostById, writeContentPrompts, writeImagePrompts } from "@/lib/n8n-sheet"
import { updatePlatformFileMeta } from "@/lib/content-store"
import {
  executePlatformContentSkill,
  executePlatformImageSkill,
} from "@/lib/platform-skills"
import type { ContentPromptOutput, ImagePromptOutput } from "@/types"

// ---------------------------------------------------------------------------
// Zod schema
// ---------------------------------------------------------------------------

const PlatformSchema = z.enum([
  "twitter",
  "threads",
  "instagram",
  "facebook",
  "skool",
])

const RequestSchema = z.object({
  postId: z.string().min(1),
  platform: PlatformSchema,
  skillType: z.enum(["content", "image"]),
  sourceImageUrl: z.string().nullable().optional(),
})

// ---------------------------------------------------------------------------
// GET /api/skills/platform-prompt — health/info (browser-friendly)
// ---------------------------------------------------------------------------

export function GET() {
  return NextResponse.json({
    endpoint: "POST /api/skills/platform-prompt",
    description: "Executes a platform skill file and returns ContentPromptOutput or ImagePromptOutput.",
    body: {
      postId: "string",
      platform: "twitter | threads | instagram | facebook | skool",
      skillType: "content | image",
      sourceImageUrl: "string | null (optional, image skills only)",
    },
  })
}

// ---------------------------------------------------------------------------
// POST /api/skills/platform-prompt
// Executes a single platform skill file (content or image) and returns the
// structured ContentPromptOutput or ImagePromptOutput.
// Called by the repurpose skill orchestrator and trigger routes.
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

    const { postId, platform, skillType, sourceImageUrl } = parseResult.data

    // 1. Fetch source post
    const post = await getPostById(postId)
    if (!post) {
      return NextResponse.json({ error: `Post not found: ${postId}` }, { status: 404 })
    }

    // 2. Execute skill
    let output: ContentPromptOutput | ImagePromptOutput

    try {
      if (skillType === "content") {
        output = await executePlatformContentSkill({
          postId,
          platform,
          linkedinText: post.linkedinText,
        })
      } else {
        output = await executePlatformImageSkill({
          postId,
          platform,
          linkedinText: post.linkedinText,
          sourceImageUrl: sourceImageUrl ?? post.linkedinImageUrl ?? null,
        })
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error"
      console.error(`[skills/platform-prompt] Skill execution failed (${platform}-${skillType}):`, message)
      return NextResponse.json(
        { error: `Skill execution failed: ${message}` },
        { status: 502 }
      )
    }

    // 3. Persist prompts to Sheet + content file (best-effort — don't fail the response)
    if (skillType === "content") {
      const co = output as ContentPromptOutput
      const promptJson = JSON.stringify({
        systemPrompt: co.systemPrompt,
        userPrompt: co.userPrompt,
      })
      await Promise.all([
        writeContentPrompts(postId, { [platform]: promptJson }).catch((e) => {
          console.warn("[skills/platform-prompt] writeContentPrompts failed:", e)
        }),
        updatePlatformFileMeta(postId, platform, {
          content_prompt_preview: co.userPrompt?.slice(0, 200),
        }).catch(() => {}),
      ])
    } else {
      const io = output as ImagePromptOutput
      if (io.prompt) {
        await Promise.all([
          writeImagePrompts(postId, { [platform]: io.prompt }).catch((e) => {
            console.warn("[skills/platform-prompt] writeImagePrompts failed:", e)
          }),
          updatePlatformFileMeta(postId, platform, {
            image_prompt: io.prompt,
          }).catch(() => {}),
        ])
      }
    }

    return NextResponse.json(output)
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error"
    console.error("[skills/platform-prompt] Unexpected error:", message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
