import axios from "axios"
import { env } from "@/lib/env"
import type {
  LinkedInPost,
  Platform,
  PlatformVariant,
  PostStatus,
  SheetAction,
} from "@/types"

// ---------------------------------------------------------------------------
// Internal helper
// ---------------------------------------------------------------------------

async function sheetRequest<T>(
  action: SheetAction,
  payload: Record<string, unknown>,
  timeoutMs = 15000
): Promise<T> {
  const url = env.N8N_SHEET_WEBHOOK_URL
  if (!url) throw new Error("N8N_SHEET_WEBHOOK_URL is not configured")

  const response = await axios.post<T>(
    url,
    { action, payload },
    { timeout: timeoutMs }
  )

  // For mutation actions we expect a success flag
  const isRead = action === "GET_ALL_POSTS" || action === "GET_POST_BY_ID"
  if (!isRead) {
    const data = response.data as Record<string, unknown>
    if (data?.success === false) {
      throw new Error(
        `Sheet operation ${action} failed: ${String(data?.error ?? "unknown error")}`
      )
    }
  }

  return response.data
}

// ---------------------------------------------------------------------------
// Filter type for getAllPosts
// ---------------------------------------------------------------------------

export interface GetAllPostsFilters {
  statusFilter?: PostStatus
  platformFilter?: Platform
  fromDate?: string
  toDate?: string
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Fetch all posts from Google Sheets (via n8n Sheet webhook).
 * Filters are applied server-side by n8n.
 */
export async function getAllPosts(
  filters?: GetAllPostsFilters
): Promise<LinkedInPost[]> {
  const data = await sheetRequest<{ posts: LinkedInPost[] }>(
    "GET_ALL_POSTS",
    (filters ?? {}) as Record<string, unknown>,
    15000
  )
  return data.posts ?? []
}

/**
 * Fetch a single post by ID.
 */
export async function getPostById(postId: string): Promise<LinkedInPost | null> {
  const data = await sheetRequest<{ post: LinkedInPost | null }>(
    "GET_POST_BY_ID",
    { postId },
    15000
  )
  return data.post ?? null
}

/**
 * Update a single platform variant's columns for one post.
 * Only provided fields are written.
 */
export async function updatePlatformVariant(
  postId: string,
  platform: Platform,
  variant: Partial<PlatformVariant>
): Promise<void> {
  await sheetRequest(
    "UPDATE_PLATFORM_VARIANT",
    { postId, platform, variant },
    10000
  )
}

/**
 * Batch-update multiple platform variants in a single Sheet call.
 */
export async function updateMultiplePlatforms(
  postId: string,
  variants: Partial<Record<Platform, Partial<PlatformVariant>>>
): Promise<void> {
  await sheetRequest(
    "UPDATE_MULTIPLE_PLATFORMS",
    { postId, variants },
    10000
  )
}

/**
 * Write content prompts (JSON strings) for each platform before firing the
 * content repurpose webhook. These are stored in Sheet for audit/debug.
 * prompts = { twitter: JSON.stringify({ systemPrompt, userPrompt }), ... }
 */
export async function writeContentPrompts(
  postId: string,
  prompts: Partial<Record<Platform, string>>
): Promise<void> {
  await sheetRequest(
    "WRITE_CONTENT_PROMPTS",
    { postId, prompts },
    10000
  )
}

/**
 * Write image prompts (fal.ai prompt strings) for each platform before
 * firing the image repurpose webhook.
 */
export async function writeImagePrompts(
  postId: string,
  prompts: Partial<Record<Platform, string>>
): Promise<void> {
  await sheetRequest(
    "WRITE_IMAGE_PROMPTS",
    { postId, prompts },
    10000
  )
}

/**
 * Lightweight status update — used by publish flow callbacks.
 * Optionally sets publishedAt and error.
 */
export async function updateStatus(
  postId: string,
  platform: Platform,
  status: PostStatus,
  meta?: { publishedAt?: string; error?: string }
): Promise<void> {
  await sheetRequest(
    "UPDATE_STATUS",
    {
      postId,
      platform,
      status,
      ...(meta?.publishedAt ? { publishedAt: meta.publishedAt } : {}),
      ...(meta?.error ? { error: meta.error } : {}),
    },
    10000
  )
}
