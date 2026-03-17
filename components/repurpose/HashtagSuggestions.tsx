"use client"

import { useState } from "react"
import axios from "axios"
import { Sparkles, Loader2 } from "lucide-react"
import { toast } from "sonner"
import { useRepurposeStore } from "@/stores/repurposeStore"
import type { Platform } from "@/types"

interface HashtagSuggestionsProps {
  platform: Platform
  postText: string
  existingHashtags: string[]
  maxHashtags: number
}

export function HashtagSuggestions({
  platform,
  postText,
  existingHashtags,
  maxHashtags,
}: HashtagSuggestionsProps) {
  const { setVariantHashtags } = useRepurposeStore()
  const [suggestions, setSuggestions] = useState<string[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSuggest = async () => {
    if (!postText.trim()) return
    setIsLoading(true)
    setError(null)

    try {
      const res = await axios.post<{ suggestions: string[] }>("/api/hashtags", {
        postText,
        platform,
        existingHashtags,
      })
      // Filter out ones already in use
      const fresh = res.data.suggestions.filter((s) => !existingHashtags.includes(s))
      setSuggestions(fresh)
    } catch (err) {
      const msg =
        axios.isAxiosError(err) && err.response?.data?.error
          ? err.response.data.error
          : "Failed to fetch suggestions"
      setError(msg)
      toast.error(msg, { action: { label: "Retry", onClick: handleSuggest } })
    } finally {
      setIsLoading(false)
    }
  }

  const handleAdd = (tag: string) => {
    if (existingHashtags.length >= maxHashtags) {
      toast.error(`Max ${maxHashtags} hashtags for this platform`)
      return
    }
    setVariantHashtags(platform, [...existingHashtags, tag])
    setSuggestions((prev) => prev.filter((s) => s !== tag))
  }

  return (
    <div className="space-y-2">
      <button
        onClick={handleSuggest}
        disabled={isLoading || !postText.trim()}
        className="flex items-center gap-1.5 text-xs text-[#7C3AED] hover:text-[#A78BFA] transition-colors disabled:opacity-40"
      >
        {isLoading ? (
          <Loader2 className="w-3 h-3 animate-spin" />
        ) : (
          <Sparkles className="w-3 h-3" />
        )}
        {isLoading ? "Suggesting..." : "Suggest hashtags"}
      </button>

      {error && (
        <p className="text-xs text-red-400">{error}</p>
      )}

      {suggestions.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {suggestions.map((tag) => (
            <button
              key={tag}
              onClick={() => handleAdd(tag)}
              className="inline-flex items-center text-xs bg-[#7C3AED]/10 text-[#888888] hover:text-[#A78BFA] hover:bg-[#7C3AED]/20 border border-[#7C3AED]/20 hover:border-[#7C3AED]/40 px-2 py-0.5 rounded-full transition-colors"
              title="Click to add"
            >
              #{tag}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
