import axios from "axios"
import { env } from "@/lib/env"
import { updateMultiplePlatforms } from "@/lib/n8n-sheet"
import { PLATFORM_RULES } from "@/lib/platform-rules"
import type {
  LinkedInPost,
  Platform,
  BrandVoiceProfile,
  HashtagBankEntry,
  PublishWebhookPayload,
  ContentRepurposeWebhookPayload,
  ImageRepurposeWebhookPayload,
} from "@/types"

// ---------------------------------------------------------------------------
// fireContentRepurposeWebhook
// POST to N8N_CONTENT_REPURPOSE_WEBHOOK_URL — 5s timeout (n8n acks quickly)
// After firing: marks all selected platforms as generating_text in Sheet
// ---------------------------------------------------------------------------

export async function fireContentRepurposeWebhook(params: {
  post: LinkedInPost
  platforms: Platform[]
  brandVoice: BrandVoiceProfile
  hashtagBank: HashtagBankEntry[]
}): Promise<{ success: boolean; error?: string }> {
  const { post, platforms, brandVoice, hashtagBank } = params
  const url = env.N8N_CONTENT_REPURPOSE_WEBHOOK_URL

  if (!url) {
    return { success: false, error: "N8N_CONTENT_REPURPOSE_WEBHOOK_URL is not configured" }
  }

  const payload: ContentRepurposeWebhookPayload = {
    postId: post.id,
    linkedinText: post.linkedinText,
    platforms,
    brandVoice: {
      toneDescriptors: brandVoice.toneDescriptors,
      writingStyle: brandVoice.writingStyle,
      topicPillars: brandVoice.topicPillars,
      avoidList: brandVoice.avoidList,
      examplePosts: brandVoice.examplePosts,
    },
    hashtagBank: hashtagBank.map((h) => ({
      hashtag: h.hashtag,
      platforms: h.platforms,
      topicPillar: h.topicPillar,
    })),
    callbackUrl: `${env.NEXT_PUBLIC_APP_URL}/api/callback/repurpose`,
  }

  try {
    await axios.post(url, payload, { timeout: 5000 })

    // Immediately mark all selected platforms as generating_text
    const variants = platforms.reduce<
      Partial<Record<Platform, { status: "pending" | "approved" | "scheduled" | "published" | "failed" }>>
    >((acc, p) => {
      acc[p] = { status: "pending" } // Sheet will update to the actual status
      return acc
    }, {})

    // Best-effort status update — don't fail the trigger if this fails
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
// POST to N8N_IMAGE_REPURPOSE_WEBHOOK_URL — 5s timeout
// After firing: marks all selected platforms as generating_images in Sheet
// ---------------------------------------------------------------------------

export async function fireImageRepurposeWebhook(params: {
  post: LinkedInPost
  imagePrompts: Partial<Record<Platform, string>>
}): Promise<{ success: boolean; error?: string }> {
  const { post, imagePrompts } = params
  const url = env.N8N_IMAGE_REPURPOSE_WEBHOOK_URL

  if (!url) {
    return { success: false, error: "N8N_IMAGE_REPURPOSE_WEBHOOK_URL is not configured" }
  }

  const platforms = Object.keys(imagePrompts) as Platform[]

  const imageSizes = platforms.reduce<
    Partial<Record<Platform, { width: number; height: number }>>
  >((acc, p) => {
    acc[p] = {
      width: PLATFORM_RULES[p].imageWidth,
      height: PLATFORM_RULES[p].imageHeight,
    }
    return acc
  }, {})

  const payload: ImageRepurposeWebhookPayload = {
    postId: post.id,
    imagePrompts,
    imageSizes,
    callbackUrl: `${env.NEXT_PUBLIC_APP_URL}/api/callback/images`,
  }

  try {
    await axios.post(url, payload, { timeout: 5000 })

    // Best-effort: mark platforms as generating_images
    // Note: PostStatus doesn't include 'generating_images' — that's a UI-only state
    // The Sheet status stays as-is; UI tracks generation via Zustand generationStatus
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
