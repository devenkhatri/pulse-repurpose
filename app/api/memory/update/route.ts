import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { appendToMemory } from "@/lib/docs-sync"

// ---------------------------------------------------------------------------
// Zod schema
// ---------------------------------------------------------------------------

const UpdateSchema = z.object({
  note: z.string().min(1).max(500),
})

// ---------------------------------------------------------------------------
// POST /api/memory/update
// Append a manual note to MEMORY.md.
// Used for the "Add context" feature in the UI.
// ---------------------------------------------------------------------------

export async function POST(req: NextRequest) {
  try {
    const body: unknown = await req.json()
    const parseResult = UpdateSchema.safeParse(body)

    if (!parseResult.success) {
      return NextResponse.json(
        { error: "Invalid request body", details: parseResult.error.flatten() },
        { status: 400 }
      )
    }

    const { note } = parseResult.data
    const timestamp = new Date().toISOString()

    await appendToMemory(`${timestamp} [manual note] ${note}`)

    return NextResponse.json({ success: true, timestamp })
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
