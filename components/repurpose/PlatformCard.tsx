"use client"

import { useState, useRef, useEffect } from "react"
import { toast } from "sonner"
import axios from "axios"
import { PlatformIcon } from "@/components/shared/PlatformIcon"
import { StatusBadge } from "@/components/dashboard/StatusBadge"
import { ApproveButton } from "@/components/repurpose/ApproveButton"
import { ImagePreview } from "@/components/repurpose/ImagePreview"
import { HashtagSuggestions } from "@/components/repurpose/HashtagSuggestions"
import { ConfirmDialog } from "@/components/shared/ConfirmDialog"
import { useRepurposeStore } from "@/stores/repurposeStore"
import { PLATFORM_RULES } from "@/lib/platform-rules"
import { cn } from "@/lib/utils"
import type { Platform, PlatformVariant, RepurposeVariantDraft } from "@/types"

interface PlatformCardProps {
  platform: Platform
  postId: string
  platformVariant: PlatformVariant
  localVariant: RepurposeVariantDraft | undefined
  isTextGenerating: boolean
  isImageGenerating: boolean
  isActive: boolean
  onFocus: (platform: Platform) => void
  onRefresh: () => Promise<void>
}

export function PlatformCard({
  platform,
  postId,
  platformVariant,
  localVariant,
  isTextGenerating,
  isImageGenerating,
  isActive,
  onFocus,
  onRefresh,
}: PlatformCardProps) {
  const { setVariantText, setVariantApproved, setVariantHashtags } = useRepurposeStore()

  const [scheduledAt, setScheduledAt] = useState<string>("")
  const [isPublishing, setIsPublishing] = useState(false)
  const [isApproving, setIsApproving] = useState(false)
  const [newHashtag, setNewHashtag] = useState("")
  const [showDuplicateConfirm, setShowDuplicateConfirm] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const rules = PLATFORM_RULES[platform]
  const text = localVariant?.text ?? platformVariant.text ?? ""
  const hashtags = localVariant?.hashtags ?? platformVariant.hashtags ?? []
  const isApproved = localVariant?.isApproved ?? false
  const isEdited = localVariant?.isEdited ?? platformVariant.isEdited
  const charCount = text.length
  const isOverLimit = charCount > rules.maxChars

  // Auto-resize textarea
  useEffect(() => {
    const ta = textareaRef.current
    if (!ta) return
    ta.style.height = "auto"
    ta.style.height = `${ta.scrollHeight}px`
  }, [text])

  if (isTextGenerating && !platformVariant.text) {
    return (
      <div
        className="bg-[#161616] border border-[#2A2A2A] rounded-xl p-4 cursor-pointer"
        onClick={() => onFocus(platform)}
      >
        <div className="flex items-center gap-2 mb-3">
          <PlatformIcon platform={platform} size="sm" />
          <span className="text-sm font-medium text-[#888888]">{rules.label}</span>
        </div>
        <div className="space-y-2 animate-pulse">
          <div className="h-3 bg-[#222222] rounded w-full" />
          <div className="h-3 bg-[#222222] rounded w-4/5" />
          <div className="h-3 bg-[#222222] rounded w-3/5" />
          <div className="h-3 bg-[#222222] rounded w-full" />
          <div className="h-3 bg-[#222222] rounded w-2/3" />
        </div>
        <p className="text-xs text-[#555555] mt-3">Waiting for n8n...</p>
      </div>
    )
  }

  const handleApprove = async () => {
    if (isApproving) return
    const newApproved = !isApproved

    // Warn if over character limit — but still allow approval
    if (newApproved && isOverLimit) {
      toast.warning(
        `${rules.label} is ${charCount - rules.maxChars} chars over the ${rules.maxChars.toLocaleString()} limit — approved anyway`,
        { duration: 4000 }
      )
    }

    setIsApproving(true)
    setVariantApproved(platform, newApproved)

    try {
      await axios.patch(`/api/posts/${postId}`, {
        platform,
        variant: {
          status: newApproved ? "approved" : "pending",
          approvedAt: newApproved ? new Date().toISOString() : null,
          text: localVariant?.isEdited ? text : undefined,
          isEdited: localVariant?.isEdited,
        },
      })
      await onRefresh()
    } catch {
      setVariantApproved(platform, !newApproved)
      toast.error("Failed to update approval status")
    } finally {
      setIsApproving(false)
    }
  }

  const handleSaveEdit = async () => {
    try {
      await axios.patch(`/api/posts/${postId}`, {
        platform,
        variant: { text, isEdited: true },
      })
      toast.success("Changes saved")
      await onRefresh()
    } catch {
      toast.error("Failed to save changes")
    }
  }

  const doPublish = async () => {
    if (isPublishing) return

    // Validate schedule time: must be at least 15 minutes in the future
    if (scheduledAt) {
      const scheduledMs = new Date(scheduledAt).getTime()
      const minMs = Date.now() + 15 * 60 * 1000
      if (scheduledMs < minMs) {
        toast.error("Scheduled time must be at least 15 minutes in the future")
        return
      }
    }

    setIsPublishing(true)
    try {
      await axios.post("/api/publish", {
        postId,
        platform,
        scheduledAt: scheduledAt || null,
      })
      toast.success(
        scheduledAt
          ? `Scheduled for ${new Date(scheduledAt).toLocaleString()}`
          : "Published successfully"
      )
      await onRefresh()
    } catch (err) {
      const msg =
        axios.isAxiosError(err) && err.response?.data?.error
          ? err.response.data.error
          : "Publish failed"
      toast.error(msg, {
        action: { label: "Retry", onClick: handlePublish },
      })
    } finally {
      setIsPublishing(false)
    }
  }

  const handlePublish = () => {
    // Duplicate publish prevention: warn if already scheduled or published
    if (
      platformVariant.status === "scheduled" ||
      platformVariant.status === "published"
    ) {
      setShowDuplicateConfirm(true)
      return
    }
    void doPublish()
  }

  const handleRemoveHashtag = (tag: string) => {
    setVariantHashtags(platform, hashtags.filter((h) => h !== tag))
  }

  const handleAddHashtag = () => {
    const tag = newHashtag.trim().replace(/^#/, "")
    if (!tag || hashtags.includes(tag)) return
    setVariantHashtags(platform, [...hashtags, tag])
    setNewHashtag("")
  }

  const isPublished =
    platformVariant.status === "published" || platformVariant.status === "scheduled"

  return (
    <>
    <ConfirmDialog
      open={showDuplicateConfirm}
      title={`${rules.label} is already ${platformVariant.status}`}
      description={`This post is already ${platformVariant.status} for ${rules.label}. Publish again?`}
      confirmLabel="Publish again"
      onConfirm={() => {
        setShowDuplicateConfirm(false)
        void doPublish()
      }}
      onCancel={() => setShowDuplicateConfirm(false)}
    />
    <div
      className={cn(
        "bg-[#161616] border rounded-xl p-4 space-y-3 transition-all cursor-pointer",
        isActive
          ? "border-[#7C3AED]/60 ring-1 ring-[#7C3AED]/20"
          : isEdited
          ? "border-amber-500/30 hover:border-amber-500/50"
          : "border-[#2A2A2A] hover:border-[#3A3A3A]"
      )}
      onClick={() => onFocus(platform)}
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <PlatformIcon platform={platform} size="sm" />
          <span className="text-sm font-medium text-[#F5F5F5]">{rules.label}</span>
          {isEdited && (
            <span className="text-[10px] text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded">
              edited
            </span>
          )}
          {isActive && (
            <span className="text-[10px] text-[#7C3AED] bg-[#7C3AED]/10 px-1.5 py-0.5 rounded">
              active
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <StatusBadge status={platformVariant.status} />
          <ApproveButton
            isApproved={isApproved}
            disabled={!text || isApproving || isPublished}
            onClick={(e) => {
              e.stopPropagation()
              handleApprove()
            }}
          />
        </div>
      </div>

      {/* Textarea */}
      {(text || !isTextGenerating) && (
        <div
          className="space-y-1"
          onClick={(e) => e.stopPropagation()}
        >
          <textarea
            ref={textareaRef}
            value={text}
            onChange={(e) => setVariantText(platform, e.target.value)}
            onBlur={localVariant?.isEdited ? handleSaveEdit : undefined}
            placeholder="No text generated yet"
            disabled={isPublished}
            className={cn(
              "w-full bg-[#111111] text-[#F5F5F5] text-sm rounded-lg p-3 resize-none outline-none focus:ring-1 transition-colors min-h-[80px]",
              "border border-[#2A2A2A] focus:border-[#7C3AED] focus:ring-[#7C3AED]/30",
              isPublished && "opacity-60 cursor-not-allowed",
              "font-mono leading-relaxed"
            )}
            style={{ overflow: "hidden" }}
          />
          <div className="flex justify-end">
            <span
              className={cn(
                "text-xs tabular-nums",
                isOverLimit ? "text-red-400 font-medium" : "text-[#555555]"
              )}
            >
              {charCount.toLocaleString()} / {rules.maxChars.toLocaleString()}
            </span>
          </div>
        </div>
      )}

      {/* Image */}
      <div onClick={(e) => e.stopPropagation()}>
        <ImagePreview
          imageUrl={platformVariant.imageUrl}
          isGenerating={isImageGenerating && !platformVariant.imageUrl}
          platform={platform}
        />
      </div>

      {/* Hashtags */}
      {rules.hashtagCount.max > 0 && (
        <div
          className="space-y-2"
          onClick={(e) => e.stopPropagation()}
        >
          <p className="text-xs text-[#555555] uppercase tracking-wider">
            Hashtags ({hashtags.length}/{rules.hashtagCount.max})
          </p>
          <div className="flex flex-wrap gap-1.5">
            {hashtags.map((tag) => (
              <span
                key={tag}
                className="inline-flex items-center gap-1 text-xs bg-[#7C3AED]/20 text-[#A78BFA] px-2 py-0.5 rounded-full"
              >
                #{tag}
                {!isPublished && (
                  <button
                    onClick={() => handleRemoveHashtag(tag)}
                    className="hover:text-red-400 transition-colors"
                    aria-label={`Remove #${tag}`}
                  >
                    ×
                  </button>
                )}
              </span>
            ))}
            {!isPublished && hashtags.length < rules.hashtagCount.max && (
              <div className="flex items-center gap-1">
                <input
                  value={newHashtag}
                  onChange={(e) => setNewHashtag(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleAddHashtag()}
                  placeholder="add tag"
                  className="text-xs bg-[#111111] border border-[#2A2A2A] rounded-full px-2 py-0.5 text-[#888888] w-20 outline-none focus:border-[#7C3AED]"
                />
                <button
                  onClick={handleAddHashtag}
                  className="text-xs text-[#7C3AED] hover:text-[#A78BFA]"
                >
                  +
                </button>
              </div>
            )}
          </div>

          {/* AI hashtag suggestions */}
          {!isPublished && text && (
            <HashtagSuggestions
              platform={platform}
              postText={text}
              existingHashtags={hashtags}
              maxHashtags={rules.hashtagCount.max}
            />
          )}
        </div>
      )}

      {/* Publish section — shown after approval */}
      {isApproved && !isPublished && (
        <div
          className="pt-2 border-t border-[#2A2A2A] space-y-2"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center gap-2">
            <input
              type="datetime-local"
              value={scheduledAt}
              onChange={(e) => setScheduledAt(e.target.value)}
              className="flex-1 text-xs bg-[#111111] border border-[#2A2A2A] rounded-lg px-2 py-1.5 text-[#888888] outline-none focus:border-[#7C3AED]"
              min={new Date(Date.now() + 15 * 60 * 1000).toISOString().slice(0, 16)}
            />
            <button
              onClick={handlePublish}
              disabled={isPublishing}
              className="px-3 py-1.5 text-xs bg-[#7C3AED] hover:bg-[#6D28D9] text-white rounded-lg transition-colors disabled:opacity-60"
            >
              {isPublishing ? "Publishing..." : scheduledAt ? "Schedule" : "Publish now"}
            </button>
          </div>
        </div>
      )}
    </div>
    </>
  )
}
