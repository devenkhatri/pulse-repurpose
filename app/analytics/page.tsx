"use client"

import { useEffect, useState, useCallback } from "react"
import { TopBar } from "@/components/layout/TopBar"
import { LoadingSpinner } from "@/components/shared/LoadingSpinner"
import { usePostsStore } from "@/stores/postsStore"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import { format, parseISO } from "date-fns"
import { BarChart2, TrendingUp, Eye, Heart, MessageCircle, Share2, RefreshCw, Clock } from "lucide-react"
import {
  getPlatformSummary,
  getTopPerformingPosts,
  getBestPostingTimes,
  getTopPlatform,
  getOverallAvgEngagementRate,
  ANALYTICS_PLATFORMS,
} from "@/lib/analytics"
import type { PlatformSummary, TopPost, BestTimeSlot } from "@/lib/analytics"

// ---------------------------------------------------------------------------
// Platform colours
// ---------------------------------------------------------------------------

const PLATFORM_COLOR: Record<string, string> = {
  twitter: "#1DA1F2",
  threads: "#000000",
  instagram: "#E1306C",
  facebook: "#1877F2",
}

const PLATFORM_LABEL: Record<string, string> = {
  twitter: "Twitter / X",
  threads: "Threads",
  instagram: "Instagram",
  facebook: "Facebook",
}

// ---------------------------------------------------------------------------
// Stats bar
// ---------------------------------------------------------------------------

