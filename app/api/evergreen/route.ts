import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { getEvergreenConfig, saveEvergreenConfig, getRecycledPosts } from "@/lib/evergreen"

const VALID_PLATFORMS = ["twitter", "threads", "instagram", "facebook", "skool", "linkedin"] as const

const EvergreenConfigSchema = z.object({
  enabled: z.boolean(),
  engagementThreshold: z.number().min(0).max(100),
  recycleIntervalDays: z.number().min(1).max(365),
  platforms: z.array(z.enum(VALID_PLATFORMS)),
})

// ---------------------------------------------------------------------------
// GET /api/evergreen
// ---------------------------------------------------------------------------

export async function GET() {
  try {
    const config = await getEvergreenConfig()
    const recycledPosts = await getRecycledPosts()
    return NextResponse.json({ config, recycledPostIds: Object.keys(recycledPosts) })
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error"
    return NextResponse.json(
      { error: "Failed to read evergreen config", details: message },
      { status: 500 }
    )
  }
}

// ---------------------------------------------------------------------------
// POST /api/evergreen
// ---------------------------------------------------------------------------

export async function POST(req: NextRequest) {
  try {
    const body: unknown = await req.json()
    const parseResult = EvergreenConfigSchema.safeParse(body)

    if (!parseResult.success) {
      return NextResponse.json(
        { error: "Invalid evergreen config", details: parseResult.error.flatten() },
        { status: 400 }
      )
    }

    await saveEvergreenConfig(parseResult.data)
    const saved = await getEvergreenConfig()
    return NextResponse.json({ config: saved })
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error"
    return NextResponse.json(
      { error: "Failed to save evergreen config", details: message },
      { status: 500 }
    )
  }
}
