"use client"

import { useEffect, useState } from "react"
import { Loader2, CheckCircle2, XCircle } from "lucide-react"
import { cn } from "@/lib/utils"
import type { GenerationStatus } from "@/types"

interface GenerationStatusPanelProps {
  generationStatus: GenerationStatus
  imageGenerationStatus: GenerationStatus
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

export function GenerationStatusPanel({
  generationStatus,
  imageGenerationStatus,
}: GenerationStatusPanelProps) {
  const textElapsed = useElapsedTime(generationStatus === "generating_text")
  const imageElapsed = useElapsedTime(imageGenerationStatus === "generating_images")

  return (
    <div className="bg-[#161616] border border-[#2A2A2A] rounded-xl p-4 space-y-3">
      <p className="text-xs font-medium text-[#888888] uppercase tracking-wider">
        Generation Progress
      </p>
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
    </div>
  )
}
