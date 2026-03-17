import { NextResponse } from "next/server"
import { listContentPostIds } from "@/lib/content-store"

// ---------------------------------------------------------------------------
// GET /api/content
// Lists all post IDs that have content folders in content/
// ---------------------------------------------------------------------------

export async function GET() {
  try {
    const postIds = await listContentPostIds()
    return NextResponse.json({ postIds })
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error"
    return NextResponse.json(
      { error: "Failed to list content", details: message },
      { status: 500 }
    )
  }
}
