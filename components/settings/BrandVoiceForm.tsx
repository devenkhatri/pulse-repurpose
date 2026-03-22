"use client"

import { useState, useEffect, useCallback, KeyboardEvent } from "react"
import { toast } from "sonner"
import { Save, AlertCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { ExamplePostsInput } from "./ExamplePostsInput"
import { AvoidListInput } from "./AvoidListInput"
import { TopicPillarsInput } from "./TopicPillarsInput"
import type { BrandVoiceProfile } from "@/types"

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
