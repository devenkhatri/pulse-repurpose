import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { getBrandVoice, saveBrandVoice } from "@/lib/brand-voice"

// ---------------------------------------------------------------------------
// Zod schema
// ---------------------------------------------------------------------------

const ImageBrandKitSchema = z.object({
  primaryColor: z.string().default("#7C3AED"),
  secondaryColor: z.string().default("#A78BFA"),
  visualStyle: z.array(z.string()).default([]),
  photographyStyle: z.array(z.string()).default([]),
  moodKeywords: z.array(z.string()).default([]),
  avoidInImages: z.array(z.string()).default([]),
})

const BrandVoiceSchema = z.object({
  toneDescriptors: z.array(z.string()),
  writingStyle: z.string().max(500),
  topicPillars: z.array(z.string()),
  avoidList: z.array(z.string()),
  examplePosts: z.array(z.string()),
  imageBrandKit: ImageBrandKitSchema.optional().default({
    primaryColor: "#7C3AED",
    secondaryColor: "#A78BFA",
    visualStyle: [],
    photographyStyle: [],
    moodKeywords: [],
    avoidInImages: [],
  }),
  lastUpdated: z.string().optional().default(""),
})

// ---------------------------------------------------------------------------
// GET /api/brand-voice
// ---------------------------------------------------------------------------

export async function GET() {
  try {
    const profile = await getBrandVoice()
    return NextResponse.json({ profile })
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error"
    return NextResponse.json(
      { error: "Failed to read brand voice", details: message },
      { status: 500 }
    )
  }
}

// ---------------------------------------------------------------------------
// POST /api/brand-voice
// ---------------------------------------------------------------------------

export async function POST(req: NextRequest) {
  try {
    const body: unknown = await req.json()
    const parseResult = BrandVoiceSchema.safeParse(body)

    if (!parseResult.success) {
      return NextResponse.json(
        { error: "Invalid brand voice data", details: parseResult.error.flatten() },
        { status: 400 }
      )
    }

    await saveBrandVoice(parseResult.data)
    const saved = await getBrandVoice()
    return NextResponse.json({ profile: saved })
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error"
    return NextResponse.json(
      { error: "Failed to save brand voice", details: message },
      { status: 500 }
    )
  }
}
