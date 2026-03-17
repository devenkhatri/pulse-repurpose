"use client"

import { useState, useMemo } from "react"
import { PostRow } from "@/components/dashboard/PostRow"
import { PostSlideOver } from "@/components/dashboard/PostSlideOver"
import { LoadingSpinner } from "@/components/shared/LoadingSpinner"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import { isWithinInterval, parseISO, startOfDay, endOfDay } from "date-fns"
import type { LinkedInPost, Platform, PostStatus } from "@/types"

const PLATFORM_FILTERS = [
  { value: "all", label: "All Platforms" },
  { value: "twitter", label: "Twitter" },
  { value: "threads", label: "Threads" },
  { value: "instagram", label: "Instagram" },
  { value: "facebook", label: "Facebook" },
  { value: "skool", label: "Skool" },
] as const

const STATUS_FILTERS = [
  { value: "all", label: "All Statuses" },
  { value: "pending", label: "Pending" },
  { value: "approved", label: "Approved" },
  { value: "scheduled", label: "Scheduled" },
  { value: "published", label: "Published" },
  { value: "failed", label: "Failed" },
] as const

const TABLE_PLATFORMS: Platform[] = ["twitter", "threads", "instagram", "facebook", "skool"]

interface PostsTableProps {
  posts: LinkedInPost[]
  loading: boolean
  error: string | null
  onApprove: (postId: string, platform: Platform) => Promise<void>
  onReject: (postId: string, platform: Platform) => Promise<void>
}

export function PostsTable({ posts, loading, error, onApprove, onReject }: PostsTableProps) {
  const [platformFilter, setPlatformFilter] = useState<string>("all")
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [dateFrom, setDateFrom] = useState("")
  const [dateTo, setDateTo] = useState("")
  const [selectedPost, setSelectedPost] = useState<LinkedInPost | null>(null)

  const filteredPosts = useMemo(() => {
    return posts.filter((post) => {
      // Platform filter: show post if any platform variant matches
      if (platformFilter !== "all") {
        const variant = post.platforms[platformFilter as Platform]
        if (!variant) return false
        if (statusFilter !== "all" && variant.status !== statusFilter) return false
      } else if (statusFilter !== "all") {
        // When no platform filter, show post if any platform has this status
        const hasStatus = TABLE_PLATFORMS.some(
          (p) => post.platforms[p].status === statusFilter
        )
        if (!hasStatus) return false
      }

      // Date range filter
      if (dateFrom || dateTo) {
        try {
          const postDate = parseISO(post.postedAt)
          if (dateFrom && dateTo) {
            if (!isWithinInterval(postDate, {
              start: startOfDay(parseISO(dateFrom)),
              end: endOfDay(parseISO(dateTo)),
            })) return false
          } else if (dateFrom) {
            if (postDate < startOfDay(parseISO(dateFrom))) return false
          } else if (dateTo) {
            if (postDate > endOfDay(parseISO(dateTo))) return false
          }
        } catch {
          // Invalid date strings — ignore filter
        }
      }

      return true
    })
  }, [posts, platformFilter, statusFilter, dateFrom, dateTo])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-48">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-48">
        <p className="text-sm text-red-400">{error}</p>
      </div>
    )
  }

  return (
    <>
      {/* Filters row */}
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        {/* Platform pills */}
        <div className="flex items-center gap-1.5 flex-wrap">
          {PLATFORM_FILTERS.map(({ value, label }) => (
            <button
              key={value}
              onClick={() => setPlatformFilter(value)}
              className={cn(
                "px-3 py-1 rounded-full text-xs font-medium transition-colors",
                platformFilter === value
                  ? "bg-[#7C3AED] text-white"
                  : "bg-white/5 text-zinc-400 hover:text-white hover:bg-white/10"
              )}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2 ml-auto">
          {/* Status filter */}
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-36 h-8 text-xs bg-[#161616] border-white/10">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-[#161616] border-white/10">
              {STATUS_FILTERS.map(({ value, label }) => (
                <SelectItem key={value} value={value} className="text-xs">
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Date range */}
          <Input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="w-36 h-8 text-xs bg-[#161616] border-white/10"
            placeholder="From"
          />
          <span className="text-zinc-600 text-xs">—</span>
          <Input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="w-36 h-8 text-xs bg-[#161616] border-white/10"
            placeholder="To"
          />

          {(platformFilter !== "all" || statusFilter !== "all" || dateFrom || dateTo) && (
            <Button
              size="sm"
              variant="ghost"
              className="h-8 text-xs text-zinc-500 hover:text-white"
              onClick={() => {
                setPlatformFilter("all")
                setStatusFilter("all")
                setDateFrom("")
                setDateTo("")
              }}
            >
              Clear
            </Button>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="rounded-lg border border-white/10 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-white/10 bg-white/[0.02]">
                <th className="px-4 py-3 text-xs font-medium text-zinc-500 whitespace-nowrap">Date</th>
                <th className="px-4 py-3 text-xs font-medium text-zinc-500">LinkedIn Post</th>
                {TABLE_PLATFORMS.map((p) => (
                  <th key={p} className="px-4 py-3 text-xs font-medium text-zinc-500 capitalize whitespace-nowrap">
                    {p}
                  </th>
                ))}
                <th className="px-4 py-3 text-xs font-medium text-zinc-500">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredPosts.length === 0 ? (
                <tr>
                  <td
                    colSpan={TABLE_PLATFORMS.length + 3}
                    className="px-4 py-12 text-center text-sm text-zinc-600"
                  >
                    {posts.length === 0 ? "No posts found. Connect your Google Sheet to get started." : "No posts match the current filters."}
                  </td>
                </tr>
              ) : (
                filteredPosts.map((post) => (
                  <PostRow
                    key={post.id}
                    post={post}
                    onClick={() => setSelectedPost(post)}
                  />
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Slide-over */}
      <PostSlideOver
        post={selectedPost}
        onClose={() => setSelectedPost(null)}
        onApprove={onApprove}
        onReject={onReject}
      />
    </>
  )
}
