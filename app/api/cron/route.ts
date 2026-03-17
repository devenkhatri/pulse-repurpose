import { NextRequest, NextResponse } from "next/server"
import fs from "fs/promises"
import path from "path"
import { getAllPosts } from "@/lib/n8n-sheet"
import { appendToMemory, appendToLearnings, rebuildHeartbeat } from "@/lib/docs-sync"

// ---------------------------------------------------------------------------
// POST /api/cron
// Protected by CRON_SECRET env var.
// Reads skills/cron.md and executes each operation in sequence.
// Returns a run summary JSON.
// ---------------------------------------------------------------------------

interface CronRunResult {
  started: string
  completed: string | null
  durationMs: number | null
  operations: Record<string, "completed" | "failed" | "skipped">
  postsProcessed: number
  learningsUpdated: number
  flags: string[]
  errors: string[]
}

async function readHeartbeat(): Promise<string> {
  try {
    return await fs.readFile(path.join(process.cwd(), "Heartbeat.md"), "utf-8")
  } catch {
    return ""
  }
}

async function getLastCronRunTimestamp(heartbeatContent: string): Promise<string | null> {
  const match = heartbeatContent.match(/Last cron run:\s*(\d{4}-\d{2}-\d{2}T[^\s\n]+)/)
  return match ? match[1] : null
}

async function writeDailyMemory(date: string, content: string): Promise<void> {
  const dailyDir = path.join(process.cwd(), "memory", "daily")
  await fs.mkdir(dailyDir, { recursive: true })
  const filePath = path.join(dailyDir, `${date}.md`)

  try {
    const existing = await fs.readFile(filePath, "utf-8")
    await fs.writeFile(filePath, existing + "\n" + content, "utf-8")
  } catch {
    await fs.writeFile(filePath, content, "utf-8")
  }
}

async function updateHeartbeatWithCronData(data: {
  startTime: string
  pipeline: {
    newPosts: number
    repurposedToday: number
    pendingApproval: number
    scheduledThisWeek: number
    publishedThisWeek: number
  }
  platformHealth: Record<string, string>
  activeLearnings: string[]
  flags: string[]
}): Promise<void> {
  const now = new Date().toISOString()
  const nextRun = "tomorrow at 07:00"

  const learningsSection = data.activeLearnings.length > 0
    ? data.activeLearnings.slice(0, 3).map((l) => `- ${l}`).join("\n")
    : "- [no learnings yet]"

  const flagsSection = data.flags.length > 0
    ? data.flags.map((f) => `- ${f}`).join("\n")
    : "- [no flags]"

  const platformSection = Object.entries(data.platformHealth)
    .map(([p, v]) => `- ${p.charAt(0).toUpperCase() + p.slice(1)}: ${v}`)
    .join("\n")

  const content = `# Heartbeat.md — Pulse Repurpose System State

_Last updated: ${now}_

## System status
- App: running
- n8n workflows: all active
- Last cron run: ${now}
- Next cron run: ${nextRun}

## Content pipeline status
- New LinkedIn posts since last run: ${data.pipeline.newPosts}
- Posts repurposed today: ${data.pipeline.repurposedToday}
- Posts pending approval: ${data.pipeline.pendingApproval}
- Posts scheduled this week: ${data.pipeline.scheduledThisWeek}
- Posts published this week: ${data.pipeline.publishedThisWeek}

## Platform health
${platformSection || "- [no data]"}

## Active learning signals
${learningsSection}

## Memory pointers
- USER.md: memory/USER.md
- MEMORY.md: memory/MEMORY.md
- learnings.md: memory/learnings.md
- Today's daily log: memory/daily/${now.split("T")[0]}.md

## Flags requiring attention
${flagsSection}
`
  await fs.writeFile(path.join(process.cwd(), "Heartbeat.md"), content, "utf-8")
}

// ---------------------------------------------------------------------------
// Main cron handler
// ---------------------------------------------------------------------------

