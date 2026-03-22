"use client"

import { useState } from "react"
import { toast } from "sonner"
import { Copy, X, Plus, Trash2 } from "lucide-react"
import { cn } from "@/lib/utils"
import type { CarouselPromptOutput, CarouselSlide } from "@/types"

interface CarouselPreviewProps {
  carousel: CarouselPromptOutput
  onChange: (updated: CarouselPromptOutput) => void
}

// ---------------------------------------------------------------------------
// Individual slide card — inline editable
// ---------------------------------------------------------------------------

interface SlideCardProps {
  index: number
  headline: string
  body: string
  label: string
  accent?: boolean
  onChangeHeadline: (val: string) => void
  onChangeBody: (val: string) => void
  onDelete?: () => void
}

function SlideCard({
  index,
  headline,
  body,
  label,
  accent = false,
  onChangeHeadline,
  onChangeBody,
  onDelete,
}: SlideCardProps) {
  return (
    <div
      className={cn(
        "relative bg-[#161616] border rounded-xl p-4 space-y-2 group",
        accent ? "border-[#7C3AED]/40" : "border-[#2A2A2A]"
      )}
    >
      {/* Slide label + delete */}
      <div className="flex items-center justify-between">
        <span
          className={cn(
            "text-[10px] uppercase tracking-wider font-medium",
            accent ? "text-[#A78BFA]" : "text-[#555555]"
          )}
        >
          {label}
          {typeof index === "number" && !accent && (
            <span className="ml-1 text-[#444444]">#{index + 1}</span>
          )}
        </span>
        {onDelete && (
          <button
            onClick={onDelete}
            className="opacity-0 group-hover:opacity-100 text-[#555555] hover:text-red-400 transition-all"
            aria-label="Delete slide"
          >
            <Trash2 className="w-3 h-3" />
          </button>
        )}
      </div>

      {/* Headline */}
      <input
        type="text"
        value={headline}
        onChange={(e) => onChangeHeadline(e.target.value)}
        placeholder="Slide headline…"
        className="w-full bg-[#111111] border border-[#2A2A2A] focus:border-[#7C3AED] rounded-lg px-3 py-1.5 text-sm font-semibold text-[#F5F5F5] outline-none focus:ring-1 focus:ring-[#7C3AED]/30 transition-colors"
      />

      {/* Body */}
      <textarea
        value={body}
        onChange={(e) => onChangeBody(e.target.value)}
        placeholder="Slide body (1–3 sentences)…"
        rows={3}
        className="w-full bg-[#111111] border border-[#2A2A2A] focus:border-[#7C3AED] rounded-lg px-3 py-2 text-xs text-[#CCCCCC] leading-relaxed outline-none focus:ring-1 focus:ring-[#7C3AED]/30 resize-none transition-colors"
      />
    </div>
  )
}

// ---------------------------------------------------------------------------
// CarouselPreview
// ---------------------------------------------------------------------------

