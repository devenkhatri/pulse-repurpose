"use client"

import { useState, useEffect, useCallback, KeyboardEvent } from "react"
import { toast } from "sonner"
import { Save, AlertCircle, Plus, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { ExamplePostsInput } from "./ExamplePostsInput"
import { AvoidListInput } from "./AvoidListInput"
import { TopicPillarsInput } from "./TopicPillarsInput"
import type { BrandVoiceProfile, ImageBrandKit } from "@/types"

const VISUAL_STYLE_OPTIONS = [
  "minimalist",
  "bold",
  "editorial",
  "cinematic",
  "documentary",
  "abstract",
  "geometric",
  "organic",
]

const PHOTOGRAPHY_STYLE_OPTIONS = [
  "product",
  "lifestyle",
  "portrait",
  "landscape",
  "abstract",
  "candid",
  "conceptual",
  "flat-lay",
]

const DEFAULT_IMAGE_BRAND_KIT: ImageBrandKit = {
  primaryColor: "#7C3AED",
  secondaryColor: "#A78BFA",
  visualStyle: [],
  photographyStyle: [],
  moodKeywords: [],
  avoidInImages: [],
}

// ---------------------------------------------------------------------------
// Tag input helper
// ---------------------------------------------------------------------------

function TagInput({
  label,
  tags,
  placeholder,
  onChange,
}: {
  label: string
  tags: string[]
  placeholder: string
  onChange: (tags: string[]) => void
}) {
  const [input, setInput] = useState("")

  const add = () => {
    const val = input.trim()
    if (!val || tags.includes(val)) { setInput(""); return }
    onChange([...tags, val])
    setInput("")
  }

  return (
    <div className="space-y-2">
      <Label className="text-white/70 text-sm">{label}</Label>
      <div className="flex flex-wrap gap-1.5 p-2.5 rounded-md border border-white/10 bg-[#161616] min-h-[42px]">
        {tags.map((tag) => (
          <span
            key={tag}
            className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-[#7C3AED]/20 text-[#a78bfa] text-xs font-medium"
          >
            {tag}
            <button
              type="button"
              onClick={() => onChange(tags.filter((t) => t !== tag))}
              className="hover:text-white ml-0.5"
            >
              <X className="w-2.5 h-2.5" />
            </button>
          </span>
        ))}
        <div className="flex items-center gap-1 flex-1 min-w-[120px]">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); add() } }}
            placeholder={placeholder}
            className="border-none bg-transparent h-5 p-0 text-sm text-white placeholder:text-white/20 focus-visible:ring-0 flex-1"
          />
          {input && (
            <button type="button" onClick={add} className="text-[#7C3AED] hover:text-[#A78BFA]">
              <Plus className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Pill picker helper
// ---------------------------------------------------------------------------

function PillPicker({
  label,
  options,
  selected,
  onChange,
}: {
  label: string
  options: string[]
  selected: string[]
  onChange: (selected: string[]) => void
}) {
  const toggle = (opt: string) => {
    onChange(
      selected.includes(opt) ? selected.filter((s) => s !== opt) : [...selected, opt]
    )
  }

  return (
    <div className="space-y-2">
      <Label className="text-white/70 text-sm">{label}</Label>
      <div className="flex flex-wrap gap-1.5">
        {options.map((opt) => (
          <button
            key={opt}
            type="button"
            onClick={() => toggle(opt)}
            className={`px-2.5 py-0.5 rounded-full text-xs font-medium border transition-colors ${
              selected.includes(opt)
                ? "bg-[#7C3AED]/30 border-[#7C3AED]/60 text-[#A78BFA]"
                : "border-white/10 text-white/40 hover:border-[#7C3AED]/40 hover:text-[#a78bfa]"
            }`}
          >
            {opt}
          </button>
        ))}
      </div>
    </div>
  )
}

const TONE_SUGGESTIONS = [
  "direct",
  "practical",
  "conversational",
  "educational",
  "inspiring",
  "no-fluff",
  "analytical",
  "storytelling",
]

interface BrandVoiceFormProps {
  initialProfile: BrandVoiceProfile
  onSaved?: (profile: BrandVoiceProfile) => void
  onDirtyChange?: (dirty: boolean) => void
}

export function BrandVoiceForm({ initialProfile, onSaved, onDirtyChange }: BrandVoiceFormProps) {
  const [profile, setProfile] = useState<BrandVoiceProfile>(initialProfile)
  const [toneInput, setToneInput] = useState("")
  const [saving, setSaving] = useState(false)
  const [isDirty, setIsDirty] = useState(false)

  function markDirty() {
    if (!isDirty) {
      setIsDirty(true)
      onDirtyChange?.(true)
    }
  }

  function markClean() {
    setIsDirty(false)
    onDirtyChange?.(false)
  }

  const updateField = <K extends keyof BrandVoiceProfile>(
    key: K,
    value: BrandVoiceProfile[K]
  ) => {
    setProfile((prev) => ({ ...prev, [key]: value }))
    markDirty()
  }

  // Tone descriptor tag input
  const addTone = (value: string) => {
    const trimmed = value.trim()
    if (
      trimmed &&
      !profile.toneDescriptors.includes(trimmed) &&
      profile.toneDescriptors.length < 8
    ) {
      updateField("toneDescriptors", [...profile.toneDescriptors, trimmed])
    }
    setToneInput("")
  }

  const removeTone = (tone: string) => {
    updateField(
      "toneDescriptors",
      profile.toneDescriptors.filter((t) => t !== tone)
    )
  }

  const onToneKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault()
      addTone(toneInput)
    } else if (
      e.key === "Backspace" &&
      !toneInput &&
      profile.toneDescriptors.length > 0
    ) {
      removeTone(profile.toneDescriptors[profile.toneDescriptors.length - 1])
    }
  }

  const unusedToneSuggestions = TONE_SUGGESTIONS.filter(
    (s) => !profile.toneDescriptors.includes(s)
  )

  const handleSave = useCallback(async () => {
    setSaving(true)
    try {
      const res = await fetch("/api/brand-voice", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(profile),
      })

      if (!res.ok) {
        throw new Error("Save failed")
      }

      const { profile: saved } = (await res.json()) as { profile: BrandVoiceProfile }
      setProfile(saved)
      markClean()
      onSaved?.(saved)

      if (saved.examplePosts.length === 0) {
        toast.warning(
          "Brand voice saved — adding example posts significantly improves repurposing quality"
        )
      } else {
        toast.success(
          "Brand voice saved — all future repurposing will use this profile"
        )
      }
    } catch {
      toast.error("Failed to save brand voice")
    } finally {
      setSaving(false)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile, onSaved])

  // Cmd+S / Ctrl+S → save
  useEffect(() => {
    const onKeyDown = (e: globalThis.KeyboardEvent) => {
      const isMac = navigator.platform.toUpperCase().includes("MAC")
      const metaKey = isMac ? e.metaKey : e.ctrlKey
      if (metaKey && e.key.toLowerCase() === "s") {
        e.preventDefault()
        handleSave()
      }
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [handleSave])

  return (
    <div className="space-y-8 max-w-2xl">
      {/* Tone descriptors */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label className="text-white/70 text-sm">
            Tone descriptors ({profile.toneDescriptors.length}/8)
          </Label>
        </div>

        <div className="flex flex-wrap gap-1.5 p-2.5 rounded-md border border-white/10 bg-[#161616] min-h-[42px]">
          {profile.toneDescriptors.map((tone) => (
            <span
              key={tone}
              className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-[#7C3AED]/20 text-[#a78bfa] text-xs font-medium"
            >
              {tone}
              <button
                type="button"
                onClick={() => removeTone(tone)}
                className="hover:text-white ml-0.5"
              >
                ×
              </button>
            </span>
          ))}
          {profile.toneDescriptors.length < 8 && (
            <Input
              value={toneInput}
              onChange={(e) => setToneInput(e.target.value)}
              onKeyDown={onToneKeyDown}
              placeholder={
                profile.toneDescriptors.length === 0
                  ? "Type a tone word and press Enter..."
                  : ""
              }
              className="border-none bg-transparent h-5 p-0 text-sm text-white placeholder:text-white/20 focus-visible:ring-0 min-w-[140px] flex-1"
            />
          )}
        </div>

        {/* Tone suggestions */}
        {unusedToneSuggestions.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {unusedToneSuggestions.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => addTone(s)}
                className="px-2 py-0.5 rounded-md border border-white/10 text-white/40 text-xs hover:border-[#7C3AED]/40 hover:text-[#a78bfa] transition-colors"
              >
                + {s}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Writing style */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label className="text-white/70 text-sm">Writing style</Label>
          <span className="text-white/30 text-xs">
            {profile.writingStyle.length}/500
          </span>
        </div>
        <Textarea
          value={profile.writingStyle}
          onChange={(e) => updateField("writingStyle", e.target.value)}
          maxLength={500}
          placeholder="e.g. Gets to the point fast. Uses real examples over theory. Short sentences. First-person always."
          className="min-h-[100px] bg-[#161616] border-white/10 text-white placeholder:text-white/20 resize-none focus:border-[#7C3AED]/50"
        />
      </div>

      {/* Topic pillars */}
      <TopicPillarsInput
        pillars={profile.topicPillars}
        onChange={(pillars) => updateField("topicPillars", pillars)}
      />

      {/* Avoid list */}
      <AvoidListInput
        items={profile.avoidList}
        onChange={(items) => updateField("avoidList", items)}
      />

      {/* Example posts */}
      <ExamplePostsInput
        posts={profile.examplePosts}
        onChange={(posts) => updateField("examplePosts", posts)}
      />

      {/* Image Brand Kit */}
      <div className="space-y-5 pt-2 border-t border-white/5">
        <div>
          <h3 className="text-sm font-semibold text-white/80">Image Brand Kit</h3>
          <p className="text-xs text-white/30 mt-0.5">
            Applied to all AI image generation prompts for visual consistency.
          </p>
        </div>

        {/* Color pickers */}
        <div className="flex gap-4">
          <div className="space-y-1.5">
            <Label className="text-white/70 text-xs">Primary color</Label>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={profile.imageBrandKit?.primaryColor ?? DEFAULT_IMAGE_BRAND_KIT.primaryColor}
                onChange={(e) =>
                  updateField("imageBrandKit", {
                    ...(profile.imageBrandKit ?? DEFAULT_IMAGE_BRAND_KIT),
                    primaryColor: e.target.value,
                  })
                }
                className="w-9 h-9 rounded-md border border-white/10 bg-transparent cursor-pointer p-0.5"
              />
              <span className="text-xs text-white/40 font-mono">
                {profile.imageBrandKit?.primaryColor ?? DEFAULT_IMAGE_BRAND_KIT.primaryColor}
              </span>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-white/70 text-xs">Secondary color</Label>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={profile.imageBrandKit?.secondaryColor ?? DEFAULT_IMAGE_BRAND_KIT.secondaryColor}
                onChange={(e) =>
                  updateField("imageBrandKit", {
                    ...(profile.imageBrandKit ?? DEFAULT_IMAGE_BRAND_KIT),
                    secondaryColor: e.target.value,
                  })
                }
                className="w-9 h-9 rounded-md border border-white/10 bg-transparent cursor-pointer p-0.5"
              />
              <span className="text-xs text-white/40 font-mono">
                {profile.imageBrandKit?.secondaryColor ?? DEFAULT_IMAGE_BRAND_KIT.secondaryColor}
              </span>
            </div>
          </div>
        </div>

        {/* Visual style pills */}
        <PillPicker
          label="Visual style"
          options={VISUAL_STYLE_OPTIONS}
          selected={profile.imageBrandKit?.visualStyle ?? []}
          onChange={(v) =>
            updateField("imageBrandKit", {
              ...(profile.imageBrandKit ?? DEFAULT_IMAGE_BRAND_KIT),
              visualStyle: v,
            })
          }
        />

        {/* Photography style pills */}
        <PillPicker
          label="Photography style"
          options={PHOTOGRAPHY_STYLE_OPTIONS}
          selected={profile.imageBrandKit?.photographyStyle ?? []}
          onChange={(v) =>
            updateField("imageBrandKit", {
              ...(profile.imageBrandKit ?? DEFAULT_IMAGE_BRAND_KIT),
              photographyStyle: v,
            })
          }
        />

        {/* Mood keywords */}
        <TagInput
          label="Mood keywords"
          tags={profile.imageBrandKit?.moodKeywords ?? []}
          placeholder="confident, modern, clean..."
          onChange={(v) =>
            updateField("imageBrandKit", {
              ...(profile.imageBrandKit ?? DEFAULT_IMAGE_BRAND_KIT),
              moodKeywords: v,
            })
          }
        />

        {/* Avoid in images */}
        <TagInput
          label="Avoid in images"
          tags={profile.imageBrandKit?.avoidInImages ?? []}
          placeholder="people, text overlays, stock handshakes..."
          onChange={(v) =>
            updateField("imageBrandKit", {
              ...(profile.imageBrandKit ?? DEFAULT_IMAGE_BRAND_KIT),
              avoidInImages: v,
            })
          }
        />
      </div>

      {/* Warning if no examples */}
      {profile.examplePosts.length === 0 && (
        <div className="flex items-start gap-2 p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/20">
          <AlertCircle className="w-4 h-4 text-yellow-500 flex-shrink-0 mt-0.5" />
          <p className="text-yellow-400/80 text-xs">
            Adding example posts significantly improves repurposing quality. Claude
            will match your voice much more accurately with real examples.
          </p>
        </div>
      )}

      {/* Save */}
      <Button
        onClick={handleSave}
        disabled={saving}
        className="bg-[#7C3AED] hover:bg-[#6D28D9] text-white"
      >
        <Save className="w-4 h-4 mr-2" />
        {saving ? "Saving..." : "Save brand voice"}
      </Button>
    </div>
  )
}
