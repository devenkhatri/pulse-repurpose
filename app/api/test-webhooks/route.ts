import { NextRequest, NextResponse } from "next/server"
import axios from "axios"
import { env } from "@/lib/env"

// ---------------------------------------------------------------------------
// POST /api/test-webhooks
// Dev-only — fires test payloads to all 4 n8n webhook URLs to verify they
// are reachable and responding. Do not use in production.
// ---------------------------------------------------------------------------

export async function POST(req: NextRequest) {
  // Only allow in development
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json(
      { error: "Not available in production" },
      { status: 403 }
    )
  }

  const results: Record<string, { url: string; status: "ok" | "error"; details?: string }> = {}

  const webhooks = {
    sheet: env.N8N_SHEET_WEBHOOK_URL,
    contentRepurpose: env.N8N_CONTENT_REPURPOSE_WEBHOOK_URL,
    imageRepurpose: env.N8N_IMAGE_REPURPOSE_WEBHOOK_URL,
    publish: env.N8N_PUBLISH_WEBHOOK_URL,
  }

  await Promise.allSettled(
    Object.entries(webhooks).map(async ([name, url]) => {
      if (!url) {
        results[name] = { url: "(not configured)", status: "error", details: "URL missing" }
        return
      }

      try {
        const testPayload = { _test: true, source: "pulse-repurpose-test", timestamp: new Date().toISOString() }
        const res = await axios.post(url, testPayload, { timeout: 5000 })
        results[name] = { url, status: "ok", details: `HTTP ${res.status}` }
      } catch (err) {
        const message = err instanceof Error ? err.message : "Unknown error"
        results[name] = { url, status: "error", details: message }
      }
    })
  )

  const allOk = Object.values(results).every((r) => r.status === "ok")

  return NextResponse.json({ allOk, results })
}

// ---------------------------------------------------------------------------
// GET /api/test-webhooks
// Returns configured webhook URLs (values masked) and their configuration status.
// ---------------------------------------------------------------------------

export async function GET(_req: NextRequest) {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json(
      { error: "Not available in production" },
      { status: 403 }
    )
  }

  const mask = (url: string) =>
    url ? url.replace(/^(https?:\/\/[^/]+)(.*)$/, (_, host, path) =>
      `${host}${path.length > 10 ? path.slice(0, 10) + "…" : path}`
    ) : "(not configured)"

  return NextResponse.json({
    webhooks: {
      sheet: { configured: !!env.N8N_SHEET_WEBHOOK_URL, url: mask(env.N8N_SHEET_WEBHOOK_URL) },
      contentRepurpose: { configured: !!env.N8N_CONTENT_REPURPOSE_WEBHOOK_URL, url: mask(env.N8N_CONTENT_REPURPOSE_WEBHOOK_URL) },
      imageRepurpose: { configured: !!env.N8N_IMAGE_REPURPOSE_WEBHOOK_URL, url: mask(env.N8N_IMAGE_REPURPOSE_WEBHOOK_URL) },
      publish: { configured: !!env.N8N_PUBLISH_WEBHOOK_URL, url: mask(env.N8N_PUBLISH_WEBHOOK_URL) },
    },
    anthropic: { configured: !!(env.ANTHROPIC_API_KEY && env.ANTHROPIC_API_KEY !== "your_key_here") },
  })
}
