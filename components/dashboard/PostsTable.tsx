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

type SortColumn = "date" | "linkedinText" | Platform
type SortDirection = "asc" | "desc"
interface SortState { column: SortColumn; direction: SortDirection }

const STATUS_PRIORITY: Record<PostStatus, number> = {
  published: 0,
  approved: 1,
  scheduled: 2,
  pending: 3,
  failed: 4,
}

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
  const [searchQuery, setSearchQuery] = useState("")
  const [sort, setSort] = useState<SortState>({ column: "date", direction: "desc" })

  function handleSort(column: SortColumn) {
    setSort((prev) =>
      prev.column === column
        ? { column, direction: prev.direction === "desc" ? "asc" : "desc" }
        : { column, direction: "desc" }
    )
  }

  const filteredPosts = useMemo(() => {
    const afterFilter = posts.filter((post) => {
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

    const afterSearch = searchQuery.trim()
      ? afterFilter.filter((post) => {
          const q = searchQuery.toLowerCase()
          if (post.linkedinText?.toLowerCase().includes(q)) return true
          return TABLE_PLATFORMS.some((p) => post.platforms[p]?.text?.toLowerCase().includes(q))
        })
      : afterFilter

    return [...afterSearch].sort((a, b) => {
      let cmp = 0
      if (sort.column === "date") {
        cmp = a.postedAt.localeCompare(b.postedAt)
      } else if (sort.column === "linkedinText") {
        cmp = (a.linkedinText ?? "").localeCompare(b.linkedinText ?? "")
      } else {
        const pa = STATUS_PRIORITY[a.platforms[sort.column as Platform].status]
        const pb = STATUS_PRIORITY[b.platforms[sort.column as Platform].status]
        cmp = pa - pb
      }
      return sort.direction === "asc" ? cmp : -cmp
    })
  }, [posts, platformFilter, statusFilter, dateFrom, dateTo, searchQuery, sort])

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
      {/* Search bar */}
      <div className="mb-3">
        <Input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search posts…"
          className="h-8 text-xs bg-[#161616] border-white/10 max-w-sm"
        />
      </div>

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

          {(platformFilter !== "all" || statusFilter !== "all" || dateFrom || dateTo || searchQuery) && (
            <Button
              size="sm"
              variant="ghost"
              className="h-8 text-xs text-zinc-500 hover:text-white"
              onClick={() => {
                setPlatformFilter("all")
                setStatusFilter("all")
                setDateFrom("")
                setDateTo("")
                setSearchQuery("")
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
                <th
                  className="px-4 py-3 text-xs font-medium text-zinc-500 whitespace-nowrap cursor-pointer select-none hover:text-zinc-300 transition-colors"
                  onClick={() => handleSort("date")}
                >
                  Date{" "}
                  <span className="ml-0.5 text-zinc-500">
                    {sort.column === "date" ? (sort.direction === "desc" ? "↓" : "↑") : "↕"}
                  </span>
                </th>
                <th
                  className="px-4 py-3 text-xs font-medium text-zinc-500 cursor-pointer select-none hover:text-zinc-300 transition-colors"
                  onClick={() => handleSort("linkedinText")}
                >
                  LinkedIn Post{" "}
                  <span className="ml-0.5 text-zinc-500">
                    {sort.column === "linkedinText" ? (sort.direction === "desc" ? "↓" : "↑") : "↕"}
                  </span>
                </th>
                {TABLE_PLATFORMS.map((p) => (
                  <th
                    key={p}
                    className="px-4 py-3 text-xs font-medium text-zinc-500 capitalize whitespace-nowrap cursor-pointer select-none hover:text-zinc-300 transition-colors"
                    onClick={() => handleSort(p)}
                  >
                    {p}{" "}
                    <span className="ml-0.5 text-zinc-500">
                      {sort.column === p ? (sort.direction === "desc" ? "↓" : "↑") : "↕"}
                    </span>
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
                    {posts.length === 0
                      ? "No posts found. Connect your Google Sheet to get started."
                      : searchQuery
                        ? `No posts match "${searchQuery}".`
                        : "No posts match the current filters."}
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
