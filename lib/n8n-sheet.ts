import axios from "axios"
import { env } from "@/lib/env"
import { cacheGetOrSet, cacheDelete, cacheDeletePrefix } from "@/lib/cache"
import type {
  LinkedInPost,
  Platform,
  PlatformVariant,
  PostStatus,
  SheetAction,
} from "@/types"

// ---------------------------------------------------------------------------
// Internal helper: Convert snake_case to camelCase
// ---------------------------------------------------------------------------

function snakeToCamel(str: string): string {
  return str.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase())
}

function convertKeysToCamelCase(obj: unknown): unknown {
  if (obj === null || obj === undefined) {
    return obj
  }

  if (Array.isArray(obj)) {
    return obj.map((item) => convertKeysToCamelCase(item))
  }

  if (typeof obj === "object") {
    const result: Record<string, unknown> = {}
    for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
      const camelKey = snakeToCamel(key)
      result[camelKey] = convertKeysToCamelCase(value)
    }
    return result
  }

  return obj
}

/**
 * Normalize post data from Google Sheets (snake_case) to app format (camelCase).
 */
function normalizePost(post: unknown): LinkedInPost {
  const normalized = convertKeysToCamelCase(post) as Partial<LinkedInPost>

  // Ensure platforms object exists
  if (!normalized.platforms) {
    normalized.platforms = {} as Record<Platform, PlatformVariant>
  }

  return normalized as LinkedInPost
}

/**
 * Normalize array of posts from Google Sheets.
 */
function normalizePosts(posts: unknown[]): LinkedInPost[] {
  return posts.map(normalizePost)
}

// ---------------------------------------------------------------------------
// Internal helper: sheet request
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

const POST_TTL_MS = 2500
const POSTS_LIST_TTL_MS = 30_000

function postsListCacheKey(filters?: GetAllPostsFilters): string {
  if (!filters || Object.keys(filters).length === 0) return "posts:list:all"
  const sorted = Object.entries(filters)
    .filter(([, v]) => v !== undefined)
    .sort(([a], [b]) => a.localeCompare(b))
  return `posts:list:${JSON.stringify(Object.fromEntries(sorted))}`
}

export function invalidatePostCache(postId: string): void {
  cacheDelete(`post:${postId}`)
  cacheDeletePrefix("posts:list:")
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Fetch all posts from Google Sheets (via n8n Sheet webhook).
 * Filters are applied server-side by n8n.
 * Normalizes snake_case column names from Sheets to camelCase for the app.
 */
export async function getAllPosts(
  filters?: GetAllPostsFilters
): Promise<LinkedInPost[]> {
  return cacheGetOrSet(postsListCacheKey(filters), POSTS_LIST_TTL_MS, async () => {
    const data = await sheetRequest<{ posts: unknown[] }>(
      "GET_ALL_POSTS",
      (filters ?? {}) as Record<string, unknown>,
      15000
    )
    return normalizePosts(data.posts ?? [])
  })
}

/**
 * Fetch a single post by ID.
 * Normalizes snake_case column names from Sheets to camelCase for the app.
 */
export async function getPostById(postId: string): Promise<LinkedInPost | null> {
  return cacheGetOrSet(`post:${postId}`, POST_TTL_MS, async () => {
    const data = await sheetRequest<{ post: unknown | null }>(
      "GET_POST_BY_ID",
      { postId },
      15000
    )
    return data.post ? normalizePost(data.post) : null
  })
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
 * Write analytics metrics for a single platform variant.
 * Called by /api/callback/analytics after n8n Workflow 4 fetches engagement data.
 */
export async function updateAnalytics(
  postId: string,
  platform: Platform,
  metrics: {
    impressions: number
    likes: number
    comments: number
    shares: number
    engagementRate: number
    fetchedAt: string
  }
): Promise<void> {
  await sheetRequest(
    "UPDATE_ANALYTICS",
    { postId, platform, metrics },
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
