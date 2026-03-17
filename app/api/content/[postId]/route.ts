import { NextRequest, NextResponse } from "next/server"
import { readAllPlatformFiles } from "@/lib/content-store"

// ---------------------------------------------------------------------------
// GET /api/content/[postId]
// Returns all platform content files for a post as structured JSON.
// Used by the repurpose page to load existing content without a Sheet round-trip.
// ---------------------------------------------------------------------------

export async function GET(
  _req: NextRequest,
  { params }: { params: { postId: string } }
) {
  try {
    const files = await readAllPlatformFiles(params.postId)
    return NextResponse.json({ postId: params.postId, files })
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error"
    return NextResponse.json(
      { error: "Failed to read content files", details: message },
      { status: 500 }
    )
  }
}
