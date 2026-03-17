import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { chatWithAI } from "@/lib/anthropic"
import { getBrandVoice } from "@/lib/brand-voice"

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

const ChatMessageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string(),
  timestamp: z.string(),
})

const ChatRequestSchema = z.object({
  messages: z.array(ChatMessageSchema),
  currentVariantText: z.string(),
  platform: PlatformSchema,
  instruction: z.string().min(1),
})

// ---------------------------------------------------------------------------
// POST /api/chat
// Calls Claude directly (synchronous) and returns { updatedText, explanation }.
// Not via n8n — this is an interactive, immediate edit call.
// ---------------------------------------------------------------------------

export async function POST(req: NextRequest) {
  try {
    const body: unknown = await req.json()
    const parseResult = ChatRequestSchema.safeParse(body)

    if (!parseResult.success) {
      return NextResponse.json(
        { error: "Invalid request body", details: parseResult.error.flatten() },
        { status: 400 }
      )
    }

    const { messages, currentVariantText, platform, instruction } = parseResult.data

    const brandVoice = await getBrandVoice()

    const result = await chatWithAI({
      messages,
      currentVariantText,
      platform,
      brandVoice,
      instruction,
    })

    return NextResponse.json(result)
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error"
    // Distinguish API key errors from other failures
    if (message.includes("OPENROUTER_API_KEY")) {
      return NextResponse.json(
        { error: "OpenRouter API not configured — set OPENROUTER_API_KEY in .env.local" },
        { status: 503 }
      )
    }
    console.error("[api/chat] OpenRouter API error:", message)
    return NextResponse.json(
      { error: `Claude API call failed: ${message}` },
      { status: 502 }
    )
  }
}
