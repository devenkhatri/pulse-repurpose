"use client"

import { useEffect, useRef, useState, useCallback, Suspense } from "react"
import { useSearchParams } from "next/navigation"
import axios from "axios"
import { toast } from "sonner"
import { TopBar } from "@/components/layout/TopBar"
import { SourcePostPanel } from "@/components/repurpose/SourcePostPanel"
import { PlatformCard } from "@/components/repurpose/PlatformCard"
import { GenerationStatusPanel } from "@/components/repurpose/GenerationStatusPanel"
import { useRepurposeStore } from "@/stores/repurposeStore"
import type { LinkedInPost, Platform } from "@/types"

const POLL_INTERVAL_MS = 3000
const POLL_TIMEOUT_MS = 5 * 60 * 1000 // 5 minutes

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function allPlatformsPending(post: LinkedInPost, platforms: Platform[]): boolean {
  return platforms.every((p) => post.platforms[p]?.status === "pending")
}

function postIsWithin7Days(post: LinkedInPost): boolean {
  const diff = Date.now() - new Date(post.postedAt).getTime()
  return diff < 7 * 24 * 60 * 60 * 1000
}

function allPlatformsHaveText(post: LinkedInPost, platforms: Platform[]): boolean {
  return platforms.every((p) => {
    const t = post.platforms[p]?.text
    return t != null && t !== ""
  })
}

function allPlatformsHaveImages(post: LinkedInPost, platforms: Platform[]): boolean {
  return platforms.every((p) => post.platforms[p]?.imageUrl != null)
}

// ---------------------------------------------------------------------------
// Inner page (needs useSearchParams → must be wrapped in Suspense)
// ---------------------------------------------------------------------------

function RepurposePageInner() {
  const searchParams = useSearchParams()
  const postId = searchParams.get("postId")

  const {
    activePost,
    generationStatus,
    imageGenerationStatus,
    selectedPlatforms,
    variants,
    setActivePost,
    setGenerationStatus,
    setImageGenerationStatus,
    initVariantsFromPost,
    clearSession,
  } = useRepurposeStore()

  const [isLoading, setIsLoading] = useState(false)
  const [pollWarning, setPollWarning] = useState(false)

  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const pollStartRef = useRef<number>(0)
  const autoTriggeredRef = useRef(false)

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

          if (mode === "text" && allPlatformsHaveText(post, selectedPlatforms)) {
            stopPolling()
            setGenerationStatus("done")
          } else if (mode === "images" && allPlatformsHaveImages(post, selectedPlatforms)) {
            stopPolling()
            setImageGenerationStatus("done")
          }
        } catch {
          // silently continue polling
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
  // Trigger handlers
  // ------------------------------------------------------------------

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
        startPolling(id, "text")
      } catch {
        toast.error("Text generation could not be triggered — check n8n workflow", {
          action: { label: "Retry", onClick: () => handleTriggerRepurpose(id) },
        })
        setGenerationStatus("idle")
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [activePost?.id, selectedPlatforms, setGenerationStatus, startPolling]
  )

  const handleTriggerImages = useCallback(async () => {
    if (!activePost?.id) return

    setImageGenerationStatus("generating_images")
    try {
      await axios.post("/api/trigger/images", {
        postId: activePost.id,
        platforms: selectedPlatforms,
      })
      startPolling(activePost.id, "images")
    } catch {
      toast.error("Image generation could not be triggered — check n8n workflow", {
        action: { label: "Retry", onClick: handleTriggerImages },
      })
      setImageGenerationStatus("idle")
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activePost?.id, selectedPlatforms, setImageGenerationStatus, startPolling])

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
    autoTriggeredRef.current = false
    setIsLoading(true)

    fetchPost(postId)
      .then(async (post) => {
        if (!post) {
          toast.error("Post not found")
          return
        }
        setActivePost(post)
        initVariantsFromPost(post)

        // Auto-trigger if all pending and post within 7 days
        if (
          allPlatformsPending(post, selectedPlatforms) &&
          postIsWithin7Days(post) &&
          !autoTriggeredRef.current
        ) {
          autoTriggeredRef.current = true
          setGenerationStatus("generating_text")
          try {
            await axios.post("/api/trigger/repurpose", {
              postId: post.id,
              platforms: selectedPlatforms,
            })
            startPolling(post.id, "text")
          } catch {
            toast.error("Text generation could not be triggered", {
              action: {
                label: "Retry",
                onClick: () => handleTriggerRepurpose(post.id),
              },
            })
            setGenerationStatus("idle")
          }
        }
      })
      .catch(() => toast.error("Failed to load post"))
      .finally(() => setIsLoading(false))

    return () => stopPolling()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [postId])

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
  // No postId state
  // ------------------------------------------------------------------

  if (!postId) {
    return (
      <div className="flex flex-col h-full">
        <TopBar title="Repurpose" />
        <div className="flex-1 flex items-center justify-center">
          <p className="text-[#888888]">
            Select a post from the Dashboard to repurpose it.
          </p>
        </div>
      </div>
    )
  }

  // ------------------------------------------------------------------
  // Render
  // ------------------------------------------------------------------

  return (
    <div className="flex flex-col h-full">
      <TopBar
        title="Repurpose"
        actions={
          hasTextVariants ? (
            <button
              onClick={handleApproveAll}
              className="px-3 py-1.5 text-sm bg-[#7C3AED] hover:bg-[#6D28D9] text-white rounded-lg transition-colors"
            >
              Approve all
            </button>
          ) : undefined
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
              onTriggerRepurpose={handleTriggerRepurpose}
              onTriggerImages={handleTriggerImages}
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
            />
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
                onRefresh={handleRefresh}
              />
            ))}

          {!activePost && !isLoading && (
            <div className="flex items-center justify-center h-64">
              <p className="text-[#888888]">No post loaded.</p>
            </div>
          )}
        </div>

        {/* ── Column 3 — AI chat sidebar (stubbed — filled in Session 7) ── */}
        <div className="w-[280px] flex-shrink-0 border-l border-[#2A2A2A] flex flex-col">
          <div className="p-4 border-b border-[#2A2A2A]">
            <h3 className="text-sm font-medium text-[#F5F5F5]">AI Assistant</h3>
            <p className="text-xs text-[#555555] mt-0.5">Chat + hashtag suggestions</p>
          </div>
          <div className="flex-1 flex items-center justify-center p-4">
            {generationStatus === "generating_text" ? (
              <p className="text-sm text-[#555555] text-center leading-relaxed">
                Waiting for text generation to complete...
              </p>
            ) : (
              <p className="text-sm text-[#555555] text-center leading-relaxed">
                AI chat will be wired up in Session 7.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
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
