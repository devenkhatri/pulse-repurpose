import fs from "fs/promises"
import path from "path"
import { randomUUID } from "crypto"
import type { HashtagBankEntry, Platform } from "@/types"

const CONFIG_PATH = path.join(process.cwd(), "config", "hashtag-bank.json")

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

async function readBank(): Promise<HashtagBankEntry[]> {
  try {
    const raw = await fs.readFile(CONFIG_PATH, "utf-8")
    return JSON.parse(raw) as HashtagBankEntry[]
  } catch {
    return []
  }
}

async function writeBank(entries: HashtagBankEntry[]): Promise<void> {
  await fs.writeFile(CONFIG_PATH, JSON.stringify(entries, null, 2))
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export async function getHashtagBank(): Promise<HashtagBankEntry[]> {
  return readBank()
}

export async function addHashtag(
  entry: Omit<HashtagBankEntry, "id" | "usageCount" | "lastUsed">
): Promise<HashtagBankEntry> {
  const bank = await readBank()

  // Normalise: strip # prefix if accidentally included
  const hashtag = entry.hashtag.replace(/^#/, "").trim().toLowerCase()

  const newEntry: HashtagBankEntry = {
    ...entry,
    hashtag,
    id: randomUUID(),
    usageCount: 0,
    lastUsed: null,
  }

  bank.push(newEntry)
  await writeBank(bank)
  return newEntry
}

export async function removeHashtag(id: string): Promise<void> {
  const bank = await readBank()
  const updated = bank.filter((e) => e.id !== id)
  await writeBank(updated)
}

/**
 * Increment usage count and set lastUsed when a hashtag is approved and published.
 */
export async function incrementUsage(hashtag: string): Promise<void> {
  const bank = await readBank()
  const normalised = hashtag.replace(/^#/, "").trim().toLowerCase()
  const updated = bank.map((e) =>
    e.hashtag === normalised
      ? { ...e, usageCount: e.usageCount + 1, lastUsed: new Date().toISOString() }
      : e
  )
  await writeBank(updated)
}

/**
 * Return hashtags relevant to a given platform and optional topic pillar,
 * sorted by usage count descending. Limit controls how many are returned.
 */
export async function getRelevantHashtags(
  platform: Platform,
  topicPillar: string | null,
  limit: number
): Promise<HashtagBankEntry[]> {
  const bank = await readBank()

  const filtered = bank.filter((entry) => {
    const matchesPlatform = entry.platforms.includes(platform)
    const matchesPillar =
      topicPillar === null || entry.topicPillar === topicPillar
    return matchesPlatform && matchesPillar
  })

  return filtered.sort((a, b) => b.usageCount - a.usageCount).slice(0, limit)
}
