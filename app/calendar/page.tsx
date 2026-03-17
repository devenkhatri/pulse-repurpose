"use client"

import { useEffect, useState, useCallback } from "react"
import { TopBar } from "@/components/layout/TopBar"
import { CalendarView } from "@/components/calendar/CalendarView"
import { EventPopover } from "@/components/calendar/EventPopover"
import { GapWarningBanner } from "@/components/calendar/GapWarningBanner"
import { LoadingSpinner } from "@/components/shared/LoadingSpinner"
import { usePostsStore } from "@/stores/postsStore"
import { PLATFORM_RULES } from "@/lib/platform-rules"
import type {
  CalendarEvent,
  GapWarning,
  LinkedInPost,
  Platform,
} from "@/types"
import { toast } from "sonner"

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const TRACKED_PLATFORMS: Platform[] = [
  "twitter",
  "threads",
  "instagram",
  "facebook",
  "skool",
]

/** Convert all post platform variants to FullCalendar-compatible events */
function postsToCalendarEvents(posts: LinkedInPost[]): CalendarEvent[] {
  const events: CalendarEvent[] = []

  for (const post of posts) {
    for (const platform of TRACKED_PLATFORMS) {
      const variant = post.platforms[platform]
      if (!variant) continue
      if (!["scheduled", "published", "approved"].includes(variant.status)) continue
      const dateStr = variant.scheduledAt ?? variant.publishedAt
      if (!dateStr) continue

      events.push({
        id: `${post.id}-${platform}`,
        postId: post.id,
        platform,
        title: variant.text?.slice(0, 40) ?? "(no text)",
        start: new Date(dateStr),
        status: variant.status,
        color: PLATFORM_RULES[platform].color,
      })
    }
  }

  return events
}

/** Compute gap warnings per platform */
function computeGapWarnings(
  posts: LinkedInPost[],
  topicPillars: string[]
): GapWarning[] {
  const now = new Date()
  const threeDaysMs = 3 * 24 * 60 * 60 * 1000
  const tenDaysMs = 10 * 24 * 60 * 60 * 1000
  const warnings: GapWarning[] = []

  for (const platform of TRACKED_PLATFORMS) {
    type VariantDateEntry = { date: Date; post: LinkedInPost }
    const entries: VariantDateEntry[] = []

    for (const post of posts) {
      const variant = post.platforms[platform]
      if (!variant) continue
      if (!["scheduled", "published"].includes(variant.status)) continue
      const dateStr = variant.publishedAt ?? variant.scheduledAt
      if (!dateStr) continue
      entries.push({ date: new Date(dateStr), post })
    }

    if (entries.length === 0) {
      warnings.push({
        platform,
        lastPostDate: "Never",
        daysGap: 999,
        pillarGap: computePillarGap([], topicPillars),
      })
      continue
    }

    // Sort descending
    entries.sort((a, b) => b.date.getTime() - a.date.getTime())
    const lastDate = entries[0].date
    const daysSince = (now.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24)

    // Check for any upcoming post in next 3 days
    const hasUpcoming = entries.some((e) => {
      const diff = e.date.getTime() - now.getTime()
      return diff > 0 && diff <= threeDaysMs
    })

    if (daysSince > 3 && !hasUpcoming) {
      const recentEntries = entries.filter(
        (e) => now.getTime() - e.date.getTime() <= tenDaysMs
      )
      const pillarGap = computePillarGap(recentEntries.map((e) => e.post), topicPillars)

      warnings.push({
        platform,
        lastPostDate: lastDate.toISOString(),
        daysGap: Math.floor(daysSince),
        pillarGap,
      })
    }
  }

  return warnings
}

function computePillarGap(posts: LinkedInPost[], pillars: string[]): string | null {
  if (pillars.length === 0) return null
  const combinedText = posts.map((p) => p.linkedinText.toLowerCase()).join(" ")
  for (const pillar of pillars) {
    if (!combinedText.includes(pillar.toLowerCase())) {
      return `No ${pillar} content in 10 days`
    }
  }
  return null
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function CalendarPage() {
  const { posts, loading, error, fetchPosts } = usePostsStore()
  const [topicPillars, setTopicPillars] = useState<string[]>([])

  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null)
  const [selectedPost, setSelectedPost] = useState<LinkedInPost | null>(null)
  const [popoverOpen, setPopoverOpen] = useState(false)

  useEffect(() => {
    fetchPosts()
    // Load brand voice for topic pillar gap detection
    fetch("/api/brand-voice")
      .then((r) => r.json())
      .then((data) => {
        if (data.profile?.topicPillars) setTopicPillars(data.profile.topicPillars)
      })
      .catch(() => {
        // Non-critical — fall back to empty pillars
      })
  }, [fetchPosts])

  const calendarEvents = postsToCalendarEvents(posts)
  const gapWarnings = computeGapWarnings(posts, topicPillars)

  function handleEventClick(event: CalendarEvent) {
    const post = posts.find((p) => p.id === event.postId) ?? null
    setSelectedEvent(event)
    setSelectedPost(post)
    setPopoverOpen(true)
  }

  const handleReschedule = useCallback(
    async (postId: string, platform: Platform, scheduledAt: string) => {
      const res = await fetch(`/api/posts/${postId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          platform,
          variant: { scheduledAt, status: "scheduled" },
        }),
      })
      if (!res.ok) throw new Error("Failed to reschedule")
      // Refresh posts
      await fetchPosts()
    },
    [fetchPosts]
  )

  const handleCancelScheduled = useCallback(
    async (postId: string, platform: Platform) => {
      const res = await fetch(`/api/posts/${postId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          platform,
          variant: { status: "approved", scheduledAt: null },
        }),
      })
      if (!res.ok) throw new Error("Failed to cancel")
      await fetchPosts()
    },
    [fetchPosts]
  )

  return (
    <div className="flex flex-col h-full">
      <TopBar title="Calendar" />

      <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-6">
        {loading && (
          <div className="flex items-center justify-center py-20">
            <LoadingSpinner size="lg" />
          </div>
        )}

        {error && !loading && (
          <div className="rounded-xl border border-[var(--error)]/20 bg-[var(--error)]/5 p-4 text-sm text-[var(--error)]">
            Failed to load posts: {error}
          </div>
        )}

        {!loading && !error && (
          <>
            <CalendarView
              events={calendarEvents}
              onEventClick={handleEventClick}
            />

            {gapWarnings.length > 0 && (
              <GapWarningBanner warnings={gapWarnings} />
            )}
          </>
        )}
      </div>

      <EventPopover
        open={popoverOpen}
        event={selectedEvent}
        post={selectedPost}
        onClose={() => {
          setPopoverOpen(false)
          setSelectedEvent(null)
          setSelectedPost(null)
        }}
        onReschedule={handleReschedule}
        onCancelScheduled={handleCancelScheduled}
      />
    </div>
  )
}
