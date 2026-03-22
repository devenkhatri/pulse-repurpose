"use client"

import { useEffect, useRef, useState, useCallback, Suspense } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import axios from "axios"
import { toast } from "sonner"
import { FileText, ChevronLeft, ChevronRight, Keyboard, X } from "lucide-react"
import { TopBar } from "@/components/layout/TopBar"
import { SourcePostPanel } from "@/components/repurpose/SourcePostPanel"
import { PlatformCard } from "@/components/repurpose/PlatformCard"
import { GenerationStatusPanel } from "@/components/repurpose/GenerationStatusPanel"
import { AIChatSidebar } from "@/components/repurpose/AIChatSidebar"
import { CarouselPreview } from "@/components/repurpose/CarouselPreview"
import { ConfirmDialog } from "@/components/shared/ConfirmDialog"
import { useRepurposeStore } from "@/stores/repurposeStore"
import type { LinkedInPost, Platform, CarouselPromptOutput } from "@/types"

const POLL_INTERVAL_MS = 3000
const POLL_TIMEOUT_MS = 5 * 60 * 1000 // 5 minutes

// ---------------------------------------------------------------------------
// Helper — extract a human-readable error from an axios catch
// ---------------------------------------------------------------------------

function extractApiError(err: unknown, fallback: string): string {
  if (axios.isAxiosError(err)) {
    const data = err.response?.data as Record<string, unknown> | undefined
    if (typeof data?.error === "string") return data.error
    if (err.code === "ECONNABORTED") return "Request timed out — is the n8n workflow active?"
    if (err.message) return err.message
  }
  if (err instanceof Error) return err.message
  return fallback
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function generationSettled(
  post: LinkedInPost,
  platforms: Platform[],
  mode: "text" | "images"
): boolean {
  return platforms.every((p) => {
    const v = post.platforms[p]
    if (!v) return false
    if (v.status === "failed") return true
    if (mode === "text") return v.text != null && v.text !== ""
    return v.imageUrl != null
  })
}

function anyPlatformFailed(post: LinkedInPost, platforms: Platform[]): boolean {
  return platforms.some((p) => post.platforms[p]?.status === "failed")
}

// ---------------------------------------------------------------------------
// Keyboard shortcuts dialog
// ---------------------------------------------------------------------------

interface KeyboardShortcutsDialogProps {
  open: boolean
  onClose: () => void
}

const SHORTCUTS = [
  { keys: "⌘↵", description: "Approve the focused platform card" },
  { keys: "⌘⇧R", description: "Re-generate text (with confirmation if edited)" },
  { keys: "⌘S", description: "Save brand voice (Settings page)" },
  { keys: "Esc", description: "Clear platform card focus" },
  { keys: "?", description: "Show this keyboard shortcuts dialog" },
]

function KeyboardShortcutsDialog({ open, onClose }: KeyboardShortcutsDialogProps) {
  if (!open) return null

  return (
    <>
      <div
        className="fixed inset-0 bg-black/60 z-50"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Keyboard shortcuts"
        className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-[400px] bg-[#161616] border border-[#2A2A2A] rounded-xl shadow-2xl p-5"
      >
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Keyboard className="w-4 h-4 text-[#7C3AED]" />
            <h2 className="text-sm font-semibold text-[#F5F5F5]">Keyboard Shortcuts</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-white/5 text-[#555555] hover:text-white transition-colors"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <table className="w-full text-sm">
          <tbody className="space-y-2">
            {SHORTCUTS.map(({ keys, description }) => (
              <tr key={keys} className="border-b border-[#2A2A2A] last:border-0">
                <td className="py-2 pr-4 w-20">
                  <kbd className="inline-flex items-center px-2 py-0.5 rounded bg-[#1C1C1C] border border-[#2A2A2A] text-xs font-mono text-[#A78BFA]">
                    {keys}
                  </kbd>
                </td>
                <td className="py-2 text-[#888888] text-xs">{description}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  )
}

// ---------------------------------------------------------------------------
// Inner page (needs useSearchParams → must be wrapped in Suspense)
// ---------------------------------------------------------------------------

function RepurposePageInner() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const postId = searchParams.get("postId")

  const {
    activePost,
    generationStatus,
    imageGenerationStatus,
    selectedPlatforms,
    variants,
    activePlatform,
    dirtyPlatforms,
    setActivePost,
    setGenerationStatus,
    setImageGenerationStatus,
    setActivePlatform,
    initVariantsFromPost,
    clearSession,
  } = useRepurposeStore()

  const [isLoading, setIsLoading] = useState(false)
  const [pollWarning, setPollWarning] = useState(false)
  const [showRegenConfirm, setShowRegenConfirm] = useState(false)
  const [showShortcutsDialog, setShowShortcutsDialog] = useState(false)
  const [carousel, setCarousel] = useState<CarouselPromptOutput | null>(null)
  const [carouselGenerating, setCarouselGenerating] = useState(false)
  const [chatCollapsed, setChatCollapsed] = useState(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("pulse.chat.collapsed") === "true"
    }
    return false
  })

  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const pollStartRef = useRef<number>(0)
  /** Snapshot of each platform's content state at the moment polling begins */
  const prePollStateRef = useRef<Partial<Record<Platform, { hasText: boolean; hasImage: boolean }>>>({})
  /** How many consecutive polls have seen the exact same content snapshot */
  const stableCountRef = useRef<number>(0)
  const lastPollContentRef = useRef<string>("")

  // ------------------------------------------------------------------
  // Core fetch helper
  // ------------------------------------------------------------------

  const fetchPost = useCallback(async (id: string): Promise<LinkedInPost | null> => {
    const res = await axios.get<{ post: LinkedInPost }>(`/api/posts/${id}`)
    return res.data.post
  }, [])

  // ------------------------------------------------------------------
  // Polling helpers
  // ------------------------------------------------------------------

  const stopPolling = useCallback(() => {
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current)
      pollIntervalRef.current = null
    }
  }, [])

  const startPolling = useCallback(
    (id: string, mode: "text" | "images") => {
      stopPolling()
      pollStartRef.current = Date.now()
      setPollWarning(false)
      stableCountRef.current = 0
      lastPollContentRef.current = ""

      pollIntervalRef.current = setInterval(async () => {
        try {
          const elapsed = Date.now() - pollStartRef.current
          if (elapsed > POLL_TIMEOUT_MS) {
            stopPolling()
            if (mode === "text") setGenerationStatus("idle")
            else setImageGenerationStatus("idle")
            setPollWarning(true)
            return
          }

          const post = await fetchPost(id)
          if (!post) return

          setActivePost(post)
          initVariantsFromPost(post)

          // Track content stability for partial success detection
          const contentSnapshot = selectedPlatforms
            .map((p) => (mode === "text" ? post.platforms[p]?.text ?? "" : post.platforms[p]?.imageUrl ?? ""))
            .join("|")
          if (contentSnapshot !== lastPollContentRef.current) {
            stableCountRef.current = 0
            lastPollContentRef.current = contentSnapshot
          } else {
            stableCountRef.current++
          }

          if (mode === "text" && generationSettled(post, selectedPlatforms, "text")) {
            stopPolling()
            if (anyPlatformFailed(post, selectedPlatforms)) {
              setGenerationStatus("failed")
              toast.error("Some platforms failed to generate — check n8n logs")
            } else {
              setGenerationStatus("done")
            }
          } else if (mode === "images" && generationSettled(post, selectedPlatforms, "images")) {
            stopPolling()
            if (anyPlatformFailed(post, selectedPlatforms)) {
              setImageGenerationStatus("failed")
              toast.error("Some image generations failed — check n8n logs")
            } else {
              setImageGenerationStatus("done")
            }
          } else if (stableCountRef.current >= 3) {
            // Content has been unchanged for 3+ polls (~9s) — detect partial success
            const newPlatforms = selectedPlatforms.filter((p) => {
              const before = prePollStateRef.current[p]
              if (mode === "text") return !before?.hasText && !!post.platforms[p]?.text
              return !before?.hasImage && !!post.platforms[p]?.imageUrl
            })
            if (newPlatforms.length > 0) {
              stopPolling()
              if (mode === "text") {
                setGenerationStatus("done")
                toast.warning(
                  `${newPlatforms.length}/${selectedPlatforms.length} platforms generated — some may have been skipped by n8n`,
                  { duration: 6000 }
                )
              } else {
                setImageGenerationStatus("done")
                toast.warning(
                  `${newPlatforms.length}/${selectedPlatforms.length} images generated — some may have been skipped`,
                  { duration: 6000 }
                )
              }
            }
          }
        } catch {
          // Deduplicated toast for recurring poll errors
          toast.error("Polling failed — check your network connection", { id: "poll-error" })
        }
      }, POLL_INTERVAL_MS)
    },
    [
      stopPolling,
      fetchPost,
      setActivePost,
      initVariantsFromPost,
      selectedPlatforms,
      setGenerationStatus,
      setImageGenerationStatus,
    ]
  )

  // ------------------------------------------------------------------
  // Unsaved changes warning on navigation (item 2)
  // ------------------------------------------------------------------

  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (dirtyPlatforms.size > 0) {
        e.preventDefault()
        e.returnValue = ""
      }
    }
    window.addEventListener("beforeunload", handleBeforeUnload)
    return () => window.removeEventListener("beforeunload", handleBeforeUnload)
  }, [dirtyPlatforms])

  // ------------------------------------------------------------------
  // Trigger handlers
  // ------------------------------------------------------------------

  const handleAbortText = useCallback(() => {
    stopPolling()
    setGenerationStatus("idle")
    toast.info("Text generation aborted")
  }, [stopPolling, setGenerationStatus])

  const handleAbortImages = useCallback(() => {
    stopPolling()
    setImageGenerationStatus("idle")
    toast.info("Image generation aborted")
  }, [stopPolling, setImageGenerationStatus])

  const handleTriggerRepurpose = useCallback(
    async (overridePostId?: string) => {
      const id = overridePostId ?? activePost?.id
      if (!id) return

      setGenerationStatus("generating_text")
      try {
        await axios.post("/api/trigger/repurpose", {
          postId: id,
          platforms: selectedPlatforms,
        })
        // Snapshot pre-generation content state for partial success detection
        if (activePost) {
          prePollStateRef.current = Object.fromEntries(
            selectedPlatforms.map((p) => [p, {
              hasText: !!activePost.platforms[p]?.text,
              hasImage: !!activePost.platforms[p]?.imageUrl,
            }])
          )
        }
        startPolling(id, "text")
      } catch (err) {
        const msg = extractApiError(err, "Text generation could not be triggered")
        toast.error(msg, {
          action: { label: "Retry", onClick: () => handleTriggerRepurpose(id) },
        })
        setGenerationStatus("idle")
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [activePost?.id, selectedPlatforms, setGenerationStatus, startPolling]
  )

  const handleTriggerImages = useCallback(async (platformsOverride?: Platform[]) => {
    if (!activePost?.id) return
    const platforms = platformsOverride ?? selectedPlatforms

    setImageGenerationStatus("generating_images")
    try {
      await axios.post("/api/trigger/images", {
        postId: activePost.id,
        platforms,
      })
      // Snapshot pre-generation content state for partial success detection
      prePollStateRef.current = Object.fromEntries(
        platforms.map((p) => [p, {
          hasText: !!activePost.platforms[p]?.text,
          hasImage: !!activePost.platforms[p]?.imageUrl,
        }])
      )
      startPolling(activePost.id, "images")
    } catch (err) {
      const msg = extractApiError(err, "Image generation could not be triggered")
      toast.error(msg, {
        action: { label: "Retry", onClick: () => handleTriggerImages(platformsOverride) },
      })
      setImageGenerationStatus("idle")
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activePost?.id, selectedPlatforms, setImageGenerationStatus, startPolling])

  const handleRegenerateImageForPlatform = useCallback((platform: Platform) => {
    void handleTriggerImages([platform])
  }, [handleTriggerImages])

  const handleToggleCarousel = useCallback(async () => {
    // If carousel already loaded, toggle it off
    if (carousel) {
      setCarousel(null)
      return
    }
    if (!activePost) return
    setCarouselGenerating(true)
    try {
      const res = await axios.post<{ carousel: CarouselPromptOutput }>("/api/skills/carousel", {
        postId: activePost.id,
        linkedinText: activePost.linkedinText,
      })
      setCarousel(res.data.carousel)
    } catch (err) {
      const msg = extractApiError(err, "Failed to generate LinkedIn Carousel")
      toast.error(msg)
    } finally {
      setCarouselGenerating(false)
    }
  }, [carousel, activePost])

  // ------------------------------------------------------------------
  // Approve all
  // ------------------------------------------------------------------

  const handleApproveAll = useCallback(async () => {
    if (!activePost?.id) return

    const variantUpdates: Record<string, { status: "approved"; approvedAt: string }> = {}
    for (const platform of selectedPlatforms) {
      const v = activePost.platforms[platform]
      if (v?.text && v.status !== "published" && v.status !== "scheduled") {
        variantUpdates[platform] = {
          status: "approved",
          approvedAt: new Date().toISOString(),
        }
      }
    }

    if (Object.keys(variantUpdates).length === 0) return

    try {
      await axios.patch(`/api/posts/${activePost.id}`, { variants: variantUpdates })
      const post = await fetchPost(activePost.id)
      if (post) {
        setActivePost(post)
        initVariantsFromPost(post)
      }
      toast.success("All platforms approved")
    } catch {
      toast.error("Failed to approve all platforms")
    }
  }, [activePost, selectedPlatforms, fetchPost, setActivePost, initVariantsFromPost])

  // ------------------------------------------------------------------
  // Refresh callback used by PlatformCard
  // ------------------------------------------------------------------

  const handleRefresh = useCallback(async () => {
    if (!postId) return
    const post = await fetchPost(postId)
    if (post) {
      setActivePost(post)
      initVariantsFromPost(post)
    }
  }, [postId, fetchPost, setActivePost, initVariantsFromPost])

  // ------------------------------------------------------------------
  // Load post on mount / postId change
  // ------------------------------------------------------------------

  useEffect(() => {
    if (!postId) return

    clearSession()
    setIsLoading(true)

    fetchPost(postId)
      .then((post) => {
        if (!post) {
          toast.error("Post not found")
          return
        }
        setActivePost(post)
        initVariantsFromPost(post)
      })
      .catch(() => toast.error("Failed to load post"))
      .finally(() => setIsLoading(false))

    return () => stopPolling()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [postId])

  // ------------------------------------------------------------------
  // Keyboard shortcuts
  // ------------------------------------------------------------------

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const isMac = navigator.platform.toUpperCase().includes("MAC")
      const metaKey = isMac ? e.metaKey : e.ctrlKey

      // ? — open keyboard shortcuts dialog (when not typing)
      const tag = (e.target as HTMLElement).tagName.toLowerCase()
      const isTyping = tag === "input" || tag === "textarea" || tag === "select"

      if (e.key === "?" && !isTyping) {
        setShowShortcutsDialog((prev) => !prev)
        return
      }

      // Escape — close shortcuts dialog or clear active platform focus
      if (e.key === "Escape") {
        if (showShortcutsDialog) {
          setShowShortcutsDialog(false)
        } else {
          setActivePlatform(null)
        }
        return
      }

      // Don't fire shortcuts when user is typing in an input / textarea
      if (isTyping) return

      // Cmd+Enter — approve the focused (active) platform card
      if (metaKey && e.key === "Enter") {
        e.preventDefault()
        if (activePlatform && activePost) {
          const variant = activePost.platforms[activePlatform]
          if (variant?.text && variant.status !== "published" && variant.status !== "scheduled") {
            axios
              .patch(`/api/posts/${activePost.id}`, {
                platform: activePlatform,
                variant: { status: "approved", approvedAt: new Date().toISOString() },
              })
              .then(() => handleRefresh())
              .catch(() => toast.error("Failed to approve"))
          }
        }
        return
      }

      // Cmd+Shift+R — re-generate (with confirmation if any edited variant exists)
      if (metaKey && e.shiftKey && e.key.toLowerCase() === "r") {
        e.preventDefault()
        if (!activePost || generationStatus === "generating_text") return
        const hasEdits = selectedPlatforms.some((p) => activePost.platforms[p]?.isEdited)
        if (hasEdits) {
          setShowRegenConfirm(true)
        } else {
          handleTriggerRepurpose()
        }
      }
    }

    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [
    activePlatform,
    activePost,
    generationStatus,
    selectedPlatforms,
    showShortcutsDialog,
    setActivePlatform,
    handleRefresh,
    handleTriggerRepurpose,
  ])

  // ------------------------------------------------------------------
  // Chat collapse toggle with localStorage persistence
  // ------------------------------------------------------------------

  function toggleChatCollapsed() {
    setChatCollapsed((prev) => {
      const next = !prev
      try { localStorage.setItem("pulse.chat.collapsed", String(next)) } catch {}
      return next
    })
  }

  // ------------------------------------------------------------------
  // Derived state
  // ------------------------------------------------------------------

  const isGenerating =
    generationStatus === "generating_text" ||
    imageGenerationStatus === "generating_images"

  const hasTextVariants =
    !!activePost &&
    selectedPlatforms.some((p) => {
      const t = activePost.platforms[p]?.text
      return t != null && t !== ""
    })

  // ------------------------------------------------------------------
  // No postId state — structured empty state (item 13)
  // ------------------------------------------------------------------

  if (!postId) {
    return (
      <div className="flex flex-col h-full">
        <TopBar title="Repurpose" />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center space-y-4 max-w-xs">
            <FileText className="w-12 h-12 text-[#333333] mx-auto" />
            <div className="space-y-1">
              <h3 className="text-sm font-medium text-[#888888]">No post selected</h3>
              <p className="text-xs text-[#555555] leading-relaxed">
                Select a post from the Dashboard to repurpose it across platforms.
              </p>
            </div>
            <button
              onClick={() => router.push("/dashboard")}
              className="px-4 py-2 text-sm bg-[#7C3AED] hover:bg-[#6D28D9] text-white rounded-lg transition-colors"
            >
              Go to Dashboard
            </button>
          </div>
        </div>
      </div>
    )
  }

  // ------------------------------------------------------------------
  // Render
  // ------------------------------------------------------------------

  return (
    <>
    <KeyboardShortcutsDialog
      open={showShortcutsDialog}
      onClose={() => setShowShortcutsDialog(false)}
    />
    <ConfirmDialog
      open={showRegenConfirm}
      title="Re-generate content?"
      description="This will overwrite your manual edits for all platforms. Continue?"
      confirmLabel="Re-generate"
      onConfirm={() => {
        setShowRegenConfirm(false)
        handleTriggerRepurpose()
      }}
      onCancel={() => setShowRegenConfirm(false)}
    />
    <div className="flex flex-col h-full">
      <TopBar
        title="Repurpose"
        actions={
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowShortcutsDialog(true)}
              className="p-1.5 rounded hover:bg-white/5 text-zinc-500 hover:text-zinc-300 transition-colors"
              title="Keyboard shortcuts (?)"
              aria-label="Show keyboard shortcuts"
            >
              <Keyboard className="w-4 h-4" />
            </button>
            {hasTextVariants && (
              <button
                onClick={handleApproveAll}
                className="px-3 py-1.5 text-sm bg-[#7C3AED] hover:bg-[#6D28D9] text-white rounded-lg transition-colors"
                title="Approve all platforms (⌘↵)"
              >
                Approve all
              </button>
            )}
          </div>
        }
      />

      <div className="flex-1 overflow-hidden flex">
        {/* ── Column 1 — Source post ── */}
        <div className="w-[260px] flex-shrink-0 border-r border-[#2A2A2A] overflow-y-auto">
          {isLoading ? (
            <div className="p-4 space-y-3">
              <div className="h-3 bg-[#1C1C1C] rounded animate-pulse w-1/3" />
              <div className="h-36 bg-[#1C1C1C] rounded animate-pulse" />
              <div className="h-8 bg-[#1C1C1C] rounded animate-pulse" />
            </div>
          ) : activePost ? (
            <SourcePostPanel
              post={activePost}
              generationStatus={generationStatus}
              imageGenerationStatus={imageGenerationStatus}
              selectedPlatforms={selectedPlatforms}
              hasTextVariants={hasTextVariants}
              carouselEnabled={!!carousel}
              carouselGenerating={carouselGenerating}
              onTriggerRepurpose={handleTriggerRepurpose}
              onTriggerImages={() => handleTriggerImages()}
              onAbortText={handleAbortText}
              onAbortImages={handleAbortImages}
              onToggleCarousel={handleToggleCarousel}
            />
          ) : (
            <div className="p-4">
              <p className="text-sm text-[#888888]">Post not found.</p>
            </div>
          )}
        </div>

        {/* ── Column 2 — Platform cards ── */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* Polling timeout warning */}
          {pollWarning && (
            <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-3 flex items-center justify-between">
              <p className="text-sm text-amber-400">
                Generation is taking longer than expected — check your n8n workflow.
              </p>
              <button
                onClick={handleRefresh}
                className="text-sm text-amber-400 underline ml-4 flex-shrink-0"
              >
                Refresh
              </button>
            </div>
          )}

          {/* Generation status panel */}
          {isGenerating && (
            <GenerationStatusPanel
              generationStatus={generationStatus}
              imageGenerationStatus={imageGenerationStatus}
              selectedPlatforms={selectedPlatforms}
              activePost={activePost}
            />
          )}

          {/* LinkedIn Carousel preview */}
          {carousel && (
            <div className="bg-[#161616] border border-[#7C3AED]/30 rounded-xl p-4">
              <CarouselPreview
                carousel={carousel}
                onChange={setCarousel}
              />
            </div>
          )}

          {/* Platform cards */}
          {activePost &&
            selectedPlatforms.map((platform) => (
              <PlatformCard
                key={platform}
                platform={platform}
                postId={activePost.id}
                platformVariant={activePost.platforms[platform]}
                localVariant={variants[platform]}
                isTextGenerating={generationStatus === "generating_text"}
                isImageGenerating={imageGenerationStatus === "generating_images"}
                isActive={activePlatform === platform}
                onFocus={setActivePlatform}
                onRefresh={handleRefresh}
                onRegenerateImage={handleRegenerateImageForPlatform}
              />
            ))}

          {!activePost && !isLoading && (
            <div className="flex items-center justify-center h-64">
              <p className="text-[#888888]">No post loaded.</p>
            </div>
          )}
        </div>

        {/* ── Column 3 — AI chat sidebar ── */}
        <div
          className={`flex-shrink-0 border-l border-[#2A2A2A] flex flex-col transition-all duration-200 ${
            chatCollapsed ? "w-10" : "w-[280px]"
          }`}
        >
          {chatCollapsed ? (
            /* Collapsed strip — toggle button only */
            <button
              onClick={toggleChatCollapsed}
              className="flex-1 flex flex-col items-center justify-start pt-4 gap-2 text-[#555555] hover:text-[#888888] transition-colors"
              title="Expand AI Assistant"
              aria-label="Expand AI Assistant"
            >
              <ChevronLeft className="w-4 h-4" />
              <span
                className="text-[10px] uppercase tracking-widest"
                style={{ writingMode: "vertical-rl", transform: "rotate(180deg)" }}
              >
                AI
              </span>
            </button>
          ) : (
            <>
              <div className="p-4 border-b border-[#2A2A2A] flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-medium text-[#F5F5F5]">AI Assistant</h3>
                  <p className="text-xs text-[#555555] mt-0.5">
                    {activePlatform
                      ? `Editing ${activePlatform}`
                      : "Select a card to focus"}
                  </p>
                </div>
                <button
                  onClick={toggleChatCollapsed}
                  className="p-1 rounded hover:bg-white/5 text-[#555555] hover:text-[#888888] transition-colors"
                  title="Collapse AI Assistant"
                  aria-label="Collapse AI Assistant"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
              {postId && (
                <AIChatSidebar
                  postId={postId}
                  activePlatform={activePlatform}
                  hasTextVariants={hasTextVariants}
                />
              )}
            </>
          )}
        </div>
      </div>
    </div>
    </>
  )
}

// ---------------------------------------------------------------------------
// Export — wrapped in Suspense for useSearchParams
// ---------------------------------------------------------------------------

export default function RepurposePage() {
  return (
    <Suspense
      fallback={
        <div className="flex flex-col h-full">
          <TopBar title="Repurpose" />
          <div className="flex-1 flex items-center justify-center">
            <p className="text-[#888888]">Loading...</p>
          </div>
        </div>
      }
    >
      <RepurposePageInner />
    </Suspense>
  )
}
