"use client"

import { useState, KeyboardEvent } from "react"
import { X } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

interface TopicPillarsInputProps {
  pillars: string[]
  onChange: (pillars: string[]) => void
  maxPillars?: number
}

export function TopicPillarsInput({
  pillars,
  onChange,
  maxPillars = 6,
}: TopicPillarsInputProps) {
  const [input, setInput] = useState("")

  const add = (value: string) => {
    const trimmed = value.trim()
    if (trimmed && !pillars.includes(trimmed) && pillars.length < maxPillars) {
      onChange([...pillars, trimmed])
    }
    setInput("")
  }

  const remove = (pillar: string) => {
    onChange(pillars.filter((p) => p !== pillar))
  }

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault()
      add(input)
    } else if (e.key === "Backspace" && !input && pillars.length > 0) {
      remove(pillars[pillars.length - 1])
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label className="text-white/70 text-sm">
          Topic pillars ({pillars.length}/{maxPillars})
        </Label>
        <span className="text-white/30 text-xs">
          Used for hashtag intelligence and gap detection
        </span>
      </div>

      <div className="flex flex-wrap gap-1.5 p-2.5 rounded-md border border-white/10 bg-[#161616] min-h-[42px]">
        {pillars.map((pillar) => (
          <span
            key={pillar}
            className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-[#7C3AED]/20 text-[#a78bfa] text-xs font-medium"
          >
            {pillar}
            <button
              type="button"
              onClick={() => remove(pillar)}
              className="hover:text-white"
            >
              <X className="w-2.5 h-2.5" />
            </button>
          </span>
        ))}
        {pillars.length < maxPillars && (
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder={pillars.length === 0 ? "e.g. productivity, AI tools, leadership..." : ""}
            className="border-none bg-transparent h-5 p-0 text-sm text-white placeholder:text-white/20 focus-visible:ring-0 min-w-[120px] flex-1"
          />
        )}
      </div>
    </div>
  )
}
