"use client"

import { useEffect, useState } from "react"
import { AlertTriangle, X } from "lucide-react"

interface MissingWebhook {
  key: string
  feature: string
}

export function WebhookBanner() {
  const [missing, setMissing] = useState<MissingWebhook[]>([])
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    fetch("/api/env-check")
      .then((r) => r.json())
      .then((data: { missing: MissingWebhook[] }) => setMissing(data.missing ?? []))
      .catch(() => {})
  }, [])

  if (missing.length === 0 || dismissed) return null

  const isCritical = missing.some((m) => m.key === "N8N_SHEET_WEBHOOK_URL")

  return (
    <div
      className={`flex items-start gap-3 px-4 py-3 text-sm border-b ${
        isCritical
          ? "bg-red-500/10 border-red-500/30 text-red-300"
          : "bg-amber-500/10 border-amber-500/30 text-amber-300"
      }`}
    >
      <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
      <div className="flex-1 min-w-0">
        <span className="font-medium">
          {missing.length === 1
            ? "Missing webhook URL"
            : `${missing.length} missing webhook URLs`}
          :
        </span>{" "}
        {missing.map((m, i) => (
          <span key={m.key}>
            <code className="font-mono text-xs bg-white/10 px-1 py-0.5 rounded">
              {m.key}
            </code>{" "}
            <span className="opacity-70">(blocks {m.feature})</span>
            {i < missing.length - 1 ? ", " : ""}
          </span>
        ))}
        <span className="opacity-60 ml-2">— set in .env.local and restart</span>
      </div>
      {!isCritical && (
        <button
          onClick={() => setDismissed(true)}
          className="flex-shrink-0 opacity-60 hover:opacity-100 transition-opacity"
          aria-label="Dismiss"
        >
          <X className="w-4 h-4" />
        </button>
      )}
    </div>
  )
}
