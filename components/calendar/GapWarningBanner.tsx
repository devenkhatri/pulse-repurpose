"use client"

import { useRouter } from "next/navigation"
import type { GapWarning, Platform } from "@/types"
import { PlatformIcon } from "@/components/shared/PlatformIcon"
import { PLATFORM_RULES } from "@/lib/platform-rules"
import { AlertTriangle } from "lucide-react"

interface GapWarningBannerProps {
  warnings: GapWarning[]
}

const PLATFORM_LABELS: Record<Platform, string> = Object.fromEntries(
  Object.entries(PLATFORM_RULES).map(([k, v]) => [k, v.label])
) as Record<Platform, string>

export function GapWarningBanner({ warnings }: GapWarningBannerProps) {
  const router = useRouter()

  if (warnings.length === 0) return null

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2 text-sm font-medium text-[var(--warning)]">
        <AlertTriangle size={16} />
        <span>Content Gaps Detected</span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {warnings.map((warning) => (
          <GapWarningCard
            key={warning.platform}
            warning={warning}
            label={PLATFORM_LABELS[warning.platform]}
            onRepurpose={() => router.push("/repurpose")}
          />
        ))}
      </div>
    </div>
  )
}

interface GapWarningCardProps {
  warning: GapWarning
  label: string
  onRepurpose: () => void
}

function GapWarningCard({ warning, label, onRepurpose }: GapWarningCardProps) {
  const daysText =
    warning.daysGap >= 999
      ? "Never posted"
      : `${warning.daysGap} day${warning.daysGap !== 1 ? "s" : ""} since last post`

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-[var(--warning)]/20 bg-[var(--warning)]/5 p-4">
      <div className="flex items-center gap-2">
        <PlatformIcon platform={warning.platform} size="sm" />
        <span className="text-sm font-semibold text-white">{label}</span>
      </div>

      <div className="flex flex-col gap-1">
        <p className="text-xs text-[var(--warning)]">{daysText}</p>
        {warning.pillarGap && (
          <p className="text-xs text-white/50">{warning.pillarGap}</p>
        )}
      </div>

      <button
        onClick={onRepurpose}
        className="self-start text-xs font-medium text-[var(--accent)] hover:text-[var(--accent)]/80 transition-colors underline underline-offset-2"
      >
        Repurpose a post →
      </button>
    </div>
  )
}
