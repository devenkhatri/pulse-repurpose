import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import fs from "fs/promises"
import path from "path"
import { executePrompt } from "@/lib/anthropic"
import { getBrandVoice } from "@/lib/brand-voice"
import { cacheGetOrSet } from "@/lib/cache"
import type { CarouselPromptOutput } from "@/types"

// ---------------------------------------------------------------------------
// Schema
// ---------------------------------------------------------------------------

const RequestSchema = z.object({
  postId: z.string().min(1),
  linkedinText: z.string().min(1),
})

// ---------------------------------------------------------------------------
// Model chain — same fallback pattern as platform-skills.ts
// ---------------------------------------------------------------------------

const SKILL_MODEL_CHAIN: string[] = [
  process.env.OPENROUTER_SKILL_MODEL ?? "stepfun/step-3.5-flash:free",
  "nvidia/nemotron-3-super-120b-a12b:free",
  "minimax/minimax-m2.5:free",
  "liquid/lfm-2.5-1.2b-instruct:free",
]

const FILE_TTL_MS = 5 * 60 * 1000

// ---------------------------------------------------------------------------
// JSON parser (same logic as platform-skills.ts)
// ---------------------------------------------------------------------------

function parseJsonResponse<T>(raw: string): T {
  if (!raw || !raw.trim()) throw new Error("Empty response from LLM")

  const fenceMatch = raw.match(/```(?:json)?\s*([\s\S]*?)```/)
  let jsonStr = ""
  if (fenceMatch) {
    jsonStr = fenceMatch[1] ?? fenceMatch[0]
  } else {
    const objectMatch = raw.match(/(\{[\s\S]*\})/)
    jsonStr = objectMatch ? (objectMatch[1] ?? objectMatch[0]) : raw
  }

  jsonStr = jsonStr.trim().replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "")
  jsonStr = jsonStr.replace(/"((?:[^"\\]|\\.)*)"/g, (_, content: string) =>
    '"' +
    content
      .replace(/\r\n/g, "\\n")
      .replace(/\r/g, "\\n")
      .replace(/\n/g, "\\n") +
    '"'
  )

  try {
    return JSON.parse(jsonStr) as T
  } catch {
    const lastBrace = raw.lastIndexOf("{")
    const end = raw.lastIndexOf("}")
    if (lastBrace !== -1 && end > lastBrace) {
      const attempt = raw
        .slice(lastBrace, end + 1)
        .trim()
        .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "")
        .replace(/"((?:[^"\\]|\\.)*)"/g, (_, content: string) =>
          '"' + content.replace(/\r\n/g, "\\n").replace(/\r/g, "\\n").replace(/\n/g, "\\n") + '"'
        )
      try { return JSON.parse(attempt) as T } catch {}
    }
    throw new Error(`Failed to parse carousel JSON response. Preview: ${jsonStr.slice(0, 200)}`)
  }
}

// ---------------------------------------------------------------------------
// Model retry wrapper
// ---------------------------------------------------------------------------

async function withRetry<T>(fn: (model: string) => Promise<T>): Promise<T> {
  let lastError: unknown
  for (let i = 0; i < SKILL_MODEL_CHAIN.length; i++) {
    const model = SKILL_MODEL_CHAIN[i]!
    try {
      return await fn(model)
    } catch (err) {
      lastError = err
      const msg = err instanceof Error ? err.message : String(err)
      const is404 = msg.includes("404") || msg.includes("No endpoints found")
      if (is404 && i < SKILL_MODEL_CHAIN.length - 1) continue
      if (i < SKILL_MODEL_CHAIN.length - 1) {
        await new Promise((r) => setTimeout(r, 1000))
      }
    }
  }
  throw lastError
}

// ---------------------------------------------------------------------------
// GET — health/info
// ---------------------------------------------------------------------------

export function GET() {
  return NextResponse.json({
    endpoint: "POST /api/skills/carousel",
    description: "Execute the LinkedIn carousel skill and return CarouselPromptOutput.",
    body: { postId: "string", linkedinText: "string" },
  })
}

// ---------------------------------------------------------------------------
// POST /api/skills/carousel
// ---------------------------------------------------------------------------

export async function POST(req: NextRequest) {
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  const parsed = RequestSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 400 }
    )
  }

  const { postId, linkedinText } = parsed.data
  const root = process.cwd()

  try {
    const [skillContent, learningsRaw, userProfileRaw, brandVoice] = await Promise.all([
      cacheGetOrSet(
        "file:skill:linkedin-carousel-content",
        FILE_TTL_MS,
        () => fs.readFile(path.join(root, "skills", "platforms", "linkedin-carousel-content.md"), "utf-8")
      ),
      cacheGetOrSet(
        "file:learnings",
        FILE_TTL_MS,
        () => fs.readFile(path.join(root, "memory", "learnings.md"), "utf-8").catch(() => "")
      ),
      cacheGetOrSet(
        "file:user-profile",
        FILE_TTL_MS,
        () => fs.readFile(path.join(root, "memory", "USER.md"), "utf-8").catch(() => "")
      ),
      getBrandVoice(),
    ])

    const system = `You are executing a skill file for the Pulse Repurpose content system.
Read the skill file carefully and produce the exact output format it specifies.
Return JSON only. No markdown code fences. No explanation outside the JSON.`

    const user = `Execute this skill:

${skillContent}

With these inputs:
- postId: ${postId}
- linkedinText: ${linkedinText}
- brandVoice: ${JSON.stringify(brandVoice)}
- learnings: ${learningsRaw || "None yet — early use, no learning data."}
- userProfile: ${userProfileRaw || "Not configured yet."}

Return the structured CarouselPromptOutput object as specified in the skill file.`

    const raw = await withRetry((model) =>
      executePrompt({ system, user, maxTokens: 4096, model })
    )

    const carousel = parseJsonResponse<CarouselPromptOutput>(raw)

    return NextResponse.json({ carousel }, { status: 200 })
  } catch (err) {
    const message = err instanceof Error ? err.message : "Carousel skill execution failed"
    console.error("[POST /api/skills/carousel]", err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
