"use client"

import Image from "next/image"
import type { Platform } from "@/types"

interface PostPreviewProps {
  platform: Platform
  text: string
  hashtags: string[]
  imageUrl: string | null
}

// ---------------------------------------------------------------------------
// Shared avatar placeholder
// ---------------------------------------------------------------------------

function Avatar({ size = 36 }: { size?: number }) {
  return (
    <div
      style={{ width: size, height: size }}
      className="rounded-full bg-gradient-to-br from-[#7C3AED] to-[#A78BFA] flex-shrink-0"
    />
  )
}

// ---------------------------------------------------------------------------
// Twitter / X preview — 16:9 image, hashtags inline, character cap
// ---------------------------------------------------------------------------

function TwitterPreview({ text, hashtags, imageUrl }: Omit<PostPreviewProps, "platform">) {
  const inlineHashtags = hashtags.map((h) => `#${h}`).join(" ")
  const body = inlineHashtags ? `${text}\n\n${inlineHashtags}` : text

  return (
    <div className="bg-black rounded-xl border border-[#2F3336] p-4 space-y-3 font-sans">
      {/* Header */}
      <div className="flex items-start gap-3">
        <Avatar size={40} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="text-[15px] font-bold text-white leading-none">Your Name</span>
            <span className="text-[13px] text-[#71767B] leading-none">@yourhandle</span>
          </div>
          <p className="text-[15px] text-white mt-2 leading-[1.5] whitespace-pre-wrap break-words">
            {body}
          </p>
        </div>
      </div>

      {/* Image 16:9 */}
      {imageUrl && (
        <div className="rounded-2xl overflow-hidden border border-[#2F3336] aspect-video relative">
          <Image src={imageUrl} alt="Twitter preview" fill className="object-cover" unoptimized />
        </div>
      )}

      {/* Engagement bar */}
      <div className="flex items-center gap-5 pt-1 text-[13px] text-[#71767B]">
        <span>💬 0</span>
        <span>🔁 0</span>
        <span>❤️ 0</span>
        <span>📊 0</span>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Threads preview — 1:1 image, conversational bubble
// ---------------------------------------------------------------------------

function ThreadsPreview({ text, hashtags, imageUrl }: Omit<PostPreviewProps, "platform">) {
  const inlineHashtags = hashtags.map((h) => `#${h}`).join(" ")

  return (
    <div className="bg-black rounded-xl border border-[#2A2A2A] p-4 font-sans">
      <div className="flex gap-3">
        {/* Left: avatar + thread line */}
        <div className="flex flex-col items-center gap-0">
          <Avatar size={36} />
          <div className="w-px flex-1 bg-[#333333] mt-1 min-h-[24px]" />
        </div>

        {/* Right: content */}
        <div className="flex-1 min-w-0 pb-3">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[15px] font-semibold text-white">yourhandle</span>
          </div>
          <p className="text-[15px] text-white leading-[1.5] whitespace-pre-wrap break-words">
            {text}
          </p>
          {inlineHashtags && (
            <p className="text-[15px] text-[#0095F6] mt-1">{inlineHashtags}</p>
          )}
          {imageUrl && (
            <div className="mt-3 rounded-xl overflow-hidden border border-[#2A2A2A] aspect-square relative max-w-[280px]">
              <Image src={imageUrl} alt="Threads preview" fill className="object-cover" unoptimized />
            </div>
          )}
          <p className="text-[12px] text-[#555555] mt-2">Just now</p>
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Instagram preview — 1:1 image, hashtags below caption
// ---------------------------------------------------------------------------

function InstagramPreview({ text, hashtags, imageUrl }: Omit<PostPreviewProps, "platform">) {
  const CAPTION_CUTOFF = 125
  const showMore = text.length > CAPTION_CUTOFF
  const captionPreview = showMore ? text.slice(0, CAPTION_CUTOFF) + "… " : text

  return (
    <div className="bg-black rounded-xl border border-[#262626] font-sans overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 px-3 py-2.5">
        <div className="rounded-full p-0.5 bg-gradient-to-tr from-yellow-400 via-pink-500 to-purple-600">
          <div className="rounded-full bg-black p-0.5">
            <Avatar size={28} />
          </div>
        </div>
        <span className="text-[13px] font-semibold text-white">yourhandle</span>
        <span className="ml-auto text-[13px] text-[#A8A8A8]">···</span>
      </div>

      {/* Square image */}
      {imageUrl ? (
        <div className="aspect-square relative w-full">
          <Image src={imageUrl} alt="Instagram preview" fill className="object-cover" unoptimized />
        </div>
      ) : (
        <div className="aspect-square bg-[#1C1C1C] flex items-center justify-center">
          <span className="text-xs text-[#555555]">No image</span>
        </div>
      )}

      {/* Actions */}
      <div className="px-3 pt-2 pb-1 flex gap-3 text-xl">
        <span>♡</span><span>💬</span><span>✈︎</span>
        <span className="ml-auto">🔖</span>
      </div>

      {/* Caption */}
      <div className="px-3 pb-3 text-[13px] text-white">
        <span className="font-semibold mr-1">yourhandle</span>
        <span className="leading-relaxed">{captionPreview}</span>
        {showMore && <button className="text-[#A8A8A8]">more</button>}
        {hashtags.length > 0 && (
          <p className="text-[#0095F6] mt-1">
            {hashtags.map((h) => `#${h}`).join(" ")}
          </p>
        )}
        <p className="text-[#A8A8A8] text-[11px] mt-1 uppercase tracking-wide">Just now</p>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Facebook preview — 16:9 image, post header
// ---------------------------------------------------------------------------

function FacebookPreview({ text, hashtags, imageUrl }: Omit<PostPreviewProps, "platform">) {
  const inlineHashtags = hashtags.map((h) => `#${h}`).join(" ")

  return (
    <div className="bg-[#1C1E21] rounded-xl border border-[#3A3B3C] font-sans overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2.5 px-4 pt-3 pb-2">
        <Avatar size={40} />
        <div>
          <p className="text-[14px] font-semibold text-white leading-none">Your Name</p>
          <p className="text-[12px] text-[#B0B3B8] mt-0.5">Just now · 🌐</p>
        </div>
        <span className="ml-auto text-[#B0B3B8]">···</span>
      </div>

      {/* Text */}
      <div className="px-4 pb-2 text-[14px] text-white leading-relaxed whitespace-pre-wrap break-words">
        {text}
        {inlineHashtags && (
          <span className="text-[#2D88FF]"> {inlineHashtags}</span>
        )}
      </div>

      {/* Image 16:9 */}
      {imageUrl && (
        <div className="aspect-video relative w-full">
          <Image src={imageUrl} alt="Facebook preview" fill className="object-cover" unoptimized />
        </div>
      )}

      {/* Engagement */}
      <div className="px-4 py-2 border-t border-[#3A3B3C] flex gap-4 text-[13px] text-[#B0B3B8]">
        <button>👍 Like</button>
        <button>💬 Comment</button>
        <button>↗ Share</button>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// LinkedIn preview — 1.91:1 image, professional header
// ---------------------------------------------------------------------------

function LinkedInPreview({ text, hashtags, imageUrl }: Omit<PostPreviewProps, "platform">) {
  const CAPTION_CUTOFF = 200
  const showMore = text.length > CAPTION_CUTOFF
  const captionPreview = showMore ? text.slice(0, CAPTION_CUTOFF) + "…" : text
  const inlineHashtags = hashtags.map((h) => `#${h}`).join(" ")

  return (
    <div className="bg-[#1B1F23] rounded-xl border border-[#3A3A3A] font-sans overflow-hidden">
      {/* Header */}
      <div className="flex items-start gap-3 px-4 pt-4 pb-3">
        <Avatar size={48} />
        <div className="flex-1">
          <p className="text-[14px] font-semibold text-white leading-tight">Your Name</p>
          <p className="text-[12px] text-[#A0A0A0] leading-tight mt-0.5">Your title · 1st</p>
          <p className="text-[12px] text-[#A0A0A0] leading-tight">Just now · 🌐</p>
        </div>
        <button className="text-[#70B5F9] text-[13px] font-semibold border border-[#70B5F9] px-3 py-1 rounded-full hover:bg-[#70B5F9]/10 transition-colors">
          + Follow
        </button>
      </div>

      {/* Text */}
      <div className="px-4 pb-3 text-[14px] text-white leading-relaxed whitespace-pre-wrap break-words">
        {captionPreview}
        {showMore && <button className="text-[#70B5F9] ml-1">...see more</button>}
      </div>

      {/* Hashtags */}
      {inlineHashtags && (
        <p className="px-4 pb-3 text-[13px] text-[#70B5F9]">{inlineHashtags}</p>
      )}

      {/* Image ~1.91:1 */}
      {imageUrl && (
        <div className="relative w-full" style={{ aspectRatio: "1.91 / 1" }}>
          <Image src={imageUrl} alt="LinkedIn preview" fill className="object-cover" unoptimized />
        </div>
      )}

      {/* Engagement */}
      <div className="px-4 py-2 border-t border-[#3A3A3A] flex gap-3 text-[13px] text-[#A0A0A0]">
        <button>👍 Like</button>
        <button>💬 Comment</button>
        <button>🔁 Repost</button>
        <button>✉️ Send</button>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Skool preview — simple community post card, no hashtags
// ---------------------------------------------------------------------------

function SkoolPreview({ text, imageUrl }: Omit<PostPreviewProps, "platform" | "hashtags">) {
  return (
    <div className="bg-[#111111] rounded-xl border border-[#2A2A2A] font-sans overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 pt-4 pb-3">
        <Avatar size={40} />
        <div>
          <p className="text-[14px] font-semibold text-white">Your Name</p>
          <p className="text-[12px] text-[#888888]">Just now · Community Post</p>
        </div>
      </div>

      {/* Text */}
      <div className="px-4 pb-3 text-[14px] text-white leading-relaxed whitespace-pre-wrap break-words">
        {text}
      </div>

      {/* Image 16:9 */}
      {imageUrl && (
        <div className="aspect-video relative w-full">
          <Image src={imageUrl} alt="Skool preview" fill className="object-cover" unoptimized />
        </div>
      )}

      {/* Engagement */}
      <div className="px-4 py-2 border-t border-[#2A2A2A] flex gap-4 text-[13px] text-[#888888]">
        <button>❤️ Like</button>
        <button>💬 Comment</button>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

export function PostPreview({ platform, text, hashtags, imageUrl }: PostPreviewProps) {
  if (!text) {
    return (
      <div className="flex items-center justify-center h-24 rounded-xl border border-[#2A2A2A] bg-[#111111]">
        <p className="text-xs text-[#555555]">No text to preview yet</p>
      </div>
    )
  }

  switch (platform) {
    case "twitter":
      return <TwitterPreview text={text} hashtags={hashtags} imageUrl={imageUrl} />
    case "threads":
      return <ThreadsPreview text={text} hashtags={hashtags} imageUrl={imageUrl} />
    case "instagram":
      return <InstagramPreview text={text} hashtags={hashtags} imageUrl={imageUrl} />
    case "facebook":
      return <FacebookPreview text={text} hashtags={hashtags} imageUrl={imageUrl} />
    case "linkedin":
      return <LinkedInPreview text={text} hashtags={hashtags} imageUrl={imageUrl} />
    case "skool":
      return <SkoolPreview text={text} imageUrl={imageUrl} />
    default:
      return null
  }
}
