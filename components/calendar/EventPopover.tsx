"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { PlatformIcon } from "@/components/shared/PlatformIcon"
import { StatusBadge } from "@/components/dashboard/StatusBadge"
import type { CalendarEvent, LinkedInPost, Platform } from "@/types"
import { PLATFORM_RULES } from "@/lib/platform-rules"
import { formatDate } from "@/lib/utils"
import { toast } from "sonner"
import { ExternalLink, Calendar } from "lucide-react"

interface EventPopoverProps {
  open: boolean
  event: CalendarEvent | null
  post: LinkedInPost | null
  onClose: () => void
  onReschedule: (postId: string, platform: Platform, scheduledAt: string) => Promise<void>
  onCancelScheduled: (postId: string, platform: Platform) => Promise<void>
}

export function EventPopover({
  open,
  event,
  post,
  onClose,
  onReschedule,
  onCancelScheduled,
}: EventPopoverProps) {
  const router = useRouter()
  const [rescheduleValue, setRescheduleValue] = useState("")
  const [rescheduling, setRescheduling] = useState(false)
  const [cancelling, setCancelling] = useState(false)

  if (!event || !post) return null

  const variant = post.platforms[event.platform]
  const rule = PLATFORM_RULES[event.platform]
  const imageUrl = variant?.imageUrl ?? null
  const text = variant?.text ?? ""
  const scheduledAt = variant?.scheduledAt ?? null

  async function handleReschedule() {
    if (!rescheduleValue || !event || !post) return
    setRescheduling(true)
    try {
      await onReschedule(post.id, event.platform, new Date(rescheduleValue).toISOString())
      toast.success("Post rescheduled")
      setRescheduleValue("")
    } catch {
      toast.error("Failed to reschedule")
    } finally {
      setRescheduling(false)
    }
  }

  async function handleCancel() {
    if (!event || !post) return
    setCancelling(true)
    try {
      await onCancelScheduled(post.id, event.platform)
      toast.success("Schedule cancelled — post set back to approved")
      onClose()
    } catch {
      toast.error("Failed to cancel schedule")
    } finally {
      setCancelling(false)
    }
  }

  function handleEdit() {
    router.push(`/repurpose?postId=${post!.id}`)
    onClose()
  }

  // Min datetime: 15 minutes from now
  const minDateTime = new Date(Date.now() + 15 * 60 * 1000)
    .toISOString()
    .slice(0, 16)

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose() }}>
      <DialogContent className="bg-[var(--bg-card)] border-white/10 text-white max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-white">
            <PlatformIcon platform={event.platform} size="md" />
            <span>{rule.label}</span>
          </DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          {/* Date + status */}
          <div className="flex items-center justify-between text-sm">
            <span className="text-white/60 flex items-center gap-1.5">
              <Calendar size={14} />
              {scheduledAt ? formatDate(new Date(scheduledAt)) : "Not scheduled"}
            </span>
            <StatusBadge status={event.status} />
          </div>

          {/* Image thumbnail */}
          {imageUrl && (
            <div className="rounded-lg overflow-hidden border border-white/10 aspect-video relative">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={imageUrl}
                alt="Post image"
                className="w-full h-full object-cover"
              />
            </div>
          )}

          {/* Post text */}
          <div className="bg-[var(--bg-secondary)] rounded-lg p-3 text-sm text-white/80 whitespace-pre-wrap max-h-40 overflow-y-auto leading-relaxed">
            {text || <span className="text-white/30 italic">No text generated yet</span>}
          </div>

          {/* Reschedule picker */}
          <div className="flex flex-col gap-2">
            <label className="text-xs font-medium text-white/60 uppercase tracking-wider">
              Reschedule
            </label>
            <div className="flex gap-2">
              <input
                type="datetime-local"
                value={rescheduleValue}
                min={minDateTime}
                onChange={(e) => setRescheduleValue(e.target.value)}
                className="flex-1 bg-[var(--bg-secondary)] border border-white/10 rounded-md px-3 py-2 text-sm text-white focus:outline-none focus:border-[var(--accent)] [color-scheme:dark]"
              />
              <Button
                size="sm"
                disabled={!rescheduleValue || rescheduling}
                onClick={handleReschedule}
                className="bg-[var(--accent)] hover:bg-[var(--accent)]/80 text-white"
              >
                {rescheduling ? "Saving…" : "Save"}
              </Button>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-2 pt-1">
            <Button
              variant="outline"
              size="sm"
              onClick={handleEdit}
              className="flex items-center gap-1.5 border-white/10 text-white/70 hover:text-white bg-transparent"
            >
              <ExternalLink size={14} />
              Edit in Repurpose
            </Button>

            {event.status === "scheduled" && (
              <Button
                variant="outline"
                size="sm"
                disabled={cancelling}
                onClick={handleCancel}
                className="ml-auto border-[var(--error)]/30 text-[var(--error)] hover:bg-[var(--error)]/10 bg-transparent"
              >
                {cancelling ? "Cancelling…" : "Cancel scheduled"}
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
