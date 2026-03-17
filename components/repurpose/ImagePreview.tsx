"use client"

import Image from "next/image"

interface ImagePreviewProps {
  imageUrl: string | null
  isGenerating: boolean
  platform: string
  onRegenerate?: () => void
}

export function ImagePreview({
  imageUrl,
  isGenerating,
  platform,
  onRegenerate,
}: ImagePreviewProps) {
  if (isGenerating) {
    return (
      <div className="rounded-lg overflow-hidden bg-[#1C1C1C] border border-[#2A2A2A]">
        <div className="aspect-video animate-pulse bg-[#222222] flex items-center justify-center">
          <p className="text-xs text-[#555555]">Generating image via fal.ai...</p>
        </div>
      </div>
    )
  }

  if (!imageUrl) {
    return (
      <div className="rounded-lg overflow-hidden bg-[#1C1C1C] border border-[#2A2A2A]">
        <div className="aspect-video flex items-center justify-center">
          <p className="text-xs text-[#555555]">No image generated yet</p>
        </div>
      </div>
    )
  }

  return (
    <div className="rounded-lg overflow-hidden bg-[#1C1C1C] border border-[#2A2A2A] group relative">
      <div className="aspect-video relative">
        <Image
          src={imageUrl}
          alt={`${platform} generated image`}
          fill
          className="object-cover"
          unoptimized
        />
      </div>
      {onRegenerate && (
        <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
          <button
            onClick={onRegenerate}
            className="px-3 py-1.5 text-xs bg-[#7C3AED] hover:bg-[#6D28D9] text-white rounded-lg transition-colors"
          >
            Regenerate image
          </button>
        </div>
      )}
      <p className="text-[10px] text-[#555555] px-2 py-1">
        Note: fal.ai URLs may expire after 24 hours.
      </p>
    </div>
  )
}
