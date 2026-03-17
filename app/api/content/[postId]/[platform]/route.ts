import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { readPlatformFile } from "@/lib/content-store"
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

// ---------------------------------------------------------------------------
// GET /api/content/[postId]/[platform]
// Returns a single platform content file.
// Used for the "view raw markdown" button on each platform card.
// ---------------------------------------------------------------------------

export async function GET(
  _req: NextRequest,
  { params }: { params: { postId: string; platform: string } }
) {
  const platformParse = PlatformSchema.safeParse(params.platform)
  if (!platformParse.success) {
    return NextResponse.json(
      { error: `Invalid platform: ${params.platform}` },
      { status: 400 }
    )
  }

  try {
    const file = await readPlatformFile(params.postId, platformParse.data as Platform)
    if (!file) {
      return NextResponse.json(
        { error: "Content file not found" },
        { status: 404 }
      )
    }
    return NextResponse.json({
      postId: params.postId,
      platform: platformParse.data,
      ...file,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error"
    return NextResponse.json(
      { error: "Failed to read content file", details: message },
      { status: 500 }
    )
  }
}
