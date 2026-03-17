"use client"

import { useState, KeyboardEvent } from "react"
import { X } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

const SUGGESTIONS = [
  "synergy",
  "game-changer",
  "leverage",
  "thought leader",
  "circle back",
  "touch base",
  "move the needle",
  "deep dive",
]

interface AvoidListInputProps {
  items: string[]
  onChange: (items: string[]) => void
}

export function AvoidListInput({ items, onChange }: AvoidListInputProps) {
  const [input, setInput] = useState("")

  const add = (value: string) => {
    const trimmed = value.trim()
    if (trimmed && !items.includes(trimmed)) {
      onChange([...items, trimmed])
    }
    setInput("")
  }

  const remove = (item: string) => {
    onChange(items.filter((i) => i !== item))
  }

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault()
      add(input)
    } else if (e.key === "Backspace" && !input && items.length > 0) {
      remove(items[items.length - 1])
    }
  }

  const unusedSuggestions = SUGGESTIONS.filter((s) => !items.includes(s))

  return (
    <div className="space-y-3">
      <Label className="text-white/70 text-sm">Words / phrases to avoid</Label>

      {/* Tag display + input */}
      <div className="flex flex-wrap gap-1.5 p-2.5 rounded-md border border-white/10 bg-[#161616] min-h-[42px]">
        {items.map((item) => (
          <span
            key={item}
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-red-500/15 text-red-400 text-xs"
          >
            {item}
            <button
              type="button"
              onClick={() => remove(item)}
              className="hover:text-red-300"
            >
              <X className="w-2.5 h-2.5" />
            </button>
          </span>
        ))}
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder={items.length === 0 ? "Type a word and press Enter..." : ""}
          className="border-none bg-transparent h-5 p-0 text-sm text-white placeholder:text-white/20 focus-visible:ring-0 min-w-[120px] flex-1"
        />
      </div>

      {/* Suggestions */}
      {unusedSuggestions.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {unusedSuggestions.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => add(s)}
              className="px-2 py-0.5 rounded-md border border-white/10 text-white/40 text-xs hover:border-red-500/40 hover:text-red-400 transition-colors"
            >
              + {s}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
