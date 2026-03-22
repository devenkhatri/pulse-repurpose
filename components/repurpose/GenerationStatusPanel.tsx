"use client"

import { useEffect, useState } from "react"
import { Loader2, CheckCircle2, XCircle, Circle } from "lucide-react"
import { PlatformIcon } from "@/components/shared/PlatformIcon"
import { cn } from "@/lib/utils"
import type { GenerationStatus, Platform, LinkedInPost } from "@/types"

interface GenerationStatusPanelProps {
  generationStatus: GenerationStatus
  imageGenerationStatus: GenerationStatus
  selectedPlatforms: Platform[]
  activePost: LinkedInPost | null
}

function useElapsedTime(isRunning: boolean): string {
  const [seconds, setSeconds] = useState(0)

  useEffect(() => {
    if (!isRunning) {
      setSeconds(0)
      return
    }
    const start = Date.now()
    const interval = setInterval(() => {
      setSeconds(Math.floor((Date.now() - start) / 1000))
    }, 1000)
    return () => clearInterval(interval)
  }, [isRunning])

  if (!isRunning) return ""
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return m > 0 ? `${m}m ${s}s` : `${s}s`
}

interface StatusRowProps {
  label: string
  sublabel: string
  status: GenerationStatus
  elapsedTime: string
}

function StatusRow({ label, sublabel, status, elapsedTime }: StatusRowProps) {
  const isRunning = status === "generating_text" || status === "generating_images"
  const isDone = status === "done"
  const isFailed = status === "failed"

  return (
    <div className="flex items-center gap-3">
      <div className="flex-shrink-0">
        {isRunning && (
          <Loader2 className="w-4 h-4 text-[#7C3AED] animate-spin" />
        )}
        {isDone && (
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
        )}
        {isFailed && (
          <XCircle className="w-4 h-4 text-red-400" />
        )}
        {status === "idle" && (
          <div className="w-4 h-4 rounded-full border border-[#2A2A2A]" />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p
          className={cn(
            "text-sm font-medium",
            isRunning && "text-[#F5F5F5]",
            isDone && "text-emerald-400",
            isFailed && "text-red-400",
            status === "idle" && "text-[#555555]"
          )}
        >
          {label}
        </p>
        <p className="text-xs text-[#555555]">{sublabel}</p>
      </div>
      {elapsedTime && (
        <span className="text-xs text-[#555555] flex-shrink-0">{elapsedTime}</span>
      )}
    </div>
  )
}

interface PlatformProgressRowProps {
  platform: Platform
  hasText: boolean
  hasImage: boolean
  isGeneratingText: boolean
  isGeneratingImages: boolean
}

function PlatformProgressRow({
  platform,
  hasText,
  hasImage,
  isGeneratingText,
  isGeneratingImages,
}: PlatformProgressRowProps) {
  return (
    <div className="flex items-center gap-2 py-0.5">
      <PlatformIcon platform={platform} size="sm" />
      <span className="text-xs text-[#888888] flex-1 capitalize">{platform}</span>
      {/* Text status */}
      <div className="flex items-center gap-1" title="Text">
        {hasText ? (
          <CheckCircle2 className="w-3 h-3 text-emerald-400" />
        ) : isGeneratingText ? (
          <Loader2 className="w-3 h-3 text-[#7C3AED] animate-spin" />
        ) : (
          <Circle className="w-3 h-3 text-[#333333]" />
        )}
        <span className="text-[10px] text-[#555555]">text</span>
      </div>
      {/* Image status */}
      <div className="flex items-center gap-1" title="Image">
        {hasImage ? (
          <CheckCircle2 className="w-3 h-3 text-emerald-400" />
        ) : isGeneratingImages ? (
          <Loader2 className="w-3 h-3 text-[#7C3AED] animate-spin" />
        ) : (
          <Circle className="w-3 h-3 text-[#333333]" />
        )}
        <span className="text-[10px] text-[#555555]">img</span>
      </div>
    </div>
  )
}

export function GenerationStatusPanel({
  generationStatus,
  imageGenerationStatus,
  selectedPlatforms,
  activePost,
}: GenerationStatusPanelProps) {
  const textElapsed = useElapsedTime(generationStatus === "generating_text")
  const imageElapsed = useElapsedTime(imageGenerationStatus === "generating_images")

  const isGeneratingText = generationStatus === "generating_text"
  const isGeneratingImages = imageGenerationStatus === "generating_images"

  // Per-platform progress
  const completedText = selectedPlatforms.filter(
    (p) => activePost?.platforms[p]?.text
  ).length
  const completedImages = selectedPlatforms.filter(
    (p) => activePost?.platforms[p]?.imageUrl
  ).length
  const total = selectedPlatforms.length

  return (
    <div className="bg-[#161616] border border-[#2A2A2A] rounded-xl p-4 space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium text-[#888888] uppercase tracking-wider">
          Generation Progress
        </p>
        {total > 0 && (isGeneratingText || isGeneratingImages) && (
          <p className="text-xs text-[#555555]">
            {isGeneratingText
              ? `${completedText}/${total} platforms`
              : `${completedImages}/${total} images`}
          </p>
        )}
      </div>

      <StatusRow
        label="Text generation"
        sublabel="n8n is generating platform variants via Claude..."
        status={generationStatus}
        elapsedTime={textElapsed}
      />
      <div className="border-t border-[#2A2A2A]" />
      <StatusRow
        label="Image generation"
        sublabel="n8n is generating images via fal.ai..."
        status={imageGenerationStatus}
        elapsedTime={imageElapsed}
      />

      {/* Per-platform breakdown */}
      {selectedPlatforms.length > 0 && (isGeneratingText || isGeneratingImages) && (
        <>
          <div className="border-t border-[#2A2A2A]" />
          <div className="space-y-1">
            {selectedPlatforms.map((platform) => (
              <PlatformProgressRow
                key={platform}
                platform={platform}
                hasText={!!activePost?.platforms[platform]?.text}
                hasImage={!!activePost?.platforms[platform]?.imageUrl}
                isGeneratingText={isGeneratingText}
                isGeneratingImages={isGeneratingImages}
              />
            ))}
          </div>
        </>
      )}
    </div>
  )
}
