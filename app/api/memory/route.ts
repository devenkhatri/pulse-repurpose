import { NextResponse } from "next/server"
import fs from "fs/promises"
import path from "path"

// ---------------------------------------------------------------------------
// GET /api/memory
// Returns current MEMORY.md and learnings.md contents as JSON.
// Used by the dashboard settings panel.
// ---------------------------------------------------------------------------

export async function GET() {
  const cwd = process.cwd()

  const [memoryContent, learningsContent] = await Promise.all([
    fs.readFile(path.join(cwd, "memory", "MEMORY.md"), "utf-8").catch(() => ""),
    fs.readFile(path.join(cwd, "memory", "learnings.md"), "utf-8").catch(() => ""),
  ])

  return NextResponse.json({
    memory: memoryContent,
    learnings: learningsContent,
  })
}
