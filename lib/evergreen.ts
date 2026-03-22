import fs from "fs/promises"
import path from "path"
import type { EvergreenConfig } from "@/types"
import { cacheGetOrSet, cacheDelete } from "@/lib/cache"

const EVERGREEN_CACHE_KEY = "file:evergreen"
const EVERGREEN_TTL_MS = 5 * 60 * 1000

const EVERGREEN_CONFIG_PATH = path.join(process.cwd(), "config", "evergreen.json")
const RECYCLED_POSTS_PATH = path.join(process.cwd(), "config", "recycled-posts.json")

const DEFAULT_EVERGREEN_CONFIG: EvergreenConfig = {
  enabled: false,
  engagementThreshold: 3,
  recycleIntervalDays: 30,
  platforms: ["twitter", "threads", "instagram", "facebook", "skool"],
}

// ---------------------------------------------------------------------------
// Evergreen config read/write
// ---------------------------------------------------------------------------

export async function getEvergreenConfig(): Promise<EvergreenConfig> {
  return cacheGetOrSet(EVERGREEN_CACHE_KEY, EVERGREEN_TTL_MS, async () => {
    try {
      const raw = await fs.readFile(EVERGREEN_CONFIG_PATH, "utf-8")
      return JSON.parse(raw) as EvergreenConfig
    } catch {
      return DEFAULT_EVERGREEN_CONFIG
    }
  })
}

export async function saveEvergreenConfig(config: EvergreenConfig): Promise<void> {
  await fs.writeFile(EVERGREEN_CONFIG_PATH, JSON.stringify(config, null, 2))
  cacheDelete(EVERGREEN_CACHE_KEY)
}

// ---------------------------------------------------------------------------
// Recycled posts tracking
// ---------------------------------------------------------------------------

/** Returns a map of { [postId]: recycledAt ISO string } */
export async function getRecycledPosts(): Promise<Record<string, string>> {
  try {
    const raw = await fs.readFile(RECYCLED_POSTS_PATH, "utf-8")
    return JSON.parse(raw) as Record<string, string>
  } catch {
    return {}
  }
}

/** Records a post as recycled (idempotent — first-recycle timestamp is preserved) */
export async function markPostRecycled(postId: string, recycledAt?: string): Promise<void> {
  const existing = await getRecycledPosts()
  if (!existing[postId]) {
    existing[postId] = recycledAt ?? new Date().toISOString()
    await fs.writeFile(RECYCLED_POSTS_PATH, JSON.stringify(existing, null, 2))
  }
}
