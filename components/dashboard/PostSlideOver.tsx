"use client"

import { useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import { X, ExternalLink, CheckCircle, XCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { PlatformIcon } from "@/components/shared/PlatformIcon"
import { StatusBadge } from "@/components/dashboard/StatusBadge"
import { format } from "date-fns"
import { toast } from "sonner"
import type { LinkedInPost, Platform } from "@/types"

const PLATFORMS: Platform[] = ["twitter", "threads", "instagram", "facebook", "skool"]

interface PostSlideOverProps {
  post: LinkedInPost | null
  onClose: () => void
  onApprove: (postId: string, platform: Platform) => Promise<void>
  onReject: (postId: string, platform: Platform) => Promise<void>
}

export function PostSlideOver({ post, onClose, onApprove, onReject }: PostSlideOverProps) {
  const router = useRouter()
  const overlayRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose()
    }
    document.addEventListener("keydown", handleKey)
    return () => document.removeEventListener("keydown", handleKey)
  }, [onClose])

  if (!post) return null

  const handleApprove = async (platform: Platform) => {
    try {
      await onApprove(post.id, platform)
      toast.success(`${platform} approved`)
    } catch {
      toast.error(`Failed to approve ${platform}`)
    }
  }

  const handleReject = async (platform: Platform) => {
    try {
      await onReject(post.id, platform)
      toast.success(`${platform} rejected`)
    } catch {
      toast.error(`Failed to reject ${platform}`)
    }
  }

  return (
    <>
      {/* Backdrop */}
      <div
        ref={overlayRef}
        className="fixed inset-0 bg-black/60 z-40"
        onClick={onClose}
      />

      {/* Slide-over panel */}
      <div className="fixed right-0 top-0 h-full w-[480px] max-w-full bg-[#111111] border-l border-white/10 z-50 flex flex-col shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/10 flex-shrink-0">
          <div>
            <h2 className="text-base font-semibold text-white">Post Details</h2>
            <p className="text-xs text-zinc-500 mt-0.5">
              {format(new Date(post.postedAt), "MMMM d, yyyy")}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              className="h-8 text-xs border-white/10 gap-1"
              onClick={() => {
                router.push(`/repurpose?postId=${post.id}`)
                onClose()
              }}
            >
              <ExternalLink className="w-3 h-3" />
              Edit in Repurpose
            </Button>
            <button
              onClick={onClose}
              className="p-1.5 rounded hover:bg-white/5 text-zinc-400 hover:text-white transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        <ScrollArea className="flex-1">
          <div className="p-5 space-y-6">
            {/* Original LinkedIn post */}
            <div>
              <h3 className="text-xs font-medium text-zinc-500 uppercase tracking-wider mb-2">
                Original LinkedIn Post
              </h3>
              <div className="p-3 rounded-lg bg-[#1a1a1a] border border-white/5">
                {post.linkedinImageUrl && (
                  <img
                    src={post.linkedinImageUrl}
                    alt="Post image"
                    className="w-full rounded mb-2 object-cover max-h-48"
                  />
                )}
                <p className="text-sm text-zinc-200 whitespace-pre-wrap leading-relaxed">
                  {post.linkedinText}
                </p>
              </div>
            </div>

            {/* Per-platform variants */}
            <div>
              <h3 className="text-xs font-medium text-zinc-500 uppercase tracking-wider mb-3">
                Platform Variants
              </h3>
              <div className="space-y-3">
                {PLATFORMS.map((platform) => {
                  const variant = post.platforms[platform]
                  const canApprove = variant.status === "pending" && variant.text
                  const canReject = variant.status === "approved" || variant.status === "scheduled"

                  return (
                    <div
                      key={platform}
                      className="p-3 rounded-lg bg-[#1a1a1a] border border-white/5"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <PlatformIcon platform={platform} size="sm" />
                          <span className="text-sm font-medium text-white capitalize">
                            {platform}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <StatusBadge status={variant.status} />
                          {canApprove && (
                            <button
                              onClick={() => handleApprove(platform)}
                              className="p-1 rounded hover:bg-emerald-500/10 text-zinc-500 hover:text-emerald-400 transition-colors"
                              title="Approve"
                            >
                              <CheckCircle className="w-4 h-4" />
                            </button>
                          )}
                          {canReject && (
                            <button
                              onClick={() => handleReject(platform)}
                              className="p-1 rounded hover:bg-red-500/10 text-zinc-500 hover:text-red-400 transition-colors"
                              title="Reject"
                            >
                              <XCircle className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </div>

                      {variant.text ? (
                        <>
                          <p className="text-xs text-zinc-300 leading-relaxed whitespace-pre-wrap">
                            {variant.text}
                          </p>
                          {variant.hashtags.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-2">
                              {variant.hashtags.map((tag) => (
                                <span
                                  key={tag}
                                  className="text-[10px] text-zinc-500 bg-zinc-800 px-1.5 py-0.5 rounded"
                                >
                                  #{tag}
                                </span>
                              ))}
                            </div>
                          )}
                          {variant.imageUrl && (
                            <img
                              src={variant.imageUrl}
                              alt={`${platform} image`}
                              className="mt-2 w-full rounded object-cover max-h-36"
                            />
                          )}
                          {variant.scheduledAt && (
                            <p className="text-[10px] text-zinc-500 mt-2">
                              Scheduled: {format(new Date(variant.scheduledAt), "MMM d, yyyy h:mm a")}
                            </p>
                          )}
                        </>
                      ) : (
                        <p className="text-xs text-zinc-600 italic">
                          Not generated yet
                        </p>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        </ScrollArea>
      </div>
    </>
  )
}
