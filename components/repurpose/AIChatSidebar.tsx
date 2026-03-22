"use client"

import { useState, useRef, useEffect } from "react"
import axios from "axios"
import { Send, Loader2, Bot, User, Undo2 } from "lucide-react"
import { toast } from "sonner"
import { useRepurposeStore } from "@/stores/repurposeStore"
import { PLATFORM_RULES } from "@/lib/platform-rules"
import { cn } from "@/lib/utils"
import type { Platform, ChatMessage } from "@/types"

// ---------------------------------------------------------------------------
// Simple word-level diff for highlighting changes
// ---------------------------------------------------------------------------

type DiffToken = { type: "equal" | "delete" | "insert"; text: string }

function computeWordDiff(oldText: string, newText: string): DiffToken[] {
  const oldWords = oldText.split(/(\s+)/)
  const newWords = newText.split(/(\s+)/)

  // Build LCS table
  const m = oldWords.length
  const n = newWords.length
  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0))

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (oldWords[i - 1] === newWords[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1])
      }
    }
  }

  // Trace back
  const tokens: DiffToken[] = []
  let i = m
  let j = n

  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && oldWords[i - 1] === newWords[j - 1]) {
      tokens.unshift({ type: "equal", text: oldWords[i - 1] })
      i--
      j--
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      tokens.unshift({ type: "insert", text: newWords[j - 1] })
      j--
    } else {
      tokens.unshift({ type: "delete", text: oldWords[i - 1] })
      i--
    }
  }

  return tokens
}

// ---------------------------------------------------------------------------
// Extended message type for internal use (diff data)
// ---------------------------------------------------------------------------

interface ChatEntry extends ChatMessage {
  previousText?: string
  updatedText?: string
  explanation?: string
}

// ---------------------------------------------------------------------------
// Quick action chips
// ---------------------------------------------------------------------------

