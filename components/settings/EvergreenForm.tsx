"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { LoadingSpinner } from "@/components/shared/LoadingSpinner"
import { cn } from "@/lib/utils"
import { toast } from "sonner"
import type { EvergreenConfig, Platform } from "@/types"

const PLATFORMS: { value: Platform; label: string }[] = [
  { value: "twitter", label: "Twitter" },
  { value: "threads", label: "Threads" },
  { value: "instagram", label: "Instagram" },
  { value: "facebook", label: "Facebook" },
  { value: "skool", label: "Skool" },
]

const INTERVAL_OPTIONS = [7, 14, 21, 30, 45, 60, 90]

export function EvergreenForm() {
  const [config, setConfig] = useState<EvergreenConfig | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [dirty, setDirty] = useState(false)

  useEffect(() => {
    fetch("/api/evergreen")
      .then((r) => r.json())
      .then((data) => {
        setConfig(data.config)
        setLoading(false)
      })
      .catch(() => {
        toast.error("Failed to load evergreen settings")
        setLoading(false)
      })
  }, [])

  function update<K extends keyof EvergreenConfig>(key: K, value: EvergreenConfig[K]) {
    setConfig((prev) => prev ? { ...prev, [key]: value } : prev)
    setDirty(true)
  }

  function togglePlatform(platform: Platform) {
    if (!config) return
    const next = config.platforms.includes(platform)
      ? config.platforms.filter((p) => p !== platform)
      : [...config.platforms, platform]
    update("platforms", next)
  }

  async function handleSave() {
    if (!config) return
    setSaving(true)
    try {
      const res = await fetch("/api/evergreen", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(config),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? "Save failed")
      setConfig(data.config)
      setDirty(false)
      toast.success("Evergreen settings saved")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Save failed")
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-40">
        <LoadingSpinner size="md" />
      </div>
    )
  }

  if (!config) return null

  return (
    <div className="space-y-8 max-w-2xl">
      {/* Enable toggle */}
      <div className="flex items-start justify-between gap-6 p-5 rounded-lg border border-white/10 bg-[#161616]">
        <div>
          <p className="text-sm font-medium text-white">Enable Evergreen Recycling</p>
          <p className="text-xs text-zinc-500 mt-1">
            Automatically re-queue top-performing posts after a set interval.
            The cron job will reset qualifying posts back to{" "}
            <span className="text-zinc-300">approved</span> so they can be re-published.
          </p>
        </div>
        <button
          role="switch"
          aria-checked={config.enabled}
          onClick={() => update("enabled", !config.enabled)}
          className={cn(
            "relative flex-shrink-0 w-10 h-5.5 rounded-full transition-colors",
            config.enabled ? "bg-[#7C3AED]" : "bg-white/10"
          )}
        >
          <span
            className={cn(
              "absolute top-0.5 left-0.5 w-4.5 h-4.5 rounded-full bg-white shadow transition-transform",
              config.enabled ? "translate-x-4.5" : "translate-x-0"
            )}
          />
        </button>
      </div>

      {/* Threshold slider */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <label className="text-sm font-medium text-zinc-300">
            Engagement Rate Threshold
          </label>
          <span className="text-sm font-semibold text-white tabular-nums">
            {config.engagementThreshold}%
          </span>
        </div>
        <input
          type="range"
          min={0}
          max={20}
          step={0.5}
          value={config.engagementThreshold}
          onChange={(e) => update("engagementThreshold", parseFloat(e.target.value))}
          className="w-full accent-[#7C3AED] h-1.5 rounded-full bg-white/10 appearance-none cursor-pointer"
          disabled={!config.enabled}
        />
        <p className="text-xs text-zinc-500">
          Posts with an average engagement rate at or above this threshold will be eligible for recycling.
        </p>
      </div>

      {/* Interval picker */}
      <div className="space-y-3">
        <label className="text-sm font-medium text-zinc-300">Recycle Interval</label>
        <div className="flex gap-2 flex-wrap">
          {INTERVAL_OPTIONS.map((days) => (
            <button
              key={days}
              onClick={() => update("recycleIntervalDays", days)}
              disabled={!config.enabled}
              className={cn(
                "px-3 py-1.5 rounded-full text-xs font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed",
                config.recycleIntervalDays === days
                  ? "bg-[#7C3AED] text-white"
                  : "bg-white/5 text-zinc-400 hover:text-white hover:bg-white/10"
              )}
            >
              {days}d
            </button>
          ))}
        </div>
        <p className="text-xs text-zinc-500">
          A post must have been published at least this many days ago to be eligible.
        </p>
      </div>

      {/* Platform checkboxes */}
      <div className="space-y-3">
        <label className="text-sm font-medium text-zinc-300">Platforms to Recycle</label>
        <div className="grid grid-cols-3 gap-2">
          {PLATFORMS.map(({ value, label }) => {
            const checked = config.platforms.includes(value)
            return (
              <label
                key={value}
                className={cn(
                  "flex items-center gap-2.5 px-3 py-2.5 rounded-lg border cursor-pointer transition-colors",
                  !config.enabled && "opacity-40 cursor-not-allowed",
                  checked
                    ? "border-[#7C3AED]/50 bg-[#7C3AED]/10"
                    : "border-white/10 bg-[#161616] hover:border-white/20"
                )}
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => config.enabled && togglePlatform(value)}
                  className="w-4 h-4 accent-[#7C3AED]"
                  disabled={!config.enabled}
                />
                <span className="text-xs text-zinc-300">{label}</span>
              </label>
            )
          })}
        </div>
        <p className="text-xs text-zinc-500">
          Only selected platforms will have their status reset to approved on recycle.
        </p>
      </div>

      {/* Save */}
      <div className="flex items-center gap-3 pt-2">
        <Button
          onClick={handleSave}
          disabled={saving || !dirty}
          className="h-9 text-sm bg-[#7C3AED] hover:bg-[#6D28D9] text-white disabled:opacity-50"
        >
          {saving ? <LoadingSpinner size="sm" /> : "Save Evergreen Settings"}
        </Button>
        {dirty && (
          <span className="text-xs text-amber-400">Unsaved changes</span>
        )}
      </div>
    </div>
  )
}
