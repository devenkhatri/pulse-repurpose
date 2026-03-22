"use client"

import { useEffect, useCallback, useState } from "react"
import { TopBar } from "@/components/layout/TopBar"
import { PostsTable } from "@/components/dashboard/PostsTable"
import { SystemPanel } from "@/components/dashboard/SystemPanel"
import { LoadingSpinner } from "@/components/shared/LoadingSpinner"
import { usePostsStore } from "@/stores/postsStore"
import { format, isThisWeek, parseISO, startOfWeek } from "date-fns"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import type { Platform } from "@/types"
import { getPlatformSummary, getTopPlatform, getOverallAvgEngagementRate } from "@/lib/analytics"

// ---------------------------------------------------------------------------
// Stats bar
// ---------------------------------------------------------------------------

interface StatsBarProps {
  onStatusFilterChange: (status: string) => void
  onDateFromChange: (v: string) => void
  onDateToChange: (v: string) => void
}

function StatsBar({ onStatusFilterChange, onDateFromChange, onDateToChange }: StatsBarProps) {
  const posts = usePostsStore((s) => s.posts)

  const total = posts.length

  const repurposed = posts.filter((post) =>
    (["twitter", "threads", "instagram", "facebook", "skool"] as Platform[]).some(
      (p) => post.platforms[p]?.status !== "pending"
    )
  ).length

  const publishedThisWeek = posts.reduce((count, post) => {
    const platformCount = (["twitter", "threads", "instagram", "facebook", "skool"] as Platform[]).filter(
      (p) => {
        const v = post.platforms[p]
        return v?.status === "published" && v.publishedAt && isThisWeek(parseISO(v.publishedAt))
      }
    ).length
    return count + platformCount
  }, 0)

  const pendingApproval = posts.reduce((count, post) => {
    const platformCount = (["twitter", "threads", "instagram", "facebook", "skool"] as Platform[]).filter(
      (p) => {
        const v = post.platforms[p]
        return v?.status === "pending" && !!v.text
      }
    ).length
    return count + platformCount
  }, 0)

  function handlePublishedThisWeekClick() {
    const today = format(new Date(), "yyyy-MM-dd")
    const weekStart = format(startOfWeek(new Date(), { weekStartsOn: 1 }), "yyyy-MM-dd")
    onStatusFilterChange("published")
    onDateFromChange(weekStart)
    onDateToChange(today)
  }

  function handlePendingClick() {
    onStatusFilterChange("pending")
    onDateFromChange("")
    onDateToChange("")
  }

  function handleTotalClick() {
    onStatusFilterChange("all")
    onDateFromChange("")
    onDateToChange("")
  }

  const summaries = getPlatformSummary(posts)
  const avgEngagementRate = getOverallAvgEngagementRate(summaries)
  const topPlatform = getTopPlatform(summaries)

  const stats = [
    {
      label: "Total Posts",
      value: String(total),
      onClick: handleTotalClick,
      title: "Show all posts",
    },
    {
      label: "Repurposed",
      value: String(repurposed),
      onClick: handleTotalClick,
      title: "Show all posts",
    },
    {
      label: "Published This Week",
      value: String(publishedThisWeek),
      onClick: handlePublishedThisWeekClick,
      title: "Filter to published this week",
    },
    {
      label: "Pending Approval",
      value: String(pendingApproval),
      onClick: handlePendingClick,
      title: "Filter to pending approval",
    },
    {
      label: "Avg Engagement Rate",
      value: avgEngagementRate != null ? `${avgEngagementRate.toFixed(1)}%` : "—",
      onClick: undefined,
      title: "Average engagement rate across all platforms",
    },
    {
      label: "Top Platform",
      value: topPlatform
        ? topPlatform.charAt(0).toUpperCase() + topPlatform.slice(1)
        : "—",
      onClick: undefined,
      title: "Platform with highest average engagement rate",
    },
  ]

  return (
    <div className="grid grid-cols-6 gap-4 mb-6">
      {stats.map(({ label, value, onClick, title }) => (
        <button
          key={label}
          onClick={onClick}
          title={title}
          disabled={!onClick}
          className={cn(
            "bg-[#161616] border border-white/10 rounded-lg px-4 py-3 text-left",
            onClick
              ? "hover:border-[#7C3AED]/40 transition-colors cursor-pointer"
              : "cursor-default"
          )}
        >
          <p className="text-2xl font-semibold text-white">{value}</p>
          <p className="text-xs text-zinc-500 mt-0.5">{label}</p>
        </button>
      ))}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function DashboardPage() {
  const { posts, loading, error, fetchPosts, updateVariantStatus } = usePostsStore()

  // Lifted filter state for StatsBar ↔ PostsTable integration
  const [statusFilter, setStatusFilter] = useState("all")
  const [dateFrom, setDateFrom] = useState("")
  const [dateTo, setDateTo] = useState("")
  const [recycledPostIds, setRecycledPostIds] = useState<Set<string>>(new Set())

  useEffect(() => {
    fetchPosts()
  }, [fetchPosts])

  useEffect(() => {
    fetch("/api/evergreen")
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data.recycledPostIds)) {
          setRecycledPostIds(new Set(data.recycledPostIds as string[]))
        }
      })
      .catch(() => {}) // non-critical — silently ignore
  }, [])

  const handleApprove = useCallback(
    async (postId: string, platform: Platform) => {
      // Optimistic update
      updateVariantStatus(postId, platform, "approved")
      try {
        const approvedAt = new Date().toISOString()
        const res = await fetch(`/api/posts/${postId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            platform,
            variant: { status: "approved", approvedAt },
          }),
        })
        if (!res.ok) {
          const json = await res.json()
          throw new Error(json.error ?? "Failed to approve")
        }
        toast.success(`${platform} variant approved`)
      } catch (err) {
        // Re-fetch from Sheet to revert to actual state; fall back to optimistic revert
        fetchPosts().catch(() => updateVariantStatus(postId, platform, "pending"))
        throw err
      }
    },
    [updateVariantStatus, fetchPosts]
  )

  const handleReject = useCallback(
    async (postId: string, platform: Platform) => {
      // Optimistic update
      updateVariantStatus(postId, platform, "pending")
      try {
        const res = await fetch(`/api/posts/${postId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            platform,
            variant: { status: "pending" },
          }),
        })
        if (!res.ok) {
          const json = await res.json()
          throw new Error(json.error ?? "Failed to reject")
        }
        toast.success(`${platform} variant moved back to pending`)
      } catch (err) {
        // Re-fetch from Sheet to revert to actual state; fall back to optimistic revert
        fetchPosts().catch(() => updateVariantStatus(postId, platform, "approved"))
        throw err
      }
    },
    [updateVariantStatus, fetchPosts]
  )

  return (
    <div className="flex flex-col h-full">
      <TopBar title="Dashboard" />
      <div className="flex-1 p-6 overflow-auto">
        <SystemPanel />
        <StatsBar
          onStatusFilterChange={setStatusFilter}
          onDateFromChange={setDateFrom}
          onDateToChange={setDateTo}
        />
        <PostsTable
          posts={posts}
          loading={loading}
          error={error}
          onApprove={handleApprove}
          onReject={handleReject}
          statusFilter={statusFilter}
          onStatusFilterChange={setStatusFilter}
          dateFrom={dateFrom}
          onDateFromChange={setDateFrom}
          dateTo={dateTo}
          onDateToChange={setDateTo}
          recycledPostIds={recycledPostIds}
        />
      </div>
    </div>
  )
}
