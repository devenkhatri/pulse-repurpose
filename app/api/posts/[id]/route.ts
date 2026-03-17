import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { getPostById, updatePlatformVariant, updateMultiplePlatforms } from "@/lib/n8n-sheet"
import { updatePlatformFileMeta } from "@/lib/content-store"
import type { Platform } from "@/types"

// ---------------------------------------------------------------------------
// Zod schemas
// ---------------------------------------------------------------------------

const PlatformSchema = z.enum([
  "twitter",
  "threads",
  "instagram",
  "facebook",
  "skool",
  "linkedin",
])

const PostStatusSchema = z.enum([
  "pending",
  "approved",
  "scheduled",
  "published",
  "failed",
])

const PlatformVariantPatchSchema = z.object({
  text: z.string().nullable().optional(),
  contentPrompt: z.string().nullable().optional(),
  imagePrompt: z.string().nullable().optional(),
  imageUrl: z.string().nullable().optional(),
  hashtags: z.array(z.string()).optional(),
  status: PostStatusSchema.optional(),
  generatedAt: z.string().nullable().optional(),
  scheduledAt: z.string().nullable().optional(),
  publishedAt: z.string().nullable().optional(),
  approvedAt: z.string().nullable().optional(),
  isEdited: z.boolean().optional(),
  error: z.string().nullable().optional(),
})

// PATCH body: update one or more platform variants for a post
const PatchPostBodySchema = z.object({
  // Single-platform update
  platform: PlatformSchema.optional(),
  variant: PlatformVariantPatchSchema.optional(),
  // Multi-platform update
  variants: z.record(PlatformSchema, PlatformVariantPatchSchema).optional(),
})

// ---------------------------------------------------------------------------
// GET /api/posts/[id]
// ---------------------------------------------------------------------------

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const post = await getPostById(params.id)
    if (!post) {
      return NextResponse.json({ error: "Post not found" }, { status: 404 })
    }
    return NextResponse.json({ post })
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error"
    return NextResponse.json(
      { error: "Failed to fetch post", details: message },
      { status: 500 }
    )
  }
}

// ---------------------------------------------------------------------------
// PATCH /api/posts/[id]
// ---------------------------------------------------------------------------

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body: unknown = await req.json()
    const parseResult = PatchPostBodySchema.safeParse(body)

    if (!parseResult.success) {
      return NextResponse.json(
        { error: "Invalid request body", details: parseResult.error.flatten() },
        { status: 400 }
      )
    }

    const { platform, variant, variants } = parseResult.data
    const postId = params.id

    if (variants && Object.keys(variants).length > 0) {
      // Multi-platform batch update
      await updateMultiplePlatforms(
        postId,
        variants as Partial<Record<Platform, typeof variant>>
      )

      // Sync content files for each platform
      await Promise.all(
        Object.entries(variants).map(async ([p, v]) => {
          if (v) {
            await updatePlatformFileMeta(postId, p as Platform, {
              status: v.status,
              approved_at: v.approvedAt,
              published_at: v.publishedAt,
              scheduled_at: v.scheduledAt,
              edited_by_user: v.isEdited,
              image_url: v.imageUrl,
              image_prompt: v.imagePrompt,
            })
          }
        })
      )
    } else if (platform && variant) {
      // Single-platform update
      await updatePlatformVariant(postId, platform, variant)

      // Sync content file
      await updatePlatformFileMeta(postId, platform, {
        status: variant.status,
        approved_at: variant.approvedAt,
        published_at: variant.publishedAt,
        scheduled_at: variant.scheduledAt,
        edited_by_user: variant.isEdited,
        image_url: variant.imageUrl,
        image_prompt: variant.imagePrompt,
      })
    } else {
      return NextResponse.json(
        { error: "Provide either (platform + variant) or variants object" },
        { status: 400 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error"
    return NextResponse.json(
      { error: "Failed to update post", details: message },
      { status: 500 }
    )
  }
}
