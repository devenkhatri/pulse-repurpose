import { NextResponse } from "next/server"
import fs from "fs/promises"
import path from "path"

// ---------------------------------------------------------------------------
// Heartbeat parser — converts Heartbeat.md sections into a structured object
// ---------------------------------------------------------------------------

interface HeartbeatData {
  lastUpdated: string | null
  systemStatus: {
    app: string
    n8nWorkflows: string
    lastCronRun: string
    nextCronRun: string
  }
  pipeline: {
    newPostsSinceLastRun: string
    repurposedToday: string
    pendingApproval: string
    scheduledThisWeek: string
    publishedThisWeek: string
  }
  platformHealth: Record<string, string>
  activeLearnings: string[]
  flags: string[]
  memoryPointers: Record<string, string>
}

function parseHeartbeat(content: string): HeartbeatData {
  const lines = content.split("\n")

  const getValue = (label: string): string => {
    const line = lines.find((l) => l.startsWith(`- ${label}:`))
    return line ? line.replace(`- ${label}:`, "").trim() : "[unknown]"
  }

  const getSection = (heading: string): string[] => {
    const start = lines.findIndex((l) => l.trim() === `## ${heading}`)
    if (start === -1) return []
    const items: string[] = []
    for (let i = start + 1; i < lines.length; i++) {
      if (lines[i].startsWith("## ")) break
      if (lines[i].startsWith("- ") && !lines[i].includes("[auto-filled")) {
        items.push(lines[i].replace(/^- /, "").trim())
      }
    }
    return items
  }

  // Last updated
  const updatedMatch = content.match(/_Last updated: ([^_]+)_/)
  const lastUpdated = updatedMatch ? updatedMatch[1].trim() : null

  // System status
  const systemStatus = {
    app: getValue("App"),
    n8nWorkflows: getValue("n8n workflows"),
    lastCronRun: getValue("Last cron run"),
    nextCronRun: getValue("Next cron run"),
  }

  // Pipeline
  const pipeline = {
    newPostsSinceLastRun: getValue("New LinkedIn posts since last run"),
    repurposedToday: getValue("Posts repurposed today"),
    pendingApproval: getValue("Posts pending approval"),
    scheduledThisWeek: getValue("Posts scheduled this week"),
    publishedThisWeek: getValue("Posts published this week"),
  }

  // Platform health
  const platformHealth: Record<string, string> = {}
  const platforms = ["Twitter", "Threads", "Instagram", "Facebook", "Skool"]
  for (const p of platforms) {
    platformHealth[p.toLowerCase()] = getValue(p)
  }

  // Active learnings
  const activeLearnings = getSection("Active learning signals")

  // Flags
  const flags = getSection("Flags requiring attention")

  // Memory pointers
  const memoryPointers: Record<string, string> = {}
  const pointerLines = lines.filter(
    (l) =>
      (l.includes("USER.md:") ||
        l.includes("MEMORY.md:") ||
        l.includes("learnings.md:") ||
        l.includes("daily log:")) &&
      l.startsWith("- ")
  )
  for (const line of pointerLines) {
    const [key, ...val] = line.replace(/^- /, "").split(":")
    if (key && val.length) {
      memoryPointers[key.trim()] = val.join(":").trim()
    }
  }

  return {
    lastUpdated,
    systemStatus,
    pipeline,
    platformHealth,
    activeLearnings,
    flags,
    memoryPointers,
  }
}

// ---------------------------------------------------------------------------
// GET /api/heartbeat
// Returns Heartbeat.md parsed as structured JSON for the dashboard.
// ---------------------------------------------------------------------------

export async function GET() {
  try {
    const heartbeatPath = path.join(process.cwd(), "Heartbeat.md")
    const content = await fs.readFile(heartbeatPath, "utf-8")
    const data = parseHeartbeat(content)

    return NextResponse.json({ ...data, raw: content })
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error"
    // Return a safe default so dashboard doesn't break
    return NextResponse.json(
      {
        lastUpdated: null,
        systemStatus: {
          app: "unknown",
          n8nWorkflows: "unknown",
          lastCronRun: "never",
          nextCronRun: "unknown",
        },
        pipeline: {
          newPostsSinceLastRun: "0",
          repurposedToday: "0",
          pendingApproval: "0",
          scheduledThisWeek: "0",
          publishedThisWeek: "0",
        },
        platformHealth: {},
        activeLearnings: [],
        flags: [],
        memoryPointers: {},
        raw: "",
        error: message,
      },
      { status: 200 } // 200 so dashboard renders gracefully
    )
  }
}
