"use client"

import { LoadingSpinner } from "@/components/shared/LoadingSpinner"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import type { BulkPostResult } from "@/app/api/trigger/repurpose/bulk/route"

interface BulkProgressPanelProps {
  loading: boolean
  postCount: number
  results: BulkPostResult[] | null
  onClose: () => void
}

const STATUS_CONFIG = {
  queued: {
    label: "Queued",
    className: "text-emerald-400",
    dot: "bg-emerald-400",
  },
  skipped: {
    label: "Skipped",
    className: "text-amber-400",
    dot: "bg-amber-400",
  },
  failed: {
    label: "Failed",
    className: "text-red-400",
    dot: "bg-red-400",
  },
} as const

export function BulkProgressPanel({
  loading,
  postCount,
  results,
  onClose,
}: BulkProgressPanelProps) {
  const queued = results?.filter((r) => r.status === "queued").length ?? 0
  const skipped = results?.filter((r) => r.status === "skipped").length ?? 0
  const failed = results?.filter((r) => r.status === "failed").length ?? 0

  return (
    <div className="border border-white/10 rounded-lg bg-[#161616] p-4 mb-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          {loading && <LoadingSpinner size="sm" />}
          <span className="text-sm font-medium text-zinc-200">
            {loading
              ? `Queuing ${postCount} post${postCount !== 1 ? "s" : ""} for repurpose…`
              : "Bulk repurpose complete"}
          </span>
        </div>
        {!loading && (
          <Button
            size="sm"
            variant="ghost"
            className="h-7 text-xs text-zinc-500 hover:text-white"
            onClick={onClose}
          >
            Close
          </Button>
        )}
      </div>

      {/* Summary pills — shown after completion */}
      {!loading && results && (
        <div className="flex items-center gap-3 mb-3">
          <span className="text-xs text-emerald-400 font-medium">{queued} queued</span>
          <span className="text-xs text-zinc-600">·</span>
          <span className="text-xs text-amber-400 font-medium">{skipped} skipped</span>
          <span className="text-xs text-zinc-600">·</span>
          <span className="text-xs text-red-400 font-medium">{failed} failed</span>
        </div>
      )}

      {/* Per-post result rows */}
      {results && results.length > 0 && (
        <div className="space-y-1 max-h-48 overflow-y-auto">
          {results.map((result) => {
            const cfg = STATUS_CONFIG[result.status]
            return (
              <div
                key={result.postId}
                className="flex items-center gap-2 text-xs text-zinc-400 py-1 border-b border-white/5 last:border-0"
              >
                <span className={cn("w-2 h-2 rounded-full flex-shrink-0", cfg.dot)} />
                <span className="font-mono text-zinc-600 shrink-0">
                  #{result.postId.slice(-6)}
                </span>
                <span className={cn("font-medium shrink-0", cfg.className)}>{cfg.label}</span>
                {result.reason && (
                  <span className="text-zinc-600 truncate">{result.reason}</span>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Loading placeholder rows */}
      {loading && (
        <div className="space-y-1">
          {Array.from({ length: Math.min(postCount, 5) }).map((_, i) => (
            <div key={i} className="flex items-center gap-2 py-1">
              <span className="w-2 h-2 rounded-full bg-white/10 animate-pulse flex-shrink-0" />
              <span className="h-3 w-32 bg-white/5 rounded animate-pulse" />
            </div>
          ))}
          {postCount > 5 && (
            <p className="text-xs text-zinc-600 pt-1">
              + {postCount - 5} more…
            </p>
          )}
        </div>
      )}
    </div>
  )
}
