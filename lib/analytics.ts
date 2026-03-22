import type { LinkedInPost, Platform } from "@/types"

export const ANALYTICS_PLATFORMS = [
  "twitter",
  "threads",
  "instagram",
  "facebook",
] as const satisfies readonly Platform[]

export type AnalyticsPlatform = (typeof ANALYTICS_PLATFORMS)[number]

// ---------------------------------------------------------------------------
// Platform summary
// ---------------------------------------------------------------------------

export interface PlatformSummary {
  platform: AnalyticsPlatform
  postsWithData: number
  totalImpressions: number
  totalLikes: number
  totalComments: number
  totalShares: number
  avgEngagementRate: number   // average across posts that have engagementRate
}

/**
 * Aggregate analytics per platform across all posts.
 * Only counts platform variants that have been analytics-fetched (fetchedAt != null).
 */
export function getPlatformSummary(posts: LinkedInPost[]): PlatformSummary[] {
  return ANALYTICS_PLATFORMS.map((platform) => {
    const variants = posts
      .map((p) => p.platforms[platform])
      .filter((v) => v?.fetchedAt != null)

    const postsWithData = variants.length
    const totalImpressions = variants.reduce((s, v) => s + (v.impressions ?? 0), 0)
    const totalLikes = variants.reduce((s, v) => s + (v.likes ?? 0), 0)
    const totalComments = variants.reduce((s, v) => s + (v.comments ?? 0), 0)
    const totalShares = variants.reduce((s, v) => s + (v.shares ?? 0), 0)

    const ratedVariants = variants.filter((v) => v.engagementRate != null)
    const avgEngagementRate =
      ratedVariants.length > 0
        ? ratedVariants.reduce((s, v) => s + (v.engagementRate ?? 0), 0) / ratedVariants.length
        : 0

    return {
      platform,
      postsWithData,
      totalImpressions,
      totalLikes,
      totalComments,
      totalShares,
      avgEngagementRate,
    }
  })
}

// ---------------------------------------------------------------------------
// Top performing posts
// ---------------------------------------------------------------------------

export interface TopPost {
  post: LinkedInPost
  platform: AnalyticsPlatform
  impressions: number
  likes: number
  comments: number
  shares: number
  engagementRate: number
  publishedAt: string
  preview: string              // First 100 chars of linkedin text
}

/**
 * Returns post/platform pairs sorted by engagementRate descending.
 * Only includes pairs where analytics have been fetched.
 */
export function getTopPerformingPosts(posts: LinkedInPost[], limit = 20): TopPost[] {
  const results: TopPost[] = []

  for (const post of posts) {
    for (const platform of ANALYTICS_PLATFORMS) {
      const v = post.platforms[platform]
      if (!v?.fetchedAt || v.engagementRate == null) continue

      results.push({
        post,
        platform,
        impressions: v.impressions ?? 0,
        likes: v.likes ?? 0,
        comments: v.comments ?? 0,
        shares: v.shares ?? 0,
        engagementRate: v.engagementRate,
        publishedAt: v.publishedAt ?? v.fetchedAt,
        preview: post.linkedinText.slice(0, 100),
      })
    }
  }

  return results.sort((a, b) => b.engagementRate - a.engagementRate).slice(0, limit)
}

// ---------------------------------------------------------------------------
// Best posting times
// ---------------------------------------------------------------------------

export interface BestTimeSlot {
  platform: AnalyticsPlatform
  hour: number                 // 0–23 UTC
  avgEngagementRate: number
  sampleSize: number
}

/**
 * Groups published posts by UTC hour and averages engagement rate per platform.
 * Returns the top 3 hours per platform sorted by avgEngagementRate.
 */
export function getBestPostingTimes(posts: LinkedInPost[]): BestTimeSlot[] {
  const results: BestTimeSlot[] = []

  for (const platform of ANALYTICS_PLATFORMS) {
    const hourBuckets: Record<number, number[]> = {}

    for (const post of posts) {
      const v = post.platforms[platform]
      if (!v?.fetchedAt || v.engagementRate == null || !v.publishedAt) continue

      const hour = new Date(v.publishedAt).getUTCHours()
      if (!hourBuckets[hour]) hourBuckets[hour] = []
      hourBuckets[hour].push(v.engagementRate)
    }

    const slots = Object.entries(hourBuckets)
      .map(([hour, rates]) => ({
        platform,
        hour: Number(hour),
        avgEngagementRate: rates.reduce((s, r) => s + r, 0) / rates.length,
        sampleSize: rates.length,
      }))
      .filter((s) => s.sampleSize >= 2)   // need at least 2 samples to be meaningful
      .sort((a, b) => b.avgEngagementRate - a.avgEngagementRate)
      .slice(0, 3)

    results.push(...slots)
  }

  return results
}

// ---------------------------------------------------------------------------
// Overall summary helpers (used by dashboard stats bar)
// ---------------------------------------------------------------------------

/**
 * Returns the platform with the highest average engagement rate.
 * Returns null if no analytics data exists.
 */
export function getTopPlatform(summaries: PlatformSummary[]): AnalyticsPlatform | null {
  const withData = summaries.filter((s) => s.postsWithData > 0)
  if (withData.length === 0) return null
  return withData.sort((a, b) => b.avgEngagementRate - a.avgEngagementRate)[0].platform
}

/**
 * Returns the average engagement rate across all platforms.
 * Returns null if no analytics data exists.
 */
export function getOverallAvgEngagementRate(summaries: PlatformSummary[]): number | null {
  const withData = summaries.filter((s) => s.postsWithData > 0)
  if (withData.length === 0) return null
  return withData.reduce((s, p) => s + p.avgEngagementRate, 0) / withData.length
}
