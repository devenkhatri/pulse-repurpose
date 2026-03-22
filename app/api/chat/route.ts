import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { callLLMWebhook } from "@/lib/n8n"
import { getBrandVoice, buildBrandVoiceSystemPrompt } from "@/lib/brand-voice"
import { PLATFORM_RULES } from "@/lib/platform-rules"

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
// Calls the n8n LLM proxy webhook synchronously and returns { updatedText, explanation }.
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
    const rules = PLATFORM_RULES[platform]

    const systemPrompt = `${buildBrandVoiceSystemPrompt(brandVoice)}

You are editing a ${rules.label} post. Platform rules:
- Max characters: ${rules.maxChars}
- Tone: ${rules.tone}
- Format: ${rules.formatRules}
- Avoid: ${rules.avoidPatterns.join(", ")}

Current post text:
${currentVariantText}

The user will give you an edit instruction. Return ONLY valid JSON in this exact format (no markdown, no code fences):
{"updatedText": "...", "explanation": "one sentence explaining what changed"}`

    const llmMessages: Array<{ role: "system" | "user" | "assistant"; content: string }> = [
      { role: "system", content: systemPrompt },
      ...messages.map((m) => ({
        role: m.role as "user" | "assistant",
        content: m.content,
      })),
      { role: "user", content: instruction },
    ]

    const text = await callLLMWebhook({ messages: llmMessages, maxTokens: 2048 })

    const jsonMatch =
      text.match(/```(?:json)?\s*([\s\S]*?)```/) ?? text.match(/(\{[\s\S]*\})/)
    const jsonStr = jsonMatch ? (jsonMatch[1] ?? jsonMatch[0]) : text

    let result: { updatedText: string; explanation: string }
    try {
      result = JSON.parse(jsonStr) as { updatedText: string; explanation: string }
    } catch {
      result = { updatedText: currentVariantText, explanation: "Could not parse AI response" }
    }

    return NextResponse.json(result)
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error"
    if (message.includes("N8N_LLM_WEBHOOK_URL")) {
      return NextResponse.json(
        { error: "LLM webhook not configured — set N8N_LLM_WEBHOOK_URL in .env.local" },
        { status: 503 }
      )
    }
    console.error("[api/chat] LLM webhook error:", message)
    return NextResponse.json(
      { error: `AI call failed: ${message}` },
      { status: 502 }
    )
  }
}
