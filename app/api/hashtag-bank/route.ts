import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import {
  getHashtagBank,
  addHashtag,
  removeHashtag,
} from "@/lib/hashtag-bank"

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

const AddHashtagSchema = z.object({
  hashtag: z.string().min(1).max(100),
  platforms: z.array(PlatformSchema).min(1),
  topicPillar: z.string().nullable().default(null),
})

const DeleteHashtagSchema = z.object({
  id: z.string().uuid(),
})

// ---------------------------------------------------------------------------
// GET /api/hashtag-bank
// ---------------------------------------------------------------------------

export async function GET() {
  try {
    const entries = await getHashtagBank()
    return NextResponse.json({ entries })
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error"
    return NextResponse.json(
      { error: "Failed to read hashtag bank", details: message },
      { status: 500 }
    )
  }
}

// ---------------------------------------------------------------------------
// POST /api/hashtag-bank
// Add a single hashtag
// ---------------------------------------------------------------------------

export async function POST(req: NextRequest) {
  try {
    const body: unknown = await req.json()
    const parseResult = AddHashtagSchema.safeParse(body)

    if (!parseResult.success) {
      return NextResponse.json(
        { error: "Invalid hashtag data", details: parseResult.error.flatten() },
        { status: 400 }
      )
    }

    const entry = await addHashtag(parseResult.data)
    return NextResponse.json({ entry }, { status: 201 })
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error"
    return NextResponse.json(
      { error: "Failed to add hashtag", details: message },
      { status: 500 }
    )
  }
}

// ---------------------------------------------------------------------------
// DELETE /api/hashtag-bank
// Body: { id: string }
// ---------------------------------------------------------------------------

export async function DELETE(req: NextRequest) {
  try {
    const body: unknown = await req.json()
    const parseResult = DeleteHashtagSchema.safeParse(body)

    if (!parseResult.success) {
      return NextResponse.json(
        { error: "Invalid request", details: parseResult.error.flatten() },
        { status: 400 }
      )
    }

    await removeHashtag(parseResult.data.id)
    return NextResponse.json({ success: true })
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error"
    return NextResponse.json(
      { error: "Failed to delete hashtag", details: message },
      { status: 500 }
    )
  }
}
