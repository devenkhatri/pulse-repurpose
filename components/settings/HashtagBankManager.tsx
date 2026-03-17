"use client"

import { useState } from "react"
import { toast } from "sonner"
import { Plus, Trash2, ArrowUpDown, Hash } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { PlatformIcon } from "@/components/shared/PlatformIcon"
import type { HashtagBankEntry, Platform } from "@/types"

const ALL_PLATFORMS: Platform[] = [
  "twitter",
  "threads",
  "instagram",
  "facebook",
  "skool",
]

interface HashtagBankManagerProps {
  entries: HashtagBankEntry[]
  topicPillars: string[]
  onEntriesChange: (entries: HashtagBankEntry[]) => void
}

export function HashtagBankManager({
  entries,
  topicPillars,
  onEntriesChange,
}: HashtagBankManagerProps) {
  const [newHashtag, setNewHashtag] = useState("")
  const [selectedPlatforms, setSelectedPlatforms] = useState<Platform[]>([])
  const [selectedPillar, setSelectedPillar] = useState<string>("")
  const [sortBy, setSortBy] = useState<"usageCount" | "hashtag">("usageCount")
  const [filterPlatform, setFilterPlatform] = useState<Platform | "all">("all")
  const [bulkInput, setBulkInput] = useState("")
  const [adding, setAdding] = useState(false)

  const togglePlatform = (platform: Platform) => {
    setSelectedPlatforms((prev) =>
      prev.includes(platform) ? prev.filter((p) => p !== platform) : [...prev, platform]
    )
  }

  const handleAdd = async () => {
    const hashtag = newHashtag.trim().replace(/^#/, "")
    if (!hashtag) {
      toast.error("Enter a hashtag")
      return
    }
    if (selectedPlatforms.length === 0) {
      toast.error("Select at least one platform")
      return
    }

    setAdding(true)
    try {
      const res = await fetch("/api/hashtag-bank", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          hashtag,
          platforms: selectedPlatforms,
          topicPillar: selectedPillar || null,
        }),
      })

      if (!res.ok) throw new Error("Add failed")

      const { entry } = (await res.json()) as { entry: HashtagBankEntry }
      onEntriesChange([...entries, entry])
      setNewHashtag("")
      setSelectedPlatforms([])
      setSelectedPillar("")
      toast.success(`#${hashtag} added to bank`)
    } catch {
      toast.error("Failed to add hashtag")
    } finally {
      setAdding(false)
    }
  }

  const handleDelete = async (id: string, hashtag: string) => {
    try {
      const res = await fetch("/api/hashtag-bank", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      })

      if (!res.ok) throw new Error("Delete failed")

      onEntriesChange(entries.filter((e) => e.id !== id))
      toast.success(`#${hashtag} removed`)
    } catch {
      toast.error("Failed to remove hashtag")
    }
  }

  const handleBulkImport = async () => {
    if (!bulkInput.trim()) return
    if (selectedPlatforms.length === 0) {
      toast.error("Select platforms for bulk import")
      return
    }

    const tags = bulkInput
      .split(",")
      .map((t) => t.trim().replace(/^#/, "").toLowerCase())
      .filter(Boolean)

    const newEntries: HashtagBankEntry[] = []
    for (const tag of tags) {
      try {
        const res = await fetch("/api/hashtag-bank", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            hashtag: tag,
            platforms: selectedPlatforms,
            topicPillar: selectedPillar || null,
          }),
        })
        if (res.ok) {
          const { entry } = (await res.json()) as { entry: HashtagBankEntry }
          newEntries.push(entry)
        }
      } catch {
        // skip individual failures
      }
    }

    onEntriesChange([...entries, ...newEntries])
    setBulkInput("")
    toast.success(`Imported ${newEntries.length} hashtags`)
  }

  // Sort and filter
  const displayEntries = [...entries]
    .filter(
      (e) => filterPlatform === "all" || e.platforms.includes(filterPlatform)
    )
    .sort((a, b) => {
      if (sortBy === "usageCount") return b.usageCount - a.usageCount
      return a.hashtag.localeCompare(b.hashtag)
    })

  return (
    <div className="space-y-6 max-w-3xl">
      {/* Add form */}
      <div className="rounded-xl border border-white/10 bg-[#161616] p-5 space-y-4">
        <h3 className="text-sm font-medium text-white">Add hashtag</h3>

        <div className="flex gap-2">
          <div className="relative flex-1">
            <Hash className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/30" />
            <Input
              value={newHashtag}
              onChange={(e) => setNewHashtag(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleAdd()}
              placeholder="hashtag (without #)"
              className="pl-7 bg-[#0A0A0A] border-white/10 text-white placeholder:text-white/20"
            />
          </div>
        </div>

        {/* Platform checkboxes */}
        <div className="space-y-1.5">
          <Label className="text-white/50 text-xs">Platforms</Label>
          <div className="flex flex-wrap gap-2">
            {ALL_PLATFORMS.map((platform) => (
              <button
                key={platform}
                type="button"
                onClick={() => togglePlatform(platform)}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md border text-xs transition-colors ${
                  selectedPlatforms.includes(platform)
                    ? "border-[#7C3AED]/60 bg-[#7C3AED]/15 text-white"
                    : "border-white/10 text-white/40 hover:border-white/20"
                }`}
              >
                <PlatformIcon platform={platform} size="sm" />
                {platform}
              </button>
            ))}
          </div>
        </div>

        {/* Topic pillar */}
        {topicPillars.length > 0 && (
          <div className="space-y-1.5">
            <Label className="text-white/50 text-xs">Topic pillar (optional)</Label>
            <div className="flex flex-wrap gap-1.5">
              {topicPillars.map((pillar) => (
                <button
                  key={pillar}
                  type="button"
                  onClick={() =>
                    setSelectedPillar(selectedPillar === pillar ? "" : pillar)
                  }
                  className={`px-2 py-0.5 rounded-full border text-xs transition-colors ${
                    selectedPillar === pillar
                      ? "border-[#7C3AED]/60 bg-[#7C3AED]/15 text-[#a78bfa]"
                      : "border-white/10 text-white/40 hover:border-white/20"
                  }`}
                >
                  {pillar}
                </button>
              ))}
            </div>
          </div>
        )}

        <Button
          onClick={handleAdd}
          disabled={adding}
          size="sm"
          className="bg-[#7C3AED] hover:bg-[#6D28D9] text-white"
        >
          <Plus className="w-3.5 h-3.5 mr-1.5" />
          {adding ? "Adding..." : "Add hashtag"}
        </Button>
      </div>

      {/* Bulk import */}
      <div className="rounded-xl border border-white/10 bg-[#161616] p-5 space-y-3">
        <h3 className="text-sm font-medium text-white">Bulk import</h3>
        <Input
          value={bulkInput}
          onChange={(e) => setBulkInput(e.target.value)}
          placeholder="productivity, leadership, buildinpublic, ..."
          className="bg-[#0A0A0A] border-white/10 text-white placeholder:text-white/20"
        />
        <p className="text-white/30 text-xs">
          Comma-separated. Selected platforms and pillar above will apply to all.
        </p>
        <Button
          onClick={handleBulkImport}
          variant="outline"
          size="sm"
          className="border-white/10 text-white/60 hover:text-white hover:bg-white/5"
        >
          Import
        </Button>
      </div>

      {/* Table */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-white/50 text-sm">
            {entries.length} hashtag{entries.length !== 1 ? "s" : ""}
          </p>
          <div className="flex items-center gap-2">
            {/* Filter by platform */}
            <div className="flex gap-1">
              <button
                onClick={() => setFilterPlatform("all")}
                className={`px-2 py-0.5 rounded text-xs ${filterPlatform === "all" ? "bg-white/10 text-white" : "text-white/30 hover:text-white/60"}`}
              >
                All
              </button>
              {ALL_PLATFORMS.map((p) => (
                <button
                  key={p}
                  onClick={() => setFilterPlatform(p)}
                  className={`px-2 py-0.5 rounded text-xs capitalize ${filterPlatform === p ? "bg-white/10 text-white" : "text-white/30 hover:text-white/60"}`}
                >
                  {p}
                </button>
              ))}
            </div>
            <button
              onClick={() =>
                setSortBy((prev) =>
                  prev === "usageCount" ? "hashtag" : "usageCount"
                )
              }
              className="flex items-center gap-1 text-white/40 hover:text-white/70 text-xs"
            >
              <ArrowUpDown className="w-3 h-3" />
              {sortBy === "usageCount" ? "Usage" : "A-Z"}
            </button>
          </div>
        </div>

        {displayEntries.length === 0 ? (
          <div className="rounded-lg border border-dashed border-white/10 p-8 text-center">
            <p className="text-white/30 text-sm">No hashtags yet</p>
          </div>
        ) : (
          <div className="rounded-xl border border-white/10 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/5">
                  <th className="text-left px-4 py-2.5 text-white/40 font-normal text-xs">
                    Hashtag
                  </th>
                  <th className="text-left px-4 py-2.5 text-white/40 font-normal text-xs">
                    Platforms
                  </th>
                  <th className="text-left px-4 py-2.5 text-white/40 font-normal text-xs">
                    Pillar
                  </th>
                  <th className="text-left px-4 py-2.5 text-white/40 font-normal text-xs">
                    Uses
                  </th>
                  <th className="text-left px-4 py-2.5 text-white/40 font-normal text-xs">
                    Last used
                  </th>
                  <th className="w-8" />
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {displayEntries.map((entry) => (
                  <tr
                    key={entry.id}
                    className="hover:bg-white/[0.02] transition-colors group"
                  >
                    <td className="px-4 py-3 text-white font-mono text-xs">
                      #{entry.hashtag}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1">
                        {entry.platforms.map((p) => (
                          <PlatformIcon key={p} platform={p} size="sm" />
                        ))}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {entry.topicPillar ? (
                        <Badge
                          variant="outline"
                          className="text-[10px] border-white/10 text-white/50 py-0"
                        >
                          {entry.topicPillar}
                        </Badge>
                      ) : (
                        <span className="text-white/20 text-xs">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-white/60 text-xs">
                      {entry.usageCount}
                    </td>
                    <td className="px-4 py-3 text-white/40 text-xs">
                      {entry.lastUsed
                        ? new Date(entry.lastUsed).toLocaleDateString()
                        : "—"}
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => handleDelete(entry.id, entry.hashtag)}
                        className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-red-500/10 text-white/20 hover:text-red-400"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