const QUICK_ACTIONS = [
  "Make shorter",
  "Add a hook",
  "More casual",
  "Add emoji",
  "More direct",
  "Stronger CTA",
]

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface AIChatSidebarProps {
  postId: string
  activePlatform: Platform | null
  hasTextVariants: boolean
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function AIChatSidebar({
  postId,
  activePlatform,
  hasTextVariants,
}: AIChatSidebarProps) {
  const { variants, setVariantTextFromAI, chatHistory, addChatMessage, clearChatHistory, setChatHistory } =
    useRepurposeStore()

  const [input, setInput] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [localEntries, setLocalEntries] = useState<ChatEntry[]>([])

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  // Sync localEntries from store when platform changes
  useEffect(() => {
    if (!activePlatform) return
    const stored = chatHistory[activePlatform] ?? []
    setLocalEntries(stored as ChatEntry[])
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activePlatform])

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [localEntries])

  if (!hasTextVariants || !activePlatform) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-4 gap-3">
        <Bot className="w-8 h-8 text-[#333333]" />
        <p className="text-sm text-[#555555] text-center leading-relaxed">
          {!hasTextVariants
            ? "Waiting for text generation to complete..."
            : "Select a platform card on the left to start editing with AI."}
        </p>
      </div>
    )
  }

  const currentText = variants[activePlatform]?.text ?? ""
  const rules = PLATFORM_RULES[activePlatform]

  const sendMessage = async (instruction: string) => {
    if (!instruction.trim() || isLoading || !activePlatform) return

    const previousText = currentText

    const userEntry: ChatEntry = {
      role: "user",
      content: instruction,
      timestamp: new Date().toISOString(),
    }

    const updatedEntries = [...localEntries, userEntry]
    setLocalEntries(updatedEntries)
    addChatMessage(activePlatform, userEntry)
    setInput("")
    setIsLoading(true)

    try {
      // Build the messages array for the API (without diff fields)
      const apiMessages: ChatMessage[] = updatedEntries
        .filter((e) => e.role === "user" || e.role === "assistant")
        .map((e) => ({ role: e.role, content: e.content, timestamp: e.timestamp }))

      const res = await axios.post<{ updatedText: string; explanation: string }>(
        "/api/chat",
        {
          messages: apiMessages.slice(0, -1), // send history before this message
          currentVariantText: currentText,
          platform: activePlatform,
          instruction,
        }
      )

      const { updatedText, explanation } = res.data

      // Update the variant text in the store (AI edit — does not mark as manually edited)
      setVariantTextFromAI(activePlatform, updatedText)

      // Save the PATCH to the server in the background.
      axios
        .patch(`/api/posts/${postId}`, {
          platform: activePlatform,
          variant: { text: updatedText },
        })
        .catch(() => {
          // Non-fatal — text is already updated locally
        })

      const assistantEntry: ChatEntry = {
        role: "assistant",
        content: explanation,
        timestamp: new Date().toISOString(),
        previousText,
        updatedText,
        explanation,
      }

      setLocalEntries((prev) => [...prev, assistantEntry])
      addChatMessage(activePlatform, {
        role: "assistant",
        content: explanation,
        timestamp: assistantEntry.timestamp,
      })
    } catch (err) {
      const msg =
        axios.isAxiosError(err) && err.response?.data?.error
          ? err.response.data.error
          : "AI edit failed"
      toast.error(msg, { action: { label: "Retry", onClick: () => sendMessage(instruction) } })
      // Remove the user message on failure
      setLocalEntries((prev) => prev.slice(0, -1))
    } finally {
      setIsLoading(false)
    }
  }

  const handleRevert = (entry: ChatEntry, idx: number) => {
    if (!activePlatform || !entry.previousText) return

    // Restore previous text
    setVariantTextFromAI(activePlatform, entry.previousText)

    // PATCH the server
    axios
      .patch(`/api/posts/${postId}`, {
        platform: activePlatform,
        variant: { text: entry.previousText },
      })
      .catch(() => {})

    // Remove this assistant entry and its paired user entry (idx - 1)
    const newEntries = localEntries.filter((_, i) => i !== idx && i !== idx - 1)
    setLocalEntries(newEntries)

    // Sync to store
    setChatHistory(
      activePlatform,
      newEntries.map((e) => ({ role: e.role, content: e.content, timestamp: e.timestamp }))
    )
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      sendMessage(input)
    }
  }

  const handleClear = () => {
    if (!activePlatform) return
    setLocalEntries([])
    clearChatHistory(activePlatform)
  }

  return (
    <>
      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {localEntries.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-3 pt-8">
            <Bot className="w-7 h-7 text-[#333333]" />
            <p className="text-xs text-[#555555] text-center leading-relaxed">
              Editing{" "}
              <span className="text-[#888888] font-medium">{rules.label}</span>
              <br />
              {rules.maxChars.toLocaleString()} char limit
            </p>
          </div>
        ) : (
          localEntries.map((entry, idx) => (
            <div key={idx} className="space-y-1.5">
              {/* Message bubble */}
              <div
                className={cn(
                  "flex gap-2",
                  entry.role === "user" ? "justify-end" : "justify-start"
                )}
              >
                {entry.role === "assistant" && (
                  <div className="w-5 h-5 rounded bg-[#7C3AED]/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <Bot className="w-3 h-3 text-[#7C3AED]" />
                  </div>
                )}
                <div
                  className={cn(
                    "max-w-[85%] rounded-xl px-3 py-2 text-xs leading-relaxed",
                    entry.role === "user"
                      ? "bg-[#7C3AED]/20 text-[#F5F5F5]"
                      : "bg-[#1C1C1C] text-[#888888]"
                  )}
                >
                  {entry.content}
                </div>
                {entry.role === "user" && (
                  <div className="w-5 h-5 rounded bg-[#2A2A2A] flex items-center justify-center flex-shrink-0 mt-0.5">
                    <User className="w-3 h-3 text-[#888888]" />
                  </div>
                )}
              </div>

              {/* Diff view for assistant messages that changed text */}
              {entry.role === "assistant" &&
                entry.previousText != null &&
                entry.updatedText != null &&
                entry.previousText !== entry.updatedText && (
                  <div className="space-y-1">
                    <DiffView
                      oldText={entry.previousText}
                      newText={entry.updatedText}
                    />
                    {/* Revert button */}
                    <button
                      onClick={() => handleRevert(entry, idx)}
                      className="ml-7 flex items-center gap-1 text-[10px] text-[#555555] hover:text-amber-400 transition-colors"
                      title="Revert to text before this AI edit"
                    >
                      <Undo2 className="w-2.5 h-2.5" />
                      Revert
                    </button>
                  </div>
                )}
            </div>
          ))
        )}

        {isLoading && (
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 rounded bg-[#7C3AED]/20 flex items-center justify-center">
              <Bot className="w-3 h-3 text-[#7C3AED]" />
            </div>
            <div className="bg-[#1C1C1C] rounded-xl px-3 py-2">
              <Loader2 className="w-3 h-3 text-[#7C3AED] animate-spin" />
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Quick actions */}
      <div className="px-3 pb-2">
        <div className="flex flex-wrap gap-1.5">
          {QUICK_ACTIONS.map((action) => (
            <button
              key={action}
              onClick={() => sendMessage(action)}
              disabled={isLoading}
              className="text-[10px] bg-[#1C1C1C] hover:bg-[#222222] border border-[#2A2A2A] text-[#888888] hover:text-[#F5F5F5] px-2 py-1 rounded-full transition-colors disabled:opacity-40"
            >
              {action}
            </button>
          ))}
        </div>
      </div>

      {/* Input */}
      <div className="p-3 border-t border-[#2A2A2A] space-y-2">
        {localEntries.length > 0 && (
          <button
            onClick={handleClear}
            className="text-[10px] text-[#555555] hover:text-[#888888] transition-colors"
          >
            Clear history
          </button>
        )}
        <div className="flex gap-2 items-end">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={`Edit ${rules.label} post... (Enter to send)`}
            disabled={isLoading}
            rows={2}
            className="flex-1 bg-[#111111] border border-[#2A2A2A] focus:border-[#7C3AED] rounded-lg px-3 py-2 text-xs text-[#F5F5F5] placeholder:text-[#555555] outline-none resize-none transition-colors"
          />
          <button
            onClick={() => sendMessage(input)}
            disabled={isLoading || !input.trim()}
            className="flex-shrink-0 w-8 h-8 bg-[#7C3AED] hover:bg-[#6D28D9] disabled:opacity-40 rounded-lg flex items-center justify-center transition-colors"
          >
            {isLoading ? (
              <Loader2 className="w-3.5 h-3.5 text-white animate-spin" />
            ) : (
              <Send className="w-3.5 h-3.5 text-white" />
            )}
          </button>
        </div>
      </div>
    </>
  )
}

// ---------------------------------------------------------------------------
// Diff view component
// ---------------------------------------------------------------------------

function DiffView({ oldText, newText }: { oldText: string; newText: string }) {
  const tokens = computeWordDiff(oldText, newText)

  // Only show if there are actual differences
  const hasDiffs = tokens.some((t) => t.type !== "equal")
  if (!hasDiffs) return null

  return (
    <div className="ml-7 bg-[#111111] border border-[#2A2A2A] rounded-lg p-2 text-[11px] leading-relaxed">
      <p className="text-[9px] text-[#555555] uppercase tracking-wider mb-1.5">Changes</p>
      <span>
        {tokens.map((token, i) => {
          if (token.type === "delete") {
            return (
              <span key={i} className="line-through text-red-400/70 bg-red-500/10">
                {token.text}
              </span>
            )
          }
          if (token.type === "insert") {
            return (
              <span key={i} className="text-emerald-400 bg-emerald-500/10">
                {token.text}
              </span>
            )
          }
          return <span key={i} className="text-[#555555]">{token.text}</span>
        })}
      </span>
    </div>
  )
}