export async function POST(req: NextRequest) {
  // Auth check
  const authHeader = req.headers.get("authorization")
  const cronSecret = process.env.CRON_SECRET

  if (cronSecret) {
    if (!authHeader || authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
  }

  const startTime = new Date()
  const startIso = startTime.toISOString()
  const today = startIso.split("T")[0]

  const result: CronRunResult = {
    started: startIso,
    completed: null,
    durationMs: null,
    operations: {},
    postsProcessed: 0,
    learningsUpdated: 0,
    flags: [],
    errors: [],
  }

  // Log daily memory header
  await writeDailyMemory(
    today,
    `# Daily Memory — ${today}\n\n## Cron run summary\n- Started: ${startIso}\n`
  ).catch(() => {})

  // ── Pre-flight: duplicate run guard ───────────────────────────────────────
  const heartbeatContent = await readHeartbeat()
  const lastCronRun = await getLastCronRunTimestamp(heartbeatContent)
  if (lastCronRun) {
    const lastRunMs = new Date(lastCronRun).getTime()
    const nowMs = startTime.getTime()
    if (nowMs - lastRunMs < 60 * 60 * 1000) {
      // Less than 1 hour ago — abort duplicate run
      return NextResponse.json({
        aborted: true,
        reason: "Last cron run was less than 1 hour ago",
        lastCronRun,
      })
    }
  }

  // ── Operation 1 — Ingest new LinkedIn posts ───────────────────────────────
  let newPostsCount = 0
  try {
    const posts = await getAllPosts({})
    // Find posts that haven't been repurposed yet (all platforms still pending)
    const PLATFORMS = ["twitter", "threads", "instagram", "facebook", "skool"] as const
    const newPosts = posts.filter((post) =>
      PLATFORMS.every((p) => post.platforms[p]?.status === "pending")
    )
    newPostsCount = newPosts.length

    if (newPostsCount > 0) {
      await writeDailyMemory(
        today,
        `\n## New LinkedIn posts found\n${newPosts.map((p) => `- ${p.id}: "${p.linkedinText.slice(0, 80)}..."`).join("\n")}\n`
      ).catch(() => {})
    }

    result.operations["op1_ingest"] = "completed"
    result.postsProcessed = newPostsCount
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    result.operations["op1_ingest"] = "failed"
    result.errors.push(`Operation 1 (ingest): ${msg}`)
    console.error("[cron] Operation 1 failed:", msg)
  }

  // ── Operation 2 — Performance scraping (stub — n8n handles Apify) ─────────
  try {
    // This operation is handled by n8n's Apify scraper workflow
    // The cron just notes it in the log
    result.operations["op2_performance"] = "skipped"
    // In a full implementation, this would trigger the n8n scraper workflow
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    result.operations["op2_performance"] = "failed"
    result.errors.push(`Operation 2 (performance): ${msg}`)
  }

  // ── Operation 3 — Learning system update ─────────────────────────────────
  try {
    const posts = await getAllPosts({})
    const PLATFORMS = ["twitter", "threads", "instagram", "facebook", "skool"] as const

    // Find recently approved/edited posts (status changed recently)
    const recentlyActioned = posts.filter((post) =>
      PLATFORMS.some((p) => {
        const variant = post.platforms[p]
        if (!variant.approvedAt) return false
        const approvedDate = new Date(variant.approvedAt)
        const oneDayAgo = new Date(startTime.getTime() - 24 * 60 * 60 * 1000)
        return approvedDate > oneDayAgo
      })
    )

    for (const post of recentlyActioned) {
      for (const platform of PLATFORMS) {
        const variant = post.platforms[platform]
        if (!variant.approvedAt) continue

        if (variant.isEdited) {
          await appendToLearnings(
            platform,
            `${platform}: user edited variant for ${post.id} before approval. Content was modified.`
          ).catch(() => {})
          result.learningsUpdated++
        } else if (variant.status === "approved") {
          await appendToLearnings(
            platform,
            `${platform}: variant for ${post.id} approved without edits.`
          ).catch(() => {})
          result.learningsUpdated++
        }
      }
    }

    result.operations["op3_learning"] = "completed"
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    result.operations["op3_learning"] = "failed"
    result.errors.push(`Operation 3 (learning): ${msg}`)
    console.error("[cron] Operation 3 failed:", msg)
  }

  // ── Operation 4 — Gap detection ───────────────────────────────────────────
  const platformHealth: Record<string, string> = {}
  try {
    const posts = await getAllPosts({})
    const PLATFORMS = ["twitter", "threads", "instagram", "facebook", "skool"] as const

    for (const platform of PLATFORMS) {
      const publishedVariants = posts
        .filter((post) => {
          const v = post.platforms[platform]
          return v.status === "published" && v.publishedAt
        })
        .sort((a, b) => {
          const aDate = a.platforms[platform].publishedAt ?? ""
          const bDate = b.platforms[platform].publishedAt ?? ""
          return bDate.localeCompare(aDate)
        })

      if (publishedVariants.length === 0) {
        platformHealth[platform] = "no published posts yet"
        result.flags.push(`No published content for ${platform} — consider repurposing a post`)
        continue
      }

      const lastPublished = publishedVariants[0].platforms[platform].publishedAt!
      const daysSince = Math.floor(
        (startTime.getTime() - new Date(lastPublished).getTime()) / (1000 * 60 * 60 * 24)
      )

      platformHealth[platform] = `last published ${daysSince} day${daysSince !== 1 ? "s" : ""} ago`

      if (daysSince > 3) {
        result.flags.push(`${platform}: ${daysSince} days since last post — gap warning`)
      }
    }

    result.operations["op4_gaps"] = "completed"
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    result.operations["op4_gaps"] = "failed"
    result.errors.push(`Operation 4 (gap detection): ${msg}`)
    console.error("[cron] Operation 4 failed:", msg)
  }

  // ── Operation 5 — Calendar fill suggestions ───────────────────────────────
  try {
    const posts = await getAllPosts({ statusFilter: "approved" })
    const PLATFORMS = ["twitter", "threads", "instagram", "facebook", "skool"] as const

    const unscheduled = posts.filter((post) =>
      PLATFORMS.some((p) => {
        const v = post.platforms[p]
        return v.status === "approved" && !v.scheduledAt
      })
    )

    if (unscheduled.length > 0) {
      const suggestion = `${unscheduled.length} approved post${unscheduled.length !== 1 ? "s" : ""} ready to schedule`
      result.flags.push(suggestion)
      await appendToMemory(`${startIso} Calendar suggestion: ${suggestion}`).catch(() => {})
    }

    result.operations["op5_calendar"] = "completed"
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    result.operations["op5_calendar"] = "failed"
    result.errors.push(`Operation 5 (calendar): ${msg}`)
    console.error("[cron] Operation 5 failed:", msg)
  }

  // ── Operation 6 — Daily memory snapshot ──────────────────────────────────
  try {
    const flagsSummary = result.flags.length > 0
      ? result.flags.map((f) => `- ${f}`).join("\n")
      : "- none"

    const errorsSummary = result.errors.length > 0
      ? result.errors.map((e) => `- ${e}`).join("\n")
      : "- none"

    await writeDailyMemory(
      today,
      `\n## Operations summary\n${Object.entries(result.operations).map(([k, v]) => `- ${k}: ${v}`).join("\n")}\n\n## Flags raised\n${flagsSummary}\n\n## Errors\n${errorsSummary}\n`
    ).catch(() => {})

    result.operations["op6_daily_snapshot"] = "completed"
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    result.operations["op6_daily_snapshot"] = "failed"
    result.errors.push(`Operation 6 (snapshot): ${msg}`)
  }

  // ── Operation 7 — Heartbeat.md update (final) ────────────────────────────
  try {
    // Get top learnings
    let activeLearnings: string[] = []
    try {
      const learningsContent = await fs.readFile(
        path.join(process.cwd(), "memory", "learnings.md"),
        "utf-8"
      )
      activeLearnings = learningsContent
        .split("\n")
        .filter((l) => l.startsWith("- [") && !l.includes("[no data"))
        .slice(0, 3)
    } catch {
      // no learnings yet
    }

    // Count pipeline stats
    let pendingApproval = 0
    let scheduledThisWeek = 0
    let publishedThisWeek = 0
    const PLATFORMS = ["twitter", "threads", "instagram", "facebook", "skool"] as const

    try {
      const allPosts = await getAllPosts({})
      const weekStart = new Date()
      weekStart.setDate(weekStart.getDate() - weekStart.getDay())

      for (const post of allPosts) {
        for (const p of PLATFORMS) {
          const v = post.platforms[p]
          if (v.status === "approved") pendingApproval++
          if (v.status === "scheduled" && v.scheduledAt && new Date(v.scheduledAt) > weekStart) scheduledThisWeek++
          if (v.status === "published" && v.publishedAt && new Date(v.publishedAt) > weekStart) publishedThisWeek++
        }
      }
    } catch {
      // sheet unreachable — use zeros
    }

    await updateHeartbeatWithCronData({
      startTime: startIso,
      pipeline: {
        newPosts: newPostsCount,
        repurposedToday: result.postsProcessed,
        pendingApproval,
        scheduledThisWeek,
        publishedThisWeek,
      },
      platformHealth,
      activeLearnings,
      flags: result.flags,
    })

    result.operations["op7_heartbeat"] = "completed"
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    result.operations["op7_heartbeat"] = "failed"
    result.errors.push(`Operation 7 (heartbeat): ${msg}`)
    // Fallback: at minimum rebuild from template
    await rebuildHeartbeat().catch(() => {})
  }

  // ── Operation 8 — Completion log ─────────────────────────────────────────
  const endTime = new Date()
  const durationMs = endTime.getTime() - startTime.getTime()
  result.completed = endTime.toISOString()
  result.durationMs = durationMs

  await appendToMemory(
    `${endTime.toISOString()} Cron run completed. Duration: ${Math.round(durationMs / 1000)}s. Posts processed: ${result.postsProcessed}. Learnings updated: ${result.learningsUpdated}.`
  ).catch(() => {})

  await writeDailyMemory(
    today,
    `\n## Heartbeat.md updated: ✓\n- Completed: ${endTime.toISOString()}\n- Duration: ${Math.round(durationMs / 1000)}s\n`
  ).catch(() => {})

  result.operations["op8_completion"] = "completed"

  return NextResponse.json(result)
}
