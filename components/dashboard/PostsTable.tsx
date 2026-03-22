"use client"

import { useState, useMemo, useEffect, useRef } from "react"
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

function loadSortFromStorage(): SortState {
  if (typeof window === "undefined") return { column: "date", direction: "desc" }
  try {
    const saved = localStorage.getItem("pulse.dashboard.sort")
    if (saved) return JSON.parse(saved) as SortState
  } catch {}
  return { column: "date", direction: "desc" }
}

interface PostsTableProps {
  posts: LinkedInPost[]
  loading: boolean
  error: string | null
  onApprove: (postId: string, platform: Platform) => Promise<void>
  onReject: (postId: string, platform: Platform) => Promise<void>
  // Controlled filter state (lifted to DashboardPage for StatsBar integration)
  statusFilter: string
  onStatusFilterChange: (v: string) => void
  dateFrom: string
  onDateFromChange: (v: string) => void
  dateTo: string
  onDateToChange: (v: string) => void
}

export function PostsTable({
  posts,
  loading,
  error,
  onApprove,
  onReject,
  statusFilter,
  onStatusFilterChange,
  dateFrom,
  onDateFromChange,
  dateTo,
  onDateToChange,
}: PostsTableProps) {
  const [platformFilter, setPlatformFilter] = useState<string>("all")
  const [selectedPost, setSelectedPost] = useState<LinkedInPost | null>(null)
  const [searchQuery, setSearchQuery] = useState("")
  const [sort, setSort] = useState<SortState>(loadSortFromStorage)
  const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set())

  // Sync selectedRows when posts change (remove stale ids)
  useEffect(() => {
    setSelectedRows((prev) => {
      const validIds = new Set(posts.map((p) => p.id))
      const next = new Set(Array.from(prev).filter((id) => validIds.has(id)))
      return next.size === prev.size ? prev : next
    })
  }, [posts])

  function handleSort(column: SortColumn) {
    setSort((prev) => {
      const next =
        prev.column === column
          ? { column, direction: (prev.direction === "desc" ? "asc" : "desc") as SortDirection }
          : { column, direction: "desc" as SortDirection }
      try { localStorage.setItem("pulse.dashboard.sort", JSON.stringify(next)) } catch {}
      return next
    })
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
          (p) => post.platforms[p]?.status === statusFilter
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
        const pa = STATUS_PRIORITY[a.platforms[sort.column as Platform]?.status] ?? 99
        const pb = STATUS_PRIORITY[b.platforms[sort.column as Platform]?.status] ?? 99
        cmp = pa - pb
      }
      return sort.direction === "asc" ? cmp : -cmp
    })
  }, [posts, platformFilter, statusFilter, dateFrom, dateTo, searchQuery, sort])

  // Select-all state
  const allSelected =
    filteredPosts.length > 0 && filteredPosts.every((p) => selectedRows.has(p.id))
  const someSelected =
    filteredPosts.some((p) => selectedRows.has(p.id)) && !allSelected

  const selectAllRef = useRef<HTMLInputElement>(null)
  useEffect(() => {
    if (selectAllRef.current) {
      selectAllRef.current.indeterminate = someSelected
    }
  }, [someSelected])

  function toggleSelectAll() {
    if (allSelected) {
      setSelectedRows(new Set())
    } else {
      setSelectedRows(new Set(filteredPosts.map((p) => p.id)))
    }
  }

  function toggleSelectRow(id: string, checked: boolean) {
    setSelectedRows((prev) => {
      const next = new Set(prev)
      if (checked) next.add(id)
      else next.delete(id)
      return next
    })
  }

  const anyFilterActive =
    platformFilter !== "all" || statusFilter !== "all" || dateFrom || dateTo || searchQuery

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

        <div className="flex items-center gap-2 ml-auto flex-wrap">
          {/* Status filter */}
          <Select value={statusFilter} onValueChange={onStatusFilterChange}>
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
          <div className="flex items-center gap-1">
            <label htmlFor="date-from" className="text-xs text-zinc-500">From</label>
            <Input
              id="date-from"
              type="date"
              value={dateFrom}
              onChange={(e) => onDateFromChange(e.target.value)}
              className="w-36 h-8 text-xs bg-[#161616] border-white/10"
              aria-label="Date from"
            />
          </div>
          <span className="text-zinc-600 text-xs">—</span>
          <div className="flex items-center gap-1">
            <label htmlFor="date-to" className="text-xs text-zinc-500">To</label>
            <Input
              id="date-to"
              type="date"
              value={dateTo}
              onChange={(e) => onDateToChange(e.target.value)}
              className="w-36 h-8 text-xs bg-[#161616] border-white/10"
              aria-label="Date to"
            />
          </div>

          {anyFilterActive && (
            <Button
              size="sm"
              variant="ghost"
              className="h-8 text-xs text-zinc-500 hover:text-white"
              onClick={() => {
                setPlatformFilter("all")
                onStatusFilterChange("all")
                onDateFromChange("")
                onDateToChange("")
                setSearchQuery("")
              }}
            >
              Clear
            </Button>
          )}
        </div>
      </div>

      {/* Results count */}
      {anyFilterActive && (
        <p className="text-xs text-zinc-500 mb-3">
          Showing {filteredPosts.length} of {posts.length} post{posts.length !== 1 ? "s" : ""}
        </p>
      )}

      {/* Table */}
      <div className="rounded-lg border border-white/10 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-white/10 bg-white/[0.02]">
                <th scope="col" className="px-4 py-3 w-8">
                  <input
                    ref={selectAllRef}
                    type="checkbox"
                    checked={allSelected}
                    onChange={toggleSelectAll}
                    className="w-4 h-4 accent-[#7C3AED]"
                    aria-label="Select all posts"
                  />
                </th>
                <th
                  scope="col"
                  className="px-4 py-3 text-xs font-medium text-zinc-500 whitespace-nowrap cursor-pointer select-none hover:text-zinc-300 transition-colors"
                  onClick={() => handleSort("date")}
                >
                  Date{" "}
                  <span className="ml-0.5 text-zinc-500">
                    {sort.column === "date" ? (sort.direction === "desc" ? "↓" : "↑") : "↕"}
                  </span>
                </th>
                <th
                  scope="col"
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
                    scope="col"
                    className="px-4 py-3 text-xs font-medium text-zinc-500 capitalize whitespace-nowrap cursor-pointer select-none hover:text-zinc-300 transition-colors"
                    onClick={() => handleSort(p)}
                  >
                    {p}{" "}
                    <span className="ml-0.5 text-zinc-500">
                      {sort.column === p ? (sort.direction === "desc" ? "↓" : "↑") : "↕"}
                    </span>
                  </th>
                ))}
                <th scope="col" className="px-4 py-3 text-xs font-medium text-zinc-500">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredPosts.length === 0 ? (
                <tr>
                  <td
                    colSpan={TABLE_PLATFORMS.length + 4}
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
                    isSelected={selectedRows.has(post.id)}
                    onSelectChange={toggleSelectRow}
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
