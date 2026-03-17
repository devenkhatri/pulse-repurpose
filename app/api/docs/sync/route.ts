import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import {
  resolveAffectedDocs,
  DOC_GENERATION_STRATEGY,
  appendToChangelog,
  appendToMemory,
  regenerateWithClaude,
  regenerateWithTemplate,
} from "@/lib/docs-sync"

// ---------------------------------------------------------------------------
// Zod schema
// ---------------------------------------------------------------------------

const SyncSchema = z.object({
  changelogEntry: z.string().min(1),
  changedFiles: z.array(z.string()).min(1),
  changeType: z.enum(["feature-added", "feature-updated", "feature-removed", "bugfix", "refactor"]),
  forceAll: z.boolean().optional().default(false),
})

// ---------------------------------------------------------------------------
// POST /api/docs/sync
// Called by Claude Code after every feature change.
// Appends to CHANGELOG.md, determines affected docs, and regenerates them.
// ---------------------------------------------------------------------------

export async function POST(req: NextRequest) {
  try {
    const body: unknown = await req.json()
    const parseResult = SyncSchema.safeParse(body)

    if (!parseResult.success) {
      return NextResponse.json(
        { error: "Invalid request body", details: parseResult.error.flatten() },
        { status: 400 }
      )
    }

    const { changelogEntry, changedFiles, changeType, forceAll } = parseResult.data

    // 1. Append to CHANGELOG.md
    await appendToChangelog(changelogEntry)

    // 2. Determine affected docs
    const affectedDocs = forceAll
      ? Object.keys(DOC_GENERATION_STRATEGY)
      : resolveAffectedDocs(changedFiles)

    const results: Record<string, "updated" | "skipped" | "failed"> = {}

    // 3. Process each affected doc
    for (const doc of affectedDocs) {
      const strategy = DOC_GENERATION_STRATEGY[doc]

      if (!strategy) {
        results[doc] = "skipped"
        continue
      }

      try {
        if (strategy === "claude" || strategy === "claude+template") {
          await regenerateWithClaude(doc, changelogEntry, changeType)
        }

        if (strategy === "template" || strategy === "claude+template") {
          await regenerateWithTemplate(doc)
        }

        results[doc] = "updated"
      } catch (err) {
        results[doc] = "failed"
        console.error(`[docs/sync] Failed to update ${doc}:`, err)
      }
    }

    // 4. Log to MEMORY.md
    const updatedList = Object.entries(results)
      .filter(([, v]) => v === "updated")
      .map(([k]) => k)
      .join(", ")

    await appendToMemory(
      `${new Date().toISOString()} Doc sync triggered by ${changeType}. Updated: ${updatedList || "none"}. Change: ${changelogEntry.split("\n")[0]}`
    ).catch(() => {})

    return NextResponse.json({ results, affectedDocs })
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error"
    console.error("[docs/sync] Unexpected error:", message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
