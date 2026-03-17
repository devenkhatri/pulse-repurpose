"use client"

import { PlatformIcon } from "@/components/shared/PlatformIcon"
import { StatusBadge } from "@/components/dashboard/StatusBadge"
import { Button } from "@/components/ui/button"
import { truncate } from "@/lib/utils"
import { format } from "date-fns"
import { useRouter } from "next/navigation"
import type { LinkedInPost, Platform } from "@/types"

const PLATFORMS: Platform[] = ["twitter", "threads", "instagram", "facebook", "skool"]

interface PostRowProps {
  post: LinkedInPost
  onClick: () => void
}

export function PostRow({ post, onClick }: PostRowProps) {
  const router = useRouter()

  return (
    <tr
      className="border-b border-white/5 hover:bg-white/[0.02] cursor-pointer transition-colors"
      onClick={onClick}
    >
      {/* Date */}
      <td className="px-4 py-3 text-sm text-zinc-400 whitespace-nowrap">
        {post.postedAt ? format(new Date(post.postedAt), "MMM d") : "—"}
      </td>

      {/* LinkedIn post preview */}
      <td className="px-4 py-3 max-w-xs">
        <p className="text-sm text-zinc-200 line-clamp-2">
          {truncate(post.linkedinText, 80)}
        </p>
      </td>

      {/* Per-platform status badges */}
      {PLATFORMS.map((platform) => (
        <td key={platform} className="px-4 py-3">
          <div className="flex items-center gap-1.5">
            <PlatformIcon platform={platform} size="sm" />
            <StatusBadge status={post.platforms[platform].status} />
          </div>
        </td>
      ))}

      {/* Actions */}
      <td className="px-4 py-3">
        <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
          <Button
            size="sm"
            variant="outline"
            className="h-7 text-xs border-white/10 hover:border-white/20"
            onClick={() => router.push(`/repurpose?postId=${post.id}`)}
          >
            Repurpose
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="h-7 text-xs text-zinc-400 hover:text-white"
            onClick={onClick}
          >
            View
          </Button>
        </div>
      </td>
    </tr>
  )
}
