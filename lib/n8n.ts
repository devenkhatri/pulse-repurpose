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

    // Best-effort: mark only platforms that are currently pending as pending.
    // Platforms already approved/scheduled/published are left untouched so
    // re-generating one platform doesn't erase prior approvals.
    const pendingVariants = platforms.reduce<
      Partial<Record<Platform, { status: "pending" | "approved" | "scheduled" | "published" | "failed" }>>
    >((acc, p) => {
      const currentStatus = post.platforms[p]?.status
      if (!currentStatus || currentStatus === "pending" || currentStatus === "failed") {
        acc[p] = { status: "pending" }
      }
      return acc
    }, {})

    if (Object.keys(pendingVariants).length > 0) {
      try {
        await updateMultiplePlatforms(post.id, pendingVariants)
      } catch (e) {
        console.warn("[n8n] Could not update platform statuses after trigger:", e)
      }
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
// callLLMWebhook
// POST to N8N_LLM_WEBHOOK_URL — synchronous LLM proxy via workflow-4.
// ---------------------------------------------------------------------------

export async function callLLMWebhook(params: {
  messages: Array<{ role: "system" | "user" | "assistant"; content: string }>
  maxTokens?: number
  model?: string
}): Promise<string> {
  const url = env.N8N_LLM_WEBHOOK_URL

  if (!url) {
    throw new Error("N8N_LLM_WEBHOOK_URL is not configured")
  }

  const response = await axios.post<{ content: string }>(
    url,
    {
      messages: params.messages,
      maxTokens: params.maxTokens ?? 1024,
      model: params.model,
    },
    { timeout: 60000 }
  )

  const content = response.data?.content
  if (!content) {
    throw new Error("Empty response from LLM webhook")
  }

  return content
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
