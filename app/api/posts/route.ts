import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { getAllPosts } from "@/lib/n8n-sheet"
import type { Platform, PostStatus } from "@/types"

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

const GetPostsQuerySchema = z.object({
  status: PostStatusSchema.optional(),
  platform: PlatformSchema.optional(),
  from: z.string().optional(),
  to: z.string().optional(),
})

// ---------------------------------------------------------------------------
// GET /api/posts
// ---------------------------------------------------------------------------

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)

    const parseResult = GetPostsQuerySchema.safeParse({
      status: searchParams.get("status") ?? undefined,
      platform: searchParams.get("platform") ?? undefined,
      from: searchParams.get("from") ?? undefined,
      to: searchParams.get("to") ?? undefined,
    })

    if (!parseResult.success) {
      return NextResponse.json(
        { error: "Invalid query parameters", details: parseResult.error.flatten() },
        { status: 400 }
      )
    }

    const { status, platform, from, to } = parseResult.data

    const posts = await getAllPosts({
      statusFilter: status as PostStatus | undefined,
      platformFilter: platform as Platform | undefined,
      fromDate: from,
      toDate: to,
    })

    return NextResponse.json({ posts }, {
      headers: { "Cache-Control": "public, max-age=15, stale-while-revalidate=15" },
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error"
    return NextResponse.json(
      { error: "Failed to fetch posts", details: message },
      { status: 500 }
    )
  }
}
