"use client"

import Image from "next/image"
import { format } from "date-fns"
import { RefreshCw, ImageIcon, X, Layers } from "lucide-react"
import { useRepurposeStore } from "@/stores/repurposeStore"
import { cn } from "@/lib/utils"
import type { LinkedInPost, Platform, GenerationStatus } from "@/types"

const ALL_PLATFORMS: Platform[] = ["twitter", "threads", "instagram", "facebook", "skool"]

const PLATFORM_LABELS: Record<Platform, string> = {
  twitter: "Twitter / X",
  threads: "Threads",
  instagram: "Instagram",
  facebook: "Facebook",
  skool: "Skool",
  linkedin: "LinkedIn",
}

interface SourcePostPanelProps {
  post: LinkedInPost
  generationStatus: GenerationStatus
  imageGenerationStatus: GenerationStatus
  selectedPlatforms: Platform[]
  hasTextVariants: boolean
  carouselEnabled: boolean
  carouselGenerating: boolean
  onTriggerRepurpose: () => void
  onTriggerImages: () => void
  onAbortText: () => void
  onAbortImages: () => void
  onToggleCarousel: () => void
}

export function SourcePostPanel({
  post,
  generationStatus,
  imageGenerationStatus,
  selectedPlatforms,
  hasTextVariants,
  carouselEnabled,
  carouselGenerating,
  onTriggerRepurpose,
  onTriggerImages,
  onAbortText,
  onAbortImages,
  onToggleCarousel,
}: SourcePostPanelProps) {
  const { setSelectedPlatforms } = useRepurposeStore()

  const isTextGenerating = generationStatus === "generating_text"
  const isImageGenerating = imageGenerationStatus === "generating_images"
  const isGenerating = isTextGenerating || isImageGenerating

  const togglePlatform = (platform: Platform) => {
    if (selectedPlatforms.includes(platform)) {
      if (selectedPlatforms.length === 1) return // keep at least one
      setSelectedPlatforms(selectedPlatforms.filter((p) => p !== platform))
    } else {
      setSelectedPlatforms([...selectedPlatforms, platform])
    }
  }

  const textStatus =
    isTextGenerating
      ? "Generating..."
      : generationStatus === "done"
      ? "Done ✓"
      : generationStatus === "failed"
      ? "Failed"
      : hasTextVariants
      ? "Done ✓"
      : "Idle"

  const imageStatus =
    isImageGenerating
      ? "Generating..."
      : imageGenerationStatus === "done"
      ? "Done ✓"
      : imageGenerationStatus === "failed"
      ? "Failed"
      : "Idle"

  return (
    <div className="p-4 space-y-4">
      {/* Post date */}
      <p className="text-xs text-[#555555]">
        {format(new Date(post.postedAt), "MMM d, yyyy")}
      </p>

      {/* LinkedIn post text */}
      <div className="bg-[#111111] border border-[#2A2A2A] rounded-xl p-3">
        <p className="text-xs font-medium text-[#888888] mb-2 uppercase tracking-wider">
          Original LinkedIn Post
        </p>
        <p className="text-sm text-[#F5F5F5] leading-relaxed whitespace-pre-wrap">
          {post.linkedinText}
        </p>
      </div>

      {/* Original image */}
      {post.linkedinImageUrl && (
        <div className="rounded-xl overflow-hidden border border-[#2A2A2A]">
          <div className="aspect-video relative">
            <Image
              src={post.linkedinImageUrl}
              alt="LinkedIn post image"
              fill
              className="object-cover"
              unoptimized
            />
          </div>
        </div>
      )}

      {/* Platform checklist */}
      <div className="space-y-1.5">
        <p className="text-xs font-medium text-[#888888] uppercase tracking-wider">
          Platforms
        </p>
        {ALL_PLATFORMS.map((platform) => (
          <label
            key={platform}
            className="flex items-center gap-2 cursor-pointer group"
          >
            <input
              type="checkbox"
              checked={selectedPlatforms.includes(platform)}
              onChange={() => togglePlatform(platform)}
              className="w-3.5 h-3.5 accent-[#7C3AED]"
            />
            <span className="text-sm text-[#888888] group-hover:text-[#F5F5F5] transition-colors">
              {PLATFORM_LABELS[platform]}
            </span>
          </label>
        ))}
      </div>

      {/* Status indicators */}
      <div className="space-y-1">
        <div className="flex items-center justify-between text-xs">
          <span className="text-[#555555]">Text</span>
          <span
            className={cn(
              isTextGenerating && "text-[#7C3AED]",
              textStatus === "Done ✓" && "text-emerald-400",
              textStatus === "Failed" && "text-red-400",
              textStatus === "Idle" && "text-[#555555]"
            )}
          >
            {textStatus}
          </span>
        </div>
        <div className="flex items-center justify-between text-xs">
          <span className="text-[#555555]">Images</span>
          <span
            className={cn(
              isImageGenerating && "text-[#7C3AED]",
              imageStatus === "Done ✓" && "text-emerald-400",
              imageStatus === "Failed" && "text-red-400",
              imageStatus === "Idle" && "text-[#555555]"
            )}
          >
            {imageStatus}
          </span>
        </div>
      </div>

      {/* Action buttons */}
      <div className="space-y-2 pt-1">
        {isTextGenerating ? (
          <button
            onClick={onAbortText}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 text-sm bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 text-red-400 rounded-lg transition-colors"
          >
            <X className="w-3.5 h-3.5" />
            Abort text generation
          </button>
        ) : (
          <button
            onClick={() => onTriggerRepurpose()}
            disabled={isImageGenerating}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 text-sm bg-[#7C3AED] hover:bg-[#6D28D9] text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            {hasTextVariants ? "Re-generate text" : "Repurpose text"}
          </button>
        )}

        {isImageGenerating ? (
          <button
            onClick={onAbortImages}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 text-sm bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 text-red-400 rounded-lg transition-colors"
          >
            <X className="w-3.5 h-3.5" />
            Abort image generation
          </button>
        ) : (
          <button
            onClick={onTriggerImages}
            disabled={!hasTextVariants || isTextGenerating}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 text-sm bg-[#1C1C1C] hover:bg-[#222222] border border-[#2A2A2A] text-[#F5F5F5] rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            title={!hasTextVariants ? "Generate text first" : "Generate images via fal.ai"}
          >
            <ImageIcon className="w-3.5 h-3.5" />
            Generate images
          </button>
        )}

        {/* LinkedIn Carousel toggle */}
        <button
          onClick={onToggleCarousel}
          disabled={carouselGenerating}
          className={cn(
            "w-full flex items-center justify-center gap-2 px-3 py-2 text-sm border rounded-lg transition-colors",
            carouselEnabled
              ? "bg-[#7C3AED]/15 border-[#7C3AED]/40 text-[#A78BFA] hover:bg-[#7C3AED]/25"
              : "bg-[#1C1C1C] hover:bg-[#222222] border-[#2A2A2A] text-[#888888] hover:text-[#F5F5F5]",
            carouselGenerating && "opacity-60 cursor-not-allowed"
          )}
        >
          <Layers className="w-3.5 h-3.5" />
          {carouselGenerating
            ? "Generating carousel…"
            : carouselEnabled
            ? "Carousel on"
            : "LinkedIn Carousel"}
        </button>
      </div>
    </div>
  )
}
