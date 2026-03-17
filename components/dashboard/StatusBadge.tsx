import { cn } from "@/lib/utils"
import type { PostStatus } from "@/types"

interface StatusBadgeProps {
  status: PostStatus
  className?: string
}

const statusConfig: Record<PostStatus, { label: string; className: string }> = {
  pending: { label: "Pending", className: "bg-zinc-700 text-zinc-300" },
  approved: { label: "Approved", className: "bg-blue-500/20 text-blue-400" },
  scheduled: { label: "Scheduled", className: "bg-amber-500/20 text-amber-400" },
  published: { label: "Published", className: "bg-emerald-500/20 text-emerald-400" },
  failed: { label: "Failed", className: "bg-red-500/20 text-red-400" },
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const config = statusConfig[status]
  return (
    <span
      className={cn(
        "inline-flex items-center px-2 py-0.5 rounded text-xs font-medium",
        config.className,
        className
      )}
    >
      {config.label}
    </span>
  )
}
