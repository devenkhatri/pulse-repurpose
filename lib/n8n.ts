import axios from "axios"
import { env } from "@/lib/env"
import { updateMultiplePlatforms } from "@/lib/n8n-sheet"
import type {
  LinkedInPost,
  Platform,
  PublishWebhookPayload,
  ContentRepurposeWebhookPayload,
  ContentPromptOutput,
  ImageRepurposeWebhookPayload,
  ImagePromptOutput,
} from "@/types"

// ---------------------------------------------------------------------------
// fireContentRepurposeWebhook
// POST to N8N_CONTENT_REPURPOSE_WEBHOOK_URL
// Receives pre-built per-platform prompt pairs from platform content skills.
// n8n no longer builds prompts — it receives ready-to-use system+user pairs.
// ---------------------------------------------------------------------------

export async function fireContentRepurposeWebhook(params: {
  post: LinkedInPost
  platforms: Platform[]
  contentPrompts: Partial<Record<Platform, ContentPromptOutput>>
}): Promise<{ success: boolean; error?: string }> {
  const { post, platforms, contentPrompts } = params
  const url = env.N8N_CONTENT_REPURPOSE_WEBHOOK_URL

  if (!url) {
    return { success: false, error: "N8N_CONTENT_REPURPOSE_WEBHOOK_URL is not configured" }
  }

  const payload: ContentRepurposeWebhookPayload = {
    postId: post.id,
    contentPrompts,
    callbackUrl: `${env.NEXT_PUBLIC_APP_URL}/api/callback/repurpose`,
  }

  try {
    // 30s timeout — n8n can take a few seconds to spin up and ack
    const urlPreview = url.length > 60 ? url.slice(0, 60) + "…" : url
    console.log(`[n8n] POST ${urlPreview}  postId=${post.id}  platforms=${platforms.join(",")}`)
    await axios.post(url, payload, { timeout: 30000 })
    console.log(`[n8n] Content repurpose webhook ack'd for postId=${post.id}`)

    // Best-effort: mark all selected platforms as pending in Sheet
    const variants = platforms.reduce<
      Partial<Record<Platform, { status: "pending" | "approved" | "scheduled" | "published" | "failed" }>>
    >((acc, p) => {
      acc[p] = { status: "pending" }
      return acc
    }, {})

    try {
      await updateMultiplePlatforms(post.id, variants)
    } catch (e) {
      console.warn("[n8n] Could not update platform statuses after trigger:", e)
    }

    return { success: true }
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error"
    return { success: false, error: message }
  }
}

// ---------------------------------------------------------------------------
// fireImageRepurposeWebhook
// POST to N8N_IMAGE_REPURPOSE_WEBHOOK_URL
// Receives pre-built ImagePromptOutput objects from platform image skills.
// n8n receives complete { prompt, sourceImageUrl, styleDirectives, negativePrompt }
// per platform and passes them directly to fal.ai.
// ---------------------------------------------------------------------------

export async function fireImageRepurposeWebhook(params: {
  post: LinkedInPost
  imagePayloads: Partial<Record<Platform, ImagePromptOutput>>
}): Promise<{ success: boolean; error?: string }> {
  const { post, imagePayloads } = params
  const url = env.N8N_IMAGE_REPURPOSE_WEBHOOK_URL

  if (!url) {
    return { success: false, error: "N8N_IMAGE_REPURPOSE_WEBHOOK_URL is not configured" }
  }

  const payload: ImageRepurposeWebhookPayload = {
    postId: post.id,
    imagePayloads,
    callbackUrl: `${env.NEXT_PUBLIC_APP_URL}/api/callback/images`,
  }

  try {
    await axios.post(url, payload, { timeout: 30000 })
    return { success: true }
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error"
    return { success: false, error: message }
  }
}

// ---------------------------------------------------------------------------
// firePublishWebhook
// POST to N8N_PUBLISH_WEBHOOK_URL — 10s timeout
// ---------------------------------------------------------------------------

export async function firePublishWebhook(
  payload: PublishWebhookPayload
): Promise<{ success: boolean; error?: string }> {
  const url = env.N8N_PUBLISH_WEBHOOK_URL

  if (!url) {
    return { success: false, error: "N8N_PUBLISH_WEBHOOK_URL is not configured" }
  }

  try {
    await axios.post(url, payload, { timeout: 10000 })
    return { success: true }
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error"
    return { success: false, error: message }
  }
}
