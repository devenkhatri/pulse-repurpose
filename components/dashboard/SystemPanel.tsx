"use client"

import { useState, useEffect, useCallback } from "react"
import { ChevronDown, ChevronUp, Activity, Brain, Database, AlertTriangle, RefreshCw, FileText, Check, Clock } from "lucide-react"
import { toast } from "sonner"
import { ConfirmDialog } from "@/components/shared/ConfirmDialog"

// ---------------------------------------------------------------------------
// Types
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
  error?: string
}

interface DocStatus {
  lastUpdated: string | null
  status: "fresh" | "stale" | "missing"
}

interface DocsStatusData {
  docs: Record<string, DocStatus>
  lastChangelogEntry: string | null
  staleDocs: string[]
}

// ---------------------------------------------------------------------------
// HeartbeatPanel
// ---------------------------------------------------------------------------

function HeartbeatPanel({ data }: { data: HeartbeatData }) {
  return (
    <div className="space-y-3">
      {/* Status row */}
      <div className="flex items-center gap-4 text-sm flex-wrap">
        <span className="flex items-center gap-1.5">
          <span className="size-2 rounded-full bg-emerald-500 inline-block" />
          <span className="text-zinc-400">App running</span>
        </span>
        <span className="text-zinc-600">·</span>
        <span className="text-zinc-400">
          Last cron: <span className="text-zinc-300">{data.systemStatus.lastCronRun}</span>
        </span>
        {data.lastUpdated && (
          <>
            <span className="text-zinc-600">·</span>
            <span className="text-zinc-500 text-xs">
              Updated {new Date(data.lastUpdated).toLocaleString()}
            </span>
          </>
        )}
      </div>

      {/* Pipeline counts */}
      <div className="grid grid-cols-5 gap-2">
        {[
          { label: "New posts", value: data.pipeline.newPostsSinceLastRun },
          { label: "Repurposed today", value: data.pipeline.repurposedToday },
          { label: "Pending approval", value: data.pipeline.pendingApproval },
          { label: "Scheduled / week", value: data.pipeline.scheduledThisWeek },
          { label: "Published / week", value: data.pipeline.publishedThisWeek },
        ].map(({ label, value }) => (
          <div
            key={label}
            className="bg-[#0A0A0A] border border-white/5 rounded-md px-3 py-2 text-center"
          >
            <p className="text-lg font-semibold text-white leading-none">
              {value === "[updated by cron]" || value === "[not yet run]" ? "—" : value}
            </p>
            <p className="text-[10px] text-zinc-600 mt-1 leading-tight">{label}</p>
          </div>
        ))}
      </div>

      {/* Flags */}
      {data.flags.length > 0 && (
        <div className="flex flex-wrap gap-2 mt-1">
          {data.flags.map((flag, i) => (
            <span
              key={i}
              className="inline-flex items-center gap-1 text-xs bg-amber-500/10 text-amber-400 border border-amber-500/20 rounded-full px-2.5 py-1"
            >
              <AlertTriangle className="size-3" />
              {flag}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// LearningsPanel
// ---------------------------------------------------------------------------

function LearningsPanel({ learnings }: { learnings: string[] }) {
  if (learnings.length === 0) {
    return (
      <p className="text-sm text-zinc-600 italic">
        No learnings yet — will populate after first repurpose sessions.
      </p>
    )
  }

  return (
    <ul className="space-y-1.5">
      {learnings.slice(0, 5).map((learning, i) => (
        <li key={i} className="text-sm text-zinc-400 flex items-start gap-2">
          <Brain className="size-3.5 text-violet-400 mt-0.5 shrink-0" />
          <span>{learning.replace(/^- /, "")}</span>
        </li>
      ))}
    </ul>
  )
}

// ---------------------------------------------------------------------------
// MemoryPanel
// ---------------------------------------------------------------------------

function MemoryPanel() {
  const [memory, setMemory] = useState<string>("")
  const [note, setNote] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [expanded, setExpanded] = useState(false)

  useEffect(() => {
    fetch("/api/memory")
      .then((r) => r.json())
      .then((d: { memory?: string; learnings?: string }) => setMemory(d.memory ?? ""))
      .catch(() => {})
  }, [])

  const handleAddNote = async () => {
    if (!note.trim()) return
    setSubmitting(true)
    try {
      const res = await fetch("/api/memory/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ note: note.trim() }),
      })
      if (!res.ok) throw new Error("Failed to save note")
      toast.success("Note added to memory")
      setNote("")
      // Refresh memory
      const data = await fetch("/api/memory").then((r) => r.json()) as { memory?: string }
      setMemory(data.memory ?? "")
    } catch {
      toast.error("Failed to add note")
    } finally {
      setSubmitting(false)
    }
  }

  // Extract open flags from memory
  const flagsMatch = memory.match(/## Open flags\n([\s\S]*?)(?:\n##|$)/)
  const flags = flagsMatch?.[1]?.trim() ?? "[none]"

  // Extract recent events (first 5)
  const eventsMatch = memory.match(/## Recent events\n[\s\S]*?\n((?:- .*\n?){0,5})/)
  const recentEvents = eventsMatch?.[1]?.trim() ?? ""

  return (
    <div className="space-y-3">
      {/* Open flags */}
      <div>
        <p className="text-xs font-medium text-zinc-500 uppercase tracking-wide mb-1.5">Open Flags</p>
        <pre className="text-xs text-zinc-400 whitespace-pre-wrap font-mono bg-[#0A0A0A] rounded-md p-3 border border-white/5">
          {flags === "[none]" ? "No open flags" : flags}
        </pre>
      </div>

      {/* Recent events */}
      {recentEvents && (
        <div>
          <p className="text-xs font-medium text-zinc-500 uppercase tracking-wide mb-1.5">Recent Events</p>
          <pre className="text-xs text-zinc-500 whitespace-pre-wrap font-mono bg-[#0A0A0A] rounded-md p-3 border border-white/5">
            {recentEvents}
          </pre>
        </div>
      )}

      {/* Full memory toggle */}
      {memory && (
        <button
          onClick={() => setExpanded((v) => !v)}
          className="text-xs text-violet-400 hover:text-violet-300 transition-colors"
        >
          {expanded ? "Hide full memory" : "Show full memory"}
        </button>
      )}
      {expanded && (
        <pre className="text-xs text-zinc-500 whitespace-pre-wrap font-mono bg-[#0A0A0A] rounded-md p-3 border border-white/5 max-h-48 overflow-y-auto">
          {memory || "Memory file not found"}
        </pre>
      )}

      {/* Add note */}
      <div className="flex gap-2 mt-1">
        <input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleAddNote()}
          placeholder="Add context note to memory..."
          className="flex-1 bg-[#0A0A0A] border border-white/10 rounded-md px-3 py-1.5 text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:ring-1 focus:ring-violet-500/50"
        />
        <button
          onClick={handleAddNote}
          disabled={submitting || !note.trim()}
          className="px-3 py-1.5 bg-violet-600 hover:bg-violet-700 disabled:opacity-40 text-white text-sm rounded-md transition-colors"
        >
          Add
        </button>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// DocsStatusPanel
// ---------------------------------------------------------------------------

function DocsStatusPanel() {
  const [docsStatus, setDocsStatus] = useState<DocsStatusData | null>(null)
  const [syncing, setSyncing] = useState(false)

  const fetchDocsStatus = useCallback(async () => {
    try {
      const data = await fetch("/api/docs/status").then((r) => r.json()) as DocsStatusData
      setDocsStatus(data)
    } catch {
      // silent
    }
  }, [])

  useEffect(() => {
    fetchDocsStatus()
  }, [fetchDocsStatus])

  const handleSyncDocs = async () => {
    setSyncing(true)
    try {
      const res = await fetch("/api/docs/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          changelogEntry: `## [${new Date().toISOString().split("T")[0]}] — Manual doc sync\n\n### Type: feature-updated\n### Files changed: [manual trigger]\n### Summary: Manual documentation sync triggered from dashboard.\n### Docs affected: all`,
          changedFiles: ["app/api/**"],
          changeType: "feature-updated",
          forceAll: true,
        }),
      })
      if (!res.ok) throw new Error("Sync failed")
      toast.success("Docs synced")
      await fetchDocsStatus()
    } catch {
      toast.error("Doc sync failed")
    } finally {
      setSyncing(false)
    }
  }

  if (!docsStatus) {
    return <p className="text-sm text-zinc-600">Loading docs status...</p>
  }

  const hasStale = docsStatus.staleDocs.length > 0

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex flex-wrap gap-2">
          {Object.entries(docsStatus.docs).map(([doc, info]) => (
            <span
              key={doc}
              className={`inline-flex items-center gap-1 text-xs rounded-full px-2.5 py-1 border ${
                info.status === "fresh"
                  ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                  : info.status === "stale"
                  ? "bg-amber-500/10 text-amber-400 border-amber-500/20"
                  : "bg-red-500/10 text-red-400 border-red-500/20"
              }`}
            >
              {info.status === "fresh" ? (
                <Check className="size-3" />
              ) : (
                <Clock className="size-3" />
              )}
              {doc}
            </span>
          ))}
        </div>
        {hasStale && (
          <button
            onClick={handleSyncDocs}
            disabled={syncing}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white text-xs rounded-md transition-colors whitespace-nowrap"
          >
            <FileText className="size-3" />
            {syncing ? "Syncing..." : "Sync docs"}
          </button>
        )}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// SystemPanel — main collapsible component
// ---------------------------------------------------------------------------

export function SystemPanel() {
  const [open, setOpen] = useState(false)
  const [activeTab, setActiveTab] = useState<"heartbeat" | "learnings" | "memory" | "docs">("heartbeat")
  const [heartbeat, setHeartbeat] = useState<HeartbeatData | null>(null)
  const [cronRunning, setCronRunning] = useState(false)
  const [showCronConfirm, setShowCronConfirm] = useState(false)

  const fetchHeartbeat = useCallback(async () => {
    try {
      const data = await fetch("/api/heartbeat").then((r) => r.json()) as HeartbeatData
      setHeartbeat(data)
    } catch {
      // silent
    }
  }, [])

  useEffect(() => {
    fetchHeartbeat()
  }, [fetchHeartbeat])

  const handleRunCron = async () => {
    setCronRunning(true)
    try {
      const res = await fetch("/api/cron", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(process.env.NEXT_PUBLIC_CRON_SECRET
            ? { Authorization: `Bearer ${process.env.NEXT_PUBLIC_CRON_SECRET}` }
            : {}),
        },
      })
      const data = await res.json() as { aborted?: boolean; reason?: string; errors?: string[] }
      if (data.aborted) {
        toast.info(`Cron aborted: ${data.reason ?? "duplicate run guard"}`)
      } else if (!res.ok) {
        toast.error("Cron run failed")
      } else {
        const errCount = data.errors?.length ?? 0
        toast.success(`Cron run complete${errCount > 0 ? ` (${errCount} errors)` : ""}`)
        await fetchHeartbeat()
      }
    } catch {
      toast.error("Failed to trigger cron")
    } finally {
      setCronRunning(false)
    }
  }

  const tabs = [
    { id: "heartbeat" as const, label: "Heartbeat", icon: Activity },
    { id: "learnings" as const, label: "Learnings", icon: Brain },
    { id: "memory" as const, label: "Memory", icon: Database },
    { id: "docs" as const, label: "Docs", icon: FileText },
  ]

  return (
    <div className="bg-[#161616] border border-white/10 rounded-xl mb-6 overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-5 py-3.5 hover:bg-white/[0.02] transition-colors"
      >
        <div className="flex items-center gap-2.5">
          <Activity className="size-4 text-violet-400" />
          <span className="text-sm font-medium text-zinc-200">System</span>
          {heartbeat?.flags && heartbeat.flags.length > 0 && (
            <span className="inline-flex items-center justify-center size-4 rounded-full bg-amber-500/20 text-amber-400 text-[10px] font-bold">
              {heartbeat.flags.length}
            </span>
          )}
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={(e) => {
              e.stopPropagation()
              setShowCronConfirm(true)
            }}
            disabled={cronRunning}
            className="flex items-center gap-1.5 text-xs text-zinc-400 hover:text-zinc-200 disabled:opacity-40 transition-colors px-2.5 py-1 rounded-md border border-white/10 hover:border-white/20"
          >
            <RefreshCw className={`size-3 ${cronRunning ? "animate-spin" : ""}`} />
            {cronRunning ? "Running..." : "Run cron"}
          </button>
          {open ? (
            <ChevronUp className="size-4 text-zinc-500" />
          ) : (
            <ChevronDown className="size-4 text-zinc-500" />
          )}
        </div>
      </button>

      {/* Expanded content */}
      {open && (
        <div className="border-t border-white/10">
          {/* Tab bar */}
          <div className="flex border-b border-white/10 px-5 gap-1">
            {tabs.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => setActiveTab(id)}
                className={`flex items-center gap-1.5 text-xs px-3 py-2.5 border-b-2 transition-colors ${
                  activeTab === id
                    ? "border-violet-500 text-violet-400"
                    : "border-transparent text-zinc-500 hover:text-zinc-300"
                }`}
              >
                <Icon className="size-3.5" />
                {label}
              </button>
            ))}
          </div>

          {/* Tab content */}
          <div className="p-5">
            {activeTab === "heartbeat" && heartbeat && (
              <HeartbeatPanel data={heartbeat} />
            )}
            {activeTab === "heartbeat" && !heartbeat && (
              <p className="text-sm text-zinc-600">Loading heartbeat...</p>
            )}
            {activeTab === "learnings" && (
              <LearningsPanel learnings={heartbeat?.activeLearnings ?? []} />
            )}
            {activeTab === "memory" && <MemoryPanel />}
            {activeTab === "docs" && <DocsStatusPanel />}
          </div>
        </div>
      )}

      {/* Cron confirm dialog */}
      <ConfirmDialog
        open={showCronConfirm}
        title="Run cron now?"
        description="This will execute all 8 cron operations: ingest new posts, update learnings, detect gaps, generate calendar suggestions, and update Heartbeat.md."
        confirmLabel="Run cron"
        onConfirm={() => {
          setShowCronConfirm(false)
          void handleRunCron()
        }}
        onCancel={() => setShowCronConfirm(false)}
      />
    </div>
  )
}