export function CarouselPreview({ carousel, onChange }: CarouselPreviewProps) {
  const [newHashtag, setNewHashtag] = useState("")

  // ---- Cover slide changes ----
  const updateCover = (field: "headline" | "subheadline", val: string) => {
    onChange({ ...carousel, coverSlide: { ...carousel.coverSlide, [field]: val } })
  }

  // ---- Content slide changes ----
  const updateSlide = (i: number, field: keyof CarouselSlide, val: string) => {
    const slides = carousel.slides.map((s, idx) => idx === i ? { ...s, [field]: val } : s)
    onChange({ ...carousel, slides })
  }

  const deleteSlide = (i: number) => {
    if (carousel.slides.length <= 1) return
    onChange({ ...carousel, slides: carousel.slides.filter((_, idx) => idx !== i) })
  }

  const addSlide = () => {
    onChange({
      ...carousel,
      slides: [...carousel.slides, { headline: "", body: "" }],
    })
  }

  // ---- Closing slide changes ----
  const updateClosing = (field: "headline" | "cta", val: string) => {
    onChange({ ...carousel, closingSlide: { ...carousel.closingSlide, [field]: val } })
  }

  // ---- Caption + hashtags ----
  const updateCaption = (val: string) => onChange({ ...carousel, caption: val })

  const removeHashtag = (tag: string) => {
    onChange({ ...carousel, hashtags: carousel.hashtags.filter((h) => h !== tag) })
  }

  const addHashtag = () => {
    const tag = newHashtag.trim().replace(/^#/, "")
    if (!tag || carousel.hashtags.includes(tag)) { setNewHashtag(""); return }
    onChange({ ...carousel, hashtags: [...carousel.hashtags, tag] })
    setNewHashtag("")
  }

  // ---- Export helpers ----
  const copyAsJson = () => {
    navigator.clipboard.writeText(JSON.stringify(carousel, null, 2))
    toast.success("Copied carousel JSON")
  }

  const copySlideTexts = () => {
    const lines: string[] = []
    lines.push(`[COVER] ${carousel.coverSlide.headline}`)
    lines.push(carousel.coverSlide.subheadline)
    lines.push("")
    carousel.slides.forEach((s, i) => {
      lines.push(`[SLIDE ${i + 1}] ${s.headline}`)
      lines.push(s.body)
      lines.push("")
    })
    lines.push(`[CLOSING] ${carousel.closingSlide.headline}`)
    lines.push(carousel.closingSlide.cta)
    lines.push("")
    lines.push(`[CAPTION]`)
    lines.push(carousel.caption)
    if (carousel.hashtags.length) lines.push(carousel.hashtags.map((h) => `#${h}`).join(" "))
    navigator.clipboard.writeText(lines.join("\n"))
    toast.success("Copied slide texts")
  }

  const totalSlides = 1 + carousel.slides.length + 1 // cover + content + closing

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-[#F5F5F5]">LinkedIn Carousel</h3>
          <p className="text-xs text-[#555555]">{totalSlides} slides total</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={copySlideTexts}
            className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs bg-[#1C1C1C] hover:bg-[#222222] border border-[#2A2A2A] text-[#888888] hover:text-[#F5F5F5] rounded-lg transition-colors"
          >
            <Copy className="w-3 h-3" />
            Copy slide texts
          </button>
          <button
            onClick={copyAsJson}
            className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs bg-[#1C1C1C] hover:bg-[#222222] border border-[#2A2A2A] text-[#888888] hover:text-[#F5F5F5] rounded-lg transition-colors"
          >
            <Copy className="w-3 h-3" />
            Copy as JSON
          </button>
        </div>
      </div>

      {/* Cover slide */}
      <SlideCard
        index={-1}
        label="Cover"
        headline={carousel.coverSlide.headline}
        body={carousel.coverSlide.subheadline}
        accent
        onChangeHeadline={(v) => updateCover("headline", v)}
        onChangeBody={(v) => updateCover("subheadline", v)}
      />

      {/* Content slides */}
      {carousel.slides.map((slide, i) => (
        <SlideCard
          key={i}
          index={i}
          label="Slide"
          headline={slide.headline}
          body={slide.body}
          onChangeHeadline={(v) => updateSlide(i, "headline", v)}
          onChangeBody={(v) => updateSlide(i, "body", v)}
          onDelete={carousel.slides.length > 1 ? () => deleteSlide(i) : undefined}
        />
      ))}

      {/* Add slide button */}
      <button
        onClick={addSlide}
        className="w-full flex items-center justify-center gap-2 py-2 text-xs text-[#555555] hover:text-[#888888] border border-dashed border-[#2A2A2A] hover:border-[#3A3A3A] rounded-xl transition-colors"
      >
        <Plus className="w-3 h-3" />
        Add slide
      </button>

      {/* Closing slide */}
      <SlideCard
        index={-1}
        label="Closing"
        headline={carousel.closingSlide.headline}
        body={carousel.closingSlide.cta}
        accent
        onChangeHeadline={(v) => updateClosing("headline", v)}
        onChangeBody={(v) => updateClosing("cta", v)}
      />

      {/* Caption */}
      <div className="space-y-1.5">
        <p className="text-xs text-[#555555] uppercase tracking-wider">Caption</p>
        <textarea
          value={carousel.caption}
          onChange={(e) => updateCaption(e.target.value)}
          rows={4}
          className="w-full bg-[#111111] border border-[#2A2A2A] focus:border-[#7C3AED] rounded-xl px-3 py-2 text-sm text-[#F5F5F5] leading-relaxed outline-none focus:ring-1 focus:ring-[#7C3AED]/30 resize-none transition-colors"
        />
        <p className="text-xs text-[#555555] text-right tabular-nums">
          {carousel.caption.length} chars
        </p>
      </div>

      {/* Hashtags */}
      <div className="space-y-2">
        <p className="text-xs text-[#555555] uppercase tracking-wider">
          Hashtags ({carousel.hashtags.length}/5)
        </p>
        <div className="flex flex-wrap gap-1.5">
          {carousel.hashtags.map((tag) => (
            <span
              key={tag}
              className="inline-flex items-center gap-1 text-xs bg-[#7C3AED]/20 text-[#A78BFA] px-2 py-0.5 rounded-full"
            >
              #{tag}
              <button
                onClick={() => removeHashtag(tag)}
                className="hover:text-red-400 transition-colors"
                aria-label={`Remove #${tag}`}
              >
                <X className="w-2.5 h-2.5" />
              </button>
            </span>
          ))}
          {carousel.hashtags.length < 5 && (
            <div className="flex items-center gap-1">
              <input
                value={newHashtag}
                onChange={(e) => setNewHashtag(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && addHashtag()}
                placeholder="add tag"
                className="text-xs bg-[#111111] border border-[#2A2A2A] rounded-full px-2 py-0.5 text-[#888888] w-20 outline-none focus:border-[#7C3AED]"
              />
              <button onClick={addHashtag} className="text-xs text-[#7C3AED] hover:text-[#A78BFA]">
                +
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
