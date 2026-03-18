import { NextResponse } from "next/server"

// What each N8N webhook URL enables in the UI
const N8N_VARS = [
  {
    key: "N8N_SHEET_WEBHOOK_URL",
    feature: "data loading — entire app is non-functional without this",
  },
  {
    key: "N8N_CONTENT_REPURPOSE_WEBHOOK_URL",
    feature: "text generation",
  },
  {
    key: "N8N_IMAGE_REPURPOSE_WEBHOOK_URL",
    feature: "image generation",
  },
  {
    key: "N8N_PUBLISH_WEBHOOK_URL",
    feature: "publishing to social platforms",
  },
] as const

// GET /api/env-check
// Returns list of missing N8N webhook URLs so the client can show a warning banner.
// Never returns secret values — only key names and descriptions.
export async function GET() {
  const missing = N8N_VARS.filter(({ key }) => !process.env[key]).map(
    ({ key, feature }) => ({ key, feature })
  )
  return NextResponse.json({ missing })
}
