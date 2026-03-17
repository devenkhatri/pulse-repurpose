import { NextResponse } from "next/server"
import fs from "fs/promises"
import path from "path"
import { DOC_GENERATION_STRATEGY } from "@/lib/docs-sync"

// ---------------------------------------------------------------------------
// GET /api/docs/status
// Returns freshness of all tracked docs relative to last CHANGELOG entry.
// ---------------------------------------------------------------------------

interface DocStatus {
  lastUpdated: string | null
  status: "fresh" | "stale" | "missing"
}

async function getFileModTime(filePath: string): Promise<string | null> {
  try {
    const stat = await fs.stat(path.join(process.cwd(), filePath))
    return stat.mtime.toISOString()
  } catch {
    return null
  }
}

async function getLastChangelogEntry(): Promise<string | null> {
  try {
    const changelogPath = path.join(process.cwd(), "CHANGELOG.md")
    const content = await fs.readFile(changelogPath, "utf-8")
    // Find the first date entry like [2026-03-17]
    const match = content.match(/## \[(\d{4}-\d{2}-\d{2}[^\]]*)\]/)
    return match ? match[1] : null
  } catch {
    return null
  }
}

export async function GET() {
  try {
    const docs: Record<string, DocStatus> = {}
    const lastChangelogEntry = await getLastChangelogEntry()
    const staleDocs: string[] = []

    for (const docPath of Object.keys(DOC_GENERATION_STRATEGY)) {
      const lastUpdated = await getFileModTime(docPath)

      if (!lastUpdated) {
        docs[docPath] = { lastUpdated: null, status: "missing" }
        staleDocs.push(docPath)
        continue
      }

      // A doc is stale if the CHANGELOG has a newer entry than the doc's last mod time
      // Simple heuristic: compare dates
      let status: "fresh" | "stale" = "fresh"
      if (lastChangelogEntry) {
        // Parse changelog date
        const changelogDate = lastChangelogEntry.match(/\d{4}-\d{2}-\d{2}/)?.[0]
        if (changelogDate) {
          const docDate = lastUpdated.split("T")[0]
          if (docDate < changelogDate) {
            status = "stale"
            staleDocs.push(docPath)
          }
        }
      }

      docs[docPath] = { lastUpdated, status }
    }

    return NextResponse.json({
      docs,
      lastChangelogEntry,
      staleDocs,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
