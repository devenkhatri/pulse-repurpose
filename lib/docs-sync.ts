/**
 * lib/docs-sync.ts
 *
 * Auto-documentation system for Pulse Repurpose.
 * - DOC_IMPACT_MAP: which docs are affected when specific files change
 * - DOC_GENERATION_STRATEGY: how each doc is regenerated
 * - resolveAffectedDocs: match changed files against the impact map
 * - regenerateWithClaude: use OpenRouter to intelligently update narrative docs
 * - regenerateWithTemplate: programmatically rebuild state/template docs
 * - buildDocContext: load only relevant codebase files as Claude context
 * - appendToChangelog: append a formatted entry to CHANGELOG.md
 * - appendToMemory: append a timestamped event to memory/MEMORY.md
 * - rebuildHeartbeat: rewrite Heartbeat.md from current app state
 */

import fs from "fs/promises"
import path from "path"
import { minimatch } from "minimatch"

// ---------------------------------------------------------------------------
// File-to-doc impact map
// ---------------------------------------------------------------------------

export const DOC_IMPACT_MAP: Record<string, string[]> = {
  // App routes
  "app/api/**":                        ["README.md"],
  "app/api/cron/**":                   ["README.md", "skills/cron.md", "SOUL.md"],
  "app/api/skills/**":                 ["README.md", "skills/repurpose.md"],
  "app/api/skills/platform-prompt/**": ["README.md", "skills/repurpose.md"],
  "skills/platforms/**":               ["README.md", "skills/repurpose.md"],
  "app/api/trigger/**":                ["README.md", "skills/repurpose.md"],
  "app/api/callback/**":               ["README.md", "skills/repurpose.md"],
  "app/api/publish/**":                ["README.md"],
  "app/api/docs/**":                   ["README.md"],

  // Core lib
  "lib/n8n.ts":                        ["README.md", "skills/repurpose.md", "skills/cron.md"],
  "lib/n8n-sheet.ts":                  ["README.md", "skills/repurpose.md", "skills/cron.md"],
  "lib/anthropic.ts":                  ["README.md", "SOUL.md", "skills/repurpose.md"],
  "lib/content-store.ts":              ["README.md", "skills/repurpose.md"],
  "lib/platform-rules.ts":             ["README.md", "skills/repurpose.md", "skills/cron.md"],
  "lib/brand-voice.ts":                ["README.md", "skills/repurpose.md"],

  // AOS files themselves
  "skills/repurpose.md":               ["README.md", "Heartbeat.md"],
  "skills/cron.md":                    ["README.md", "Heartbeat.md", "SOUL.md"],
  "memory/**":                         ["Heartbeat.md"],

  // Types
  "types/index.ts":                    ["README.md", "skills/repurpose.md"],

  // UI pages
  "app/dashboard/**":                  ["README.md"],
  "app/repurpose/**":                  ["README.md", "skills/repurpose.md"],
  "app/calendar/**":                   ["README.md"],
  "app/settings/**":                   ["README.md", "SOUL.md"],

  // Config
  ".env.local.example":                ["README.md"],
  "config/**":                         ["README.md", "SOUL.md"],
}

// ---------------------------------------------------------------------------
// Generation strategy per doc
// ---------------------------------------------------------------------------

export const DOC_GENERATION_STRATEGY: Record<string, "claude" | "template" | "claude+template"> = {
  "README.md":            "claude",
  "SOUL.md":              "claude",
  "skills/repurpose.md":  "claude",
  "skills/cron.md":       "claude",
  "Heartbeat.md":         "template",
  "memory/learnings.md":  "template",
}

// ---------------------------------------------------------------------------
// resolveAffectedDocs — given a list of changed files, return which docs need updating
// ---------------------------------------------------------------------------

