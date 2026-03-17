import { PlatformIcon } from "@/components/shared/PlatformIcon"
import { StatusBadge } from "@/components/dashboard/StatusBadge"
import type { LinkedInPost, Platform } from "@/types"

const PLATFORMS: Platform[] = ["twitter", "threads", "instagram", "facebook", "skool"]

interface PlatformStatusGridProps {
  post: LinkedInPost
  compact?: boolean
}

export function PlatformStatusGrid({ post, compact = false }: PlatformStatusGridProps) {
  if (compact) {
    return (
      <div className="flex items-center gap-1.5">
        {PLATFORMS.map((platform) => {
          const variant = post.platforms[platform]
          return (
            <div key={platform} className="flex items-center gap-1">
              <PlatformIcon platform={platform} size="sm" />
              <StatusBadge status={variant.status} />
            </div>
          )
        })}
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 gap-3">
      {PLATFORMS.map((platform) => {
        const variant = post.platforms[platform]
        return (
          <div key={platform} className="flex items-start gap-3 p-3 rounded-lg bg-[#1a1a1a] border border-white/5">
            <PlatformIcon platform={platform} size="md" />
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm font-medium text-white capitalize">{platform}</span>
                <StatusBadge status={variant.status} />
              </div>
              {variant.text ? (
                <p className="text-xs text-zinc-400 line-clamp-2">{variant.text}</p>
              ) : (
                <p className="text-xs text-zinc-600 italic">Not generated yet</p>
              )}
              {variant.hashtags.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-1.5">
                  {variant.hashtags.map((tag) => (
                    <span key={tag} className="text-[10px] text-zinc-500 bg-zinc-800 px-1.5 py-0.5 rounded">
                      #{tag}
                    </span>
                  ))}
                </div>
              )}
              {variant.scheduledAt && (
                <p className="text-[10px] text-zinc-500 mt-1">
                  Scheduled: {new Date(variant.scheduledAt).toLocaleString()}
                </p>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
