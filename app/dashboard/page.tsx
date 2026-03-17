"use client"

import { useEffect, useCallback } from "react"
import { TopBar } from "@/components/layout/TopBar"
import { PostsTable } from "@/components/dashboard/PostsTable"
import { LoadingSpinner } from "@/components/shared/LoadingSpinner"
import { usePostsStore } from "@/stores/postsStore"
import { isThisWeek, parseISO } from "date-fns"
import { toast } from "sonner"
import type { Platform } from "@/types"

// ---------------------------------------------------------------------------
// Stats bar
// ---------------------------------------------------------------------------

function StatsBar() {
  const posts = usePostsStore((s) => s.posts)

  const total = posts.length

  const repurposed = posts.filter((post) =>
    (["twitter", "threads", "instagram", "facebook", "skool"] as Platform[]).some(
      (p) => post.platforms[p].status !== "pending"
    )
  ).length

  const publishedThisWeek = posts.reduce((count, post) => {
    const platformCount = (["twitter", "threads", "instagram", "facebook", "skool"] as Platform[]).filter(
      (p) => {
        const v = post.platforms[p]
        return v.status === "published" && v.publishedAt && isThisWeek(parseISO(v.publishedAt))
      }
    ).length
    return count + platformCount
  }, 0)

  const pendingApproval = posts.reduce((count, post) => {
    const platformCount = (["twitter", "threads", "instagram", "facebook", "skool"] as Platform[]).filter(
      (p) => post.platforms[p].status === "approved"
    ).length
    return count + platformCount
  }, 0)

  const stats = [
    { label: "Total Posts", value: total },
    { label: "Repurposed", value: repurposed },
    { label: "Published This Week", value: publishedThisWeek },
    { label: "Pending Approval", value: pendingApproval },
  ]

  return (
    <div className="grid grid-cols-4 gap-4 mb-6">
      {stats.map(({ label, value }) => (
        <div
          key={label}
          className="bg-[#161616] border border-white/10 rounded-lg px-4 py-3"
        >
          <p className="text-2xl font-semibold text-white">{value}</p>
          <p className="text-xs text-zinc-500 mt-0.5">{label}</p>
        </div>
      ))}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function DashboardPage() {
  const { posts, loading, error, fetchPosts, updateVariantStatus } = usePostsStore()

  useEffect(() => {
    fetchPosts()
  }, [fetchPosts])

  const handleApprove = useCallback(
    async (postId: string, platform: Platform) => {
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
      updateVariantStatus(postId, platform, "approved")
      toast.success(`${platform} variant approved`)
    },
    [updateVariantStatus]
  )

  const handleReject = useCallback(
    async (postId: string, platform: Platform) => {
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
      updateVariantStatus(postId, platform, "pending")
      toast.success(`${platform} variant moved back to pending`)
    },
    [updateVariantStatus]
  )

  return (
    <div className="flex flex-col h-full">
      <TopBar title="Dashboard" />
      <div className="flex-1 p-6 overflow-auto">
        <StatsBar />
        <PostsTable
          posts={posts}
          loading={loading}
          error={error}
          onApprove={handleApprove}
          onReject={handleReject}
        />
      </div>
    </div>
  )
}