export function resolveAffectedDocs(changedFiles: string[]): string[] {
  const affected = new Set<string>()
  for (const changed of changedFiles) {
    for (const [pattern, docs] of Object.entries(DOC_IMPACT_MAP)) {
      if (minimatch(changed, pattern)) {
        docs.forEach((d) => affected.add(d))
      }
    }
  }
  return Array.from(affected)
}

// ---------------------------------------------------------------------------
// Context builder — loads only relevant files for each doc update
// ---------------------------------------------------------------------------

async function buildDocContext(docPath: string): Promise<string> {
  const contextMap: Record<string, string[]> = {
    "README.md": [
      "package.json",
      "types/index.ts",
      "lib/platform-rules.ts",
      "SOUL.md",
    ],
    "SOUL.md": [
      "lib/platform-rules.ts",
      "lib/anthropic.ts",
      "lib/n8n.ts",
      "skills/repurpose.md",
      "skills/cron.md",
    ],
    "skills/repurpose.md": [
      "app/api/skills/repurpose/route.ts",
      "app/api/trigger/repurpose/route.ts",
      "app/api/callback/repurpose/route.ts",
      "lib/anthropic.ts",
      "lib/n8n.ts",
      "lib/content-store.ts",
    ],
    "skills/cron.md": [
      "app/api/cron/route.ts",
      "lib/n8n-sheet.ts",
      "lib/n8n.ts",
    ],
  }

  const files = contextMap[docPath] ?? []
  const parts: string[] = []

  for (const file of files) {
    try {
      const fileContent = await fs.readFile(file, "utf-8")
      parts.push(`### ${file}\n\`\`\`\n${fileContent.slice(0, 3000)}\n\`\`\``)
    } catch {
      // File doesn't exist — skip silently
    }
  }

  return parts.join("\n\n")
}

// ---------------------------------------------------------------------------
// regenerateWithClaude — update a narrative doc via OpenRouter
// ---------------------------------------------------------------------------

export async function regenerateWithClaude(
  docPath: string,
  changelogEntry: string,
  changeType: string
): Promise<void> {
  const apiKey = process.env.OPENROUTER_API_KEY
  if (!apiKey) {
    throw new Error("OPENROUTER_API_KEY is not configured — cannot regenerate docs")
  }

  const currentContent = await fs.readFile(docPath, "utf-8").catch(() => "")
  const context = await buildDocContext(docPath)

  const systemPrompt = `You are the documentation system for Pulse Repurpose — a personal content
repurposing app built as an Agentic Operating System.

Your job is to update the file "${docPath}" to accurately reflect the current state of the app
after a recent change.

Rules:
- Preserve the existing tone, structure, and style of the document
- Only update sections that are genuinely affected by the change
- Never remove sections unless the feature they describe was explicitly removed
- For README.md: keep it developer-friendly, accurate, and scannable
- For SOUL.md: only update operating principles if the change fundamentally alters how the app works
- For skills/*.md: update the specific steps or operations that changed — not the whole file
- Return the COMPLETE updated file content, not just the changed sections
- Do not add commentary, preamble, or explanation — return only the file content`

  const userPrompt = `The following change was just made to the app:

${changelogEntry}

Change type: ${changeType}

Current content of ${docPath}:
\`\`\`
${currentContent}
\`\`\`

Relevant codebase context:
${context}

Return the updated content of ${docPath} that accurately reflects this change.`

  const model = process.env.OPENROUTER_MODEL ?? "openrouter/auto"

  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
      "X-Title": "Pulse Repurpose",
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      max_tokens: 4096,
    }),
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`OpenRouter ${response.status}: ${errorText}`)
  }

  const data = (await response.json()) as {
    choices: Array<{ message: { content: string } }>
    error?: { message: string }
  }

  if (data.error) {
    throw new Error(`OpenRouter error: ${data.error.message}`)
  }

  const updatedContent = data.choices?.[0]?.message?.content ?? ""
  if (updatedContent.trim()) {
    await fs.writeFile(docPath, updatedContent, "utf-8")
  }
}