function StatCard({
  icon: Icon,
  label,
  value,
  sub,
}: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  value: string
  sub?: string
}) {
  return (
    <div className="bg-[#161616] border border-white/10 rounded-lg px-4 py-3 flex items-center gap-3">
      <div className="w-8 h-8 rounded-md bg-[#7C3AED]/15 flex items-center justify-center flex-shrink-0">
        <Icon className="w-4 h-4 text-[#7C3AED]" />
      </div>
      <div>
        <p className="text-xl font-semibold text-white leading-none">{value}</p>
        <p className="text-xs text-zinc-500 mt-0.5">{label}</p>
        {sub && <p className="text-xs text-zinc-600 mt-0.5">{sub}</p>}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Platform summary table
// ---------------------------------------------------------------------------

function PlatformTable({ summaries }: { summaries: PlatformSummary[] }) {
  const hasSome = summaries.some((s) => s.postsWithData > 0)
  if (!hasSome) return null

  return (
    <section className="mb-6">
      <h2 className="text-sm font-medium text-zinc-400 mb-3">Per-Platform Breakdown</h2>
      <div className="bg-[#161616] border border-white/10 rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/10 text-zinc-500 text-xs">
              <th className="text-left px-4 py-2.5 font-medium">Platform</th>
              <th className="text-right px-4 py-2.5 font-medium">Posts</th>
              <th className="text-right px-4 py-2.5 font-medium">Impressions</th>
              <th className="text-right px-4 py-2.5 font-medium">Likes</th>
              <th className="text-right px-4 py-2.5 font-medium">Comments</th>
              <th className="text-right px-4 py-2.5 font-medium">Shares</th>
              <th className="text-right px-4 py-2.5 font-medium">Avg Engagement</th>
            </tr>
          </thead>
          <tbody>
            {summaries.map((s, i) => (
              <tr
                key={s.platform}
                className={cn(
                  "border-b border-white/5 last:border-0",
                  s.postsWithData === 0 && "opacity-40"
                )}
              >
                <td className="px-4 py-2.5">
                  <div className="flex items-center gap-2">
                    <span
                      className="w-2 h-2 rounded-full flex-shrink-0"
                      style={{ backgroundColor: PLATFORM_COLOR[s.platform] ?? "#888" }}
                    />
                    <span className="text-white">{PLATFORM_LABEL[s.platform] ?? s.platform}</span>
                  </div>
                </td>
                <td className="px-4 py-2.5 text-right text-zinc-300">{s.postsWithData}</td>
                <td className="px-4 py-2.5 text-right text-zinc-300">
                  {s.totalImpressions.toLocaleString()}
                </td>
                <td className="px-4 py-2.5 text-right text-zinc-300">
                  {s.totalLikes.toLocaleString()}
                </td>
                <td className="px-4 py-2.5 text-right text-zinc-300">
                  {s.totalComments.toLocaleString()}
                </td>
                <td className="px-4 py-2.5 text-right text-zinc-300">
                  {s.totalShares.toLocaleString()}
                </td>
                <td className="px-4 py-2.5 text-right">
                  <span
                    className={cn(
                      "font-medium",
                      s.postsWithData === 0
                        ? "text-zinc-600"
                        : s.avgEngagementRate >= 5
                        ? "text-emerald-400"
                        : s.avgEngagementRate >= 2
                        ? "text-yellow-400"
                        : "text-red-400"
                    )}
                  >
                    {s.postsWithData > 0 ? `${s.avgEngagementRate.toFixed(1)}%` : "—"}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}

// ---------------------------------------------------------------------------
// Top posts table
// ---------------------------------------------------------------------------

function TopPostsTable({ posts }: { posts: TopPost[] }) {
  if (posts.length === 0) return null

  return (
    <section className="mb-6">
      <h2 className="text-sm font-medium text-zinc-400 mb-3">Top Performing Posts</h2>
      <div className="bg-[#161616] border border-white/10 rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/10 text-zinc-500 text-xs">
              <th className="text-left px-4 py-2.5 font-medium">Post</th>
              <th className="text-left px-4 py-2.5 font-medium">Platform</th>
              <th className="text-right px-4 py-2.5 font-medium">
                <span className="flex items-center justify-end gap-1">
                  <Eye className="w-3 h-3" /> Impressions
                </span>
              </th>
              <th className="text-right px-4 py-2.5 font-medium">
                <span className="flex items-center justify-end gap-1">
                  <Heart className="w-3 h-3" /> Likes
                </span>
              </th>
              <th className="text-right px-4 py-2.5 font-medium">
                <span className="flex items-center justify-end gap-1">
                  <MessageCircle className="w-3 h-3" /> Comments
                </span>
              </th>
              <th className="text-right px-4 py-2.5 font-medium">
                <span className="flex items-center justify-end gap-1">
                  <Share2 className="w-3 h-3" /> Shares
                </span>
              </th>
              <th className="text-right px-4 py-2.5 font-medium">
                <span className="flex items-center justify-end gap-1">
                  <TrendingUp className="w-3 h-3" /> Eng. Rate
                </span>
              </th>
              <th className="text-right px-4 py-2.5 font-medium">Published</th>
            </tr>
          </thead>
          <tbody>
            {posts.map((row, i) => (
              <tr key={`${row.post.id}-${row.platform}`} className="border-b border-white/5 last:border-0">
                <td className="px-4 py-2.5 max-w-[240px]">
                  <p className="text-zinc-300 truncate" title={row.post.linkedinText}>
                    {row.preview}
                    {row.post.linkedinText.length > 100 ? "…" : ""}
                  </p>
                </td>
                <td className="px-4 py-2.5">
                  <div className="flex items-center gap-1.5">
                    <span
                      className="w-2 h-2 rounded-full flex-shrink-0"
                      style={{ backgroundColor: PLATFORM_COLOR[row.platform] ?? "#888" }}
                    />
                    <span className="text-zinc-400 text-xs capitalize">{row.platform}</span>
                  </div>
                </td>
                <td className="px-4 py-2.5 text-right text-zinc-300">
                  {row.impressions.toLocaleString()}
                </td>
                <td className="px-4 py-2.5 text-right text-zinc-300">
                  {row.likes.toLocaleString()}
                </td>
                <td className="px-4 py-2.5 text-right text-zinc-300">
                  {row.comments.toLocaleString()}
                </td>
                <td className="px-4 py-2.5 text-right text-zinc-300">
                  {row.shares.toLocaleString()}
                </td>
                <td className="px-4 py-2.5 text-right">
                  <span
                    className={cn(
                      "font-medium",
                      row.engagementRate >= 5
                        ? "text-emerald-400"
                        : row.engagementRate >= 2
                        ? "text-yellow-400"
                        : "text-red-400"
                    )}
                  >
                    {row.engagementRate.toFixed(1)}%
                  </span>
                </td>
                <td className="px-4 py-2.5 text-right text-zinc-500 text-xs whitespace-nowrap">
                  {format(parseISO(row.publishedAt), "MMM d")}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}

// ---------------------------------------------------------------------------
// Best times
// ---------------------------------------------------------------------------

function BestTimesSection({ slots }: { slots: BestTimeSlot[] }) {
  if (slots.length === 0) return null

  const byPlatform = ANALYTICS_PLATFORMS.map((p) => ({
    platform: p,
    slots: slots.filter((s) => s.platform === p),
  })).filter((g) => g.slots.length > 0)

  if (byPlatform.length === 0) return null

  function formatHour(hour: number): string {
    const suffix = hour < 12 ? "AM" : "PM"
    const h = hour % 12 === 0 ? 12 : hour % 12
    return `${h}:00 ${suffix} UTC`
  }

  return (
    <section className="mb-6">
      <h2 className="text-sm font-medium text-zinc-400 mb-3 flex items-center gap-2">
        <Clock className="w-3.5 h-3.5" />
        Best Times to Post
        <span className="text-xs text-zinc-600 font-normal">(≥2 samples, UTC)</span>
      </h2>
      <div className="grid grid-cols-2 gap-4">
        {byPlatform.map(({ platform, slots }) => (
          <div key={platform} className="bg-[#161616] border border-white/10 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-3">
              <span
                className="w-2 h-2 rounded-full"
                style={{ backgroundColor: PLATFORM_COLOR[platform] ?? "#888" }}
              />
              <span className="text-sm font-medium text-white">
                {PLATFORM_LABEL[platform] ?? platform}
              </span>
            </div>
            <div className="space-y-1.5">
              {slots.map((s, i) => (
                <div key={s.hour} className="flex items-center justify-between text-sm">
                  <span className="text-zinc-400">
                    {i + 1}. {formatHour(s.hour)}
                  </span>
                  <span className="text-zinc-500 text-xs">
                    {s.avgEngagementRate.toFixed(1)}% avg · {s.sampleSize} posts
                  </span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}

// ---------------------------------------------------------------------------
// Empty state
// ---------------------------------------------------------------------------

function EmptyState({ onTrigger, triggering }: { onTrigger: () => void; triggering: boolean }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="w-12 h-12 rounded-full bg-[#7C3AED]/15 flex items-center justify-center mb-4">
        <BarChart2 className="w-6 h-6 text-[#7C3AED]" />
      </div>
      <h3 className="text-white font-medium mb-1">No analytics data yet</h3>
      <p className="text-zinc-500 text-sm max-w-xs mb-6">
        Fetch engagement metrics from your published posts to see performance data here.
      </p>
      <button
        onClick={onTrigger}
        disabled={triggering}
        className={cn(
          "flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors",
          "bg-[#7C3AED] text-white hover:bg-[#6D28D9] disabled:opacity-50 disabled:cursor-not-allowed"
        )}
      >
        <RefreshCw className={cn("w-4 h-4", triggering && "animate-spin")} />
        {triggering ? "Fetching…" : "Fetch Analytics Now"}
      </button>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function AnalyticsPage() {
  const { posts, loading, fetchPosts } = usePostsStore()
  const [triggering, setTriggering] = useState(false)

  useEffect(() => {
    fetchPosts()
  }, [fetchPosts])

  const handleTrigger = useCallback(async () => {
    setTriggering(true)
    try {
      const res = await fetch("/api/trigger/analytics", { method: "POST" })
      const json = await res.json()
      if (!res.ok || !json.success) {
        throw new Error(json.error ?? "Failed to trigger analytics fetch")
      }
      toast.success("Analytics fetch queued — data will appear when n8n completes")
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown error"
      toast.error(msg)
    } finally {
      setTriggering(false)
    }
  }, [])

  const summaries = getPlatformSummary(posts)
  const topPosts = getTopPerformingPosts(posts)
  const bestTimes = getBestPostingTimes(posts)
  const topPlatform = getTopPlatform(summaries)
  const avgEngagement = getOverallAvgEngagementRate(summaries)
  const hasData = summaries.some((s) => s.postsWithData > 0)

  const totalPublished = posts.reduce((n, p) =>
    n + ANALYTICS_PLATFORMS.filter((pl) => p.platforms[pl]?.status === "published").length, 0
  )
  const totalWithAnalytics = summaries.reduce((n, s) => n + s.postsWithData, 0)
  const totalImpressions = summaries.reduce((n, s) => n + s.totalImpressions, 0)

  return (
    <div className="flex flex-col h-full">
      <TopBar
        title="Analytics"
        actions={
          <button
            onClick={handleTrigger}
            disabled={triggering}
            className={cn(
              "flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-medium transition-colors",
              "bg-white/5 text-white hover:bg-white/10 border border-white/10",
              "disabled:opacity-50 disabled:cursor-not-allowed"
            )}
          >
            <RefreshCw className={cn("w-3.5 h-3.5", triggering && "animate-spin")} />
            {triggering ? "Fetching…" : "Refresh Analytics"}
          </button>
        }
      />

      <div className="flex-1 p-6 overflow-auto">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <LoadingSpinner />
          </div>
        ) : !hasData ? (
          <EmptyState onTrigger={handleTrigger} triggering={triggering} />
        ) : (
          <>
            {/* Overview stats */}
            <div className="grid grid-cols-4 gap-4 mb-6">
              <StatCard
                icon={BarChart2}
                label="Avg Engagement Rate"
                value={avgEngagement != null ? `${avgEngagement.toFixed(1)}%` : "—"}
              />
              <StatCard
                icon={Eye}
                label="Total Impressions"
                value={totalImpressions.toLocaleString()}
                sub={`${totalWithAnalytics} of ${totalPublished} posts tracked`}
              />
              <StatCard
                icon={TrendingUp}
                label="Top Platform"
                value={topPlatform ? PLATFORM_LABEL[topPlatform] ?? topPlatform : "—"}
              />
              <StatCard
                icon={BarChart2}
                label="Posts with Analytics"
                value={String(totalWithAnalytics)}
                sub={`of ${totalPublished} published`}
              />
            </div>

            <PlatformTable summaries={summaries} />
            <TopPostsTable posts={topPosts} />
            <BestTimesSection slots={bestTimes} />
          </>
        )}
      </div>
    </div>
  )
}
