import { NextResponse } from "next/server"
import axios from "axios"
import { env } from "@/lib/env"

// ---------------------------------------------------------------------------
// POST /api/trigger/analytics
//
// Manually triggers n8n Workflow 4 (Analytics Fetch).
// Workflow 4 fetches engagement metrics from platform APIs for all published
// posts in the last 30 days, writes them to the Sheet via UPDATE_ANALYTICS,
// then calls back to /api/callback/analytics with a summary.
// ---------------------------------------------------------------------------

export async function POST() {
  try {
    const webhookUrl = env.N8N_ANALYTICS_WEBHOOK_URL
    if (!webhookUrl) {
      return NextResponse.json(
        { success: false, error: "N8N_ANALYTICS_WEBHOOK_URL is not configured" },
        { status: 503 }
      )
    }

    const callbackUrl = `${env.NEXT_PUBLIC_APP_URL}/api/callback/analytics`

    await axios.post(
      webhookUrl,
      { callbackUrl },
      { timeout: 10_000 }
    )

    return NextResponse.json({ success: true, message: "Analytics fetch triggered" })
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error"
    console.error("[trigger/analytics] Failed to fire webhook:", message)
    return NextResponse.json(
      { success: false, error: message },
      { status: 502 }
    )
  }
}