// ---------------------------------------------------------------------------
// rebuildHeartbeat — rewrite Heartbeat.md from current app state
// ---------------------------------------------------------------------------

export async function rebuildHeartbeat(): Promise<void> {
  const now = new Date().toISOString()

  // Try to read existing Heartbeat to preserve some sections
  const existing = await fs.readFile("Heartbeat.md", "utf-8").catch(() => "")

  // Extract last cron run from existing content if present
  const cronRunMatch = existing.match(/Last cron run:\s*(.+)/)
  const lastCronRun = cronRunMatch ? cronRunMatch[1].trim() : "[not yet run]"

  // Read MEMORY.md open flags
  let openFlags = "[none]"
  try {
    const memoryContent = await fs.readFile("memory/MEMORY.md", "utf-8")
    const flagsMatch = memoryContent.match(/## Open flags\n([\s\S]*?)(?:\n##|$)/)
    if (flagsMatch?.[1]?.trim() && flagsMatch[1].trim() !== "[none]") {
      openFlags = flagsMatch[1].trim()
    }
  } catch {
    // memory not readable
  }

  // Read top learnings from learnings.md
  let activeLearnings = "- [no learnings yet — will populate after first repurpose session]"
  try {
    const learningsContent = await fs.readFile("memory/learnings.md", "utf-8")
    const lines = learningsContent.split("\n").filter((l) => l.startsWith("- [") && !l.includes("[no data"))
    if (lines.length > 0) {
      activeLearnings = lines.slice(0, 3).join("\n")
    }
  } catch {
    // learnings not readable
  }

  const heartbeatContent = `# Heartbeat.md — Pulse Repurpose System State

_Last updated: ${now}_

## System status
- App: running
- n8n workflows: [status filled by cron — all active / degraded / unknown]
- Last cron run: ${lastCronRun}
- Next cron run: [scheduled daily at 07:00]

## Content pipeline status
- New LinkedIn posts since last run: [updated by cron]
- Posts repurposed today: [updated by cron]
- Posts pending approval: [updated by cron]
- Posts scheduled this week: [updated by cron]
- Posts published this week: [updated by cron]

## Platform health
- Twitter: [updated by cron]
- Threads: [updated by cron]
- Instagram: [updated by cron]
- Facebook: [updated by cron]
- Skool: [updated by cron]

## Active learning signals
${activeLearnings}

## Memory pointers
- USER.md: memory/USER.md
- MEMORY.md: memory/MEMORY.md
- learnings.md: memory/learnings.md
- Today's daily log: memory/daily/${now.split("T")[0]}.md

## Flags requiring attention
${openFlags}
`

  await fs.writeFile("Heartbeat.md", heartbeatContent, "utf-8")
}

// ---------------------------------------------------------------------------
// regenerateWithTemplate — rebuild state/template docs programmatically
// ---------------------------------------------------------------------------

export async function regenerateWithTemplate(docPath: string): Promise<void> {
  if (docPath === "Heartbeat.md") {
    await rebuildHeartbeat()
    return
  }

  if (docPath === "memory/learnings.md") {
    // Append a doc-change observation rather than rewriting
    const entry = `\n- [${new Date().toISOString().split("T")[0]}] System: Documentation auto-synced after codebase change. learnings.md structure preserved.`
    await fs.appendFile("memory/learnings.md", entry, "utf-8")
    return
  }
}

// ---------------------------------------------------------------------------
// appendToChangelog — add an entry to CHANGELOG.md
// ---------------------------------------------------------------------------

export async function appendToChangelog(entry: string): Promise<void> {
  const changelogPath = path.join(process.cwd(), "CHANGELOG.md")

  let existing = ""
  try {
    existing = await fs.readFile(changelogPath, "utf-8")
  } catch {
    existing = "# CHANGELOG.md\n\n"
  }

  // Insert after the first heading
  const insertPoint = existing.indexOf("\n\n")
  if (insertPoint === -1) {
    await fs.writeFile(changelogPath, existing + "\n\n" + entry + "\n\n---\n")
  } else {
    const before = existing.slice(0, insertPoint + 2)
    const after = existing.slice(insertPoint + 2)
    await fs.writeFile(changelogPath, before + entry + "\n\n---\n\n" + after)
  }
}

// ---------------------------------------------------------------------------
// appendToMemory — append a timestamped line to memory/MEMORY.md
// ---------------------------------------------------------------------------

export async function appendToMemory(line: string): Promise<void> {
  const memPath = path.join(process.cwd(), "memory", "MEMORY.md")

  try {
    const content = await fs.readFile(memPath, "utf-8")
    // Insert after "## Recent events" heading
    const marker = "## Recent events\n[append-only log, newest first]"
    const altMarker = "## Recent events"

    if (content.includes(marker)) {
      const updated = content.replace(marker, `${marker}\n- ${line}`)
      await fs.writeFile(memPath, updated, "utf-8")
    } else if (content.includes(altMarker)) {
      const idx = content.indexOf(altMarker) + altMarker.length
      const updated = content.slice(0, idx) + `\n- ${line}` + content.slice(idx)
      await fs.writeFile(memPath, updated, "utf-8")
    } else {
      // Fallback: append to end
      await fs.appendFile(memPath, `\n- ${line}`, "utf-8")
    }
  } catch {
    // If MEMORY.md doesn't exist yet, create it
    await fs.mkdir(path.dirname(memPath), { recursive: true })
    await fs.writeFile(
      memPath,
      `# MEMORY.md — Working Memory\n\n## Recent events\n[append-only log, newest first]\n- ${line}\n`,
      "utf-8"
    )
  }
}

// ---------------------------------------------------------------------------
// appendToLearnings — append a learning observation to learnings.md
// ---------------------------------------------------------------------------

export async function appendToLearnings(
  platform: string,
  observation: string
): Promise<void> {
  const learningsPath = path.join(process.cwd(), "memory", "learnings.md")
  const date = new Date().toISOString().split("T")[0]
  const entry = `\n- [${date}] ${observation}`

  try {
    const content = await fs.readFile(learningsPath, "utf-8")
    // Find the platform section and append there
    const sectionHeader = `### ${platform.charAt(0).toUpperCase() + platform.slice(1)}`
    if (content.includes(sectionHeader)) {
      // Find end of this platform section (next ### or ##)
      const sectionStart = content.indexOf(sectionHeader)
      const afterSection = content.indexOf("\n###", sectionStart + 1)
      const insertAt = afterSection === -1
        ? content.indexOf("\n##", sectionStart + 1)
        : afterSection

      if (insertAt === -1) {
        // Append at end of file
        await fs.appendFile(learningsPath, entry, "utf-8")
      } else {
        const updated = content.slice(0, insertAt) + entry + content.slice(insertAt)
        await fs.writeFile(learningsPath, updated, "utf-8")
      }
    } else {
      // Just append to end
      await fs.appendFile(learningsPath, entry, "utf-8")
    }

    // Update "Last updated" line
    const updated2 = await fs.readFile(learningsPath, "utf-8")
    const refreshed = updated2.replace(
      /_Last updated:.*_/,
      `_Last updated: ${new Date().toISOString()}_`
    )
    await fs.writeFile(learningsPath, refreshed, "utf-8")
  } catch {
    // learnings.md doesn't exist — create it
    await fs.mkdir(path.dirname(learningsPath), { recursive: true })
    await fs.writeFile(
      learningsPath,
      `# learnings.md — Accumulated Intelligence\n\n_Append-only._\n_Last updated: ${new Date().toISOString()}_\n\n## Approval patterns\n\n### ${platform.charAt(0).toUpperCase() + platform.slice(1)}\n${entry}\n`,
      "utf-8"
    )
  }
}
