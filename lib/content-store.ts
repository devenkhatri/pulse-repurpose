import fs from "fs/promises"
import path from "path"
import matter from "gray-matter"
import type { LinkedInPost, Platform, PlatformVariant } from "@/types"

const CONTENT_DIR = path.join(process.cwd(), "content")

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function ensurePostDir(postId: string): Promise<string> {
  const dir = path.join(CONTENT_DIR, postId)
  await fs.mkdir(dir, { recursive: true })
  return dir
}

// ---------------------------------------------------------------------------
// Source file
// ---------------------------------------------------------------------------

/**
 * Write _source.md — only if it doesn't already exist.
 * Never overwritten after creation.
 */
export async function writeSourceFile(post: LinkedInPost): Promise<void> {
  const dir = await ensurePostDir(post.id)
  const filePath = path.join(dir, "_source.md")
  try {
    await fs.access(filePath)
    return // already exists — never overwrite source
  } catch {
    const frontmatter = {
      post_id: post.id,
      posted_at: post.postedAt,
      linkedin_image_url: post.linkedinImageUrl ?? null,
      scraped_at: new Date().toISOString(),
    }
    const body = `# Source — LinkedIn\n\n${post.linkedinText}`
    await fs.writeFile(filePath, matter.stringify(body, frontmatter))
  }
}

// ---------------------------------------------------------------------------
// Platform files
// ---------------------------------------------------------------------------

/**
 * Write or overwrite a platform variant file.
 * Increments version number on each write.
 */
export async function writePlatformFile(
  postId: string,
  platform: Platform,
  variant: PlatformVariant,
  currentVersion?: number
): Promise<void> {
  const dir = await ensurePostDir(postId)
  const filePath = path.join(dir, `${platform}.md`)

  // Read existing version number if file exists
  let version = 1
  try {
    const existing = matter(await fs.readFile(filePath, "utf-8"))
    version = (currentVersion ?? (existing.data.version as number) ?? 0) + 1
  } catch {
    version = 1
  }

  const frontmatter = {
    post_id: postId,
    platform,
    status: variant.status,
    generated_at: variant.generatedAt ?? new Date().toISOString(),
    approved_at: variant.approvedAt ?? null,
    published_at: variant.publishedAt ?? null,
    scheduled_at: variant.scheduledAt ?? null,
    image_url: variant.imageUrl ?? null,
    image_prompt: variant.imagePrompt ?? null,
    hashtags: variant.hashtags.join(", "),
    edited_by_user: variant.isEdited ?? false,
    version,
  }

  const platformLabel: Record<Platform, string> = {
    twitter: "Twitter / X",
    threads: "Threads",
    instagram: "Instagram",
    facebook: "Facebook",
    skool: "Skool Community",
    linkedin: "LinkedIn",
  }

  // Append hashtag line for instagram/threads at end of body
  const hashtagLine =
    variant.hashtags.length > 0 &&
    (platform === "instagram" || platform === "threads")
      ? `\n\n${variant.hashtags.map((h) => "#" + h).join(" ")}`
      : ""

  const body = `# ${platformLabel[platform]}\n\n${variant.text ?? ""}${hashtagLine}`
  await fs.writeFile(filePath, matter.stringify(body, frontmatter))
}

/**
 * Read a platform file back into a structured object.
 */
export async function readPlatformFile(
  postId: string,
  platform: Platform
): Promise<{ frontmatter: Record<string, unknown>; text: string } | null> {
  const filePath = path.join(CONTENT_DIR, postId, `${platform}.md`)
  try {
    const raw = await fs.readFile(filePath, "utf-8")
    const parsed = matter(raw)
    return { frontmatter: parsed.data, text: parsed.content.trim() }
  } catch {
    return null
  }
}

/**
 * Read all platform files for a post.
 */
export async function readAllPlatformFiles(
  postId: string
): Promise<
  Partial<Record<Platform, { frontmatter: Record<string, unknown>; text: string }>>
> {
  const platforms: Platform[] = [
    "twitter",
    "threads",
    "instagram",
    "facebook",
    "skool",
  ]
  const results: Partial<
    Record<Platform, { frontmatter: Record<string, unknown>; text: string }>
  > = {}
  await Promise.all(
    platforms.map(async (p) => {
      const result = await readPlatformFile(postId, p)
      if (result) results[p] = result
    })
  )
  return results
}

/**
 * Update only the frontmatter fields of an existing platform file.
 * Used for status changes, approve/publish events, etc.
 */
export async function updatePlatformFileMeta(
  postId: string,
  platform: Platform,
  updates: Partial<Record<string, unknown>>
): Promise<void> {
  const filePath = path.join(CONTENT_DIR, postId, `${platform}.md`)
  try {
    const raw = await fs.readFile(filePath, "utf-8")
    const parsed = matter(raw)
    const newFrontmatter = { ...parsed.data, ...updates }
    await fs.writeFile(filePath, matter.stringify(parsed.content, newFrontmatter))
  } catch {
    // File doesn't exist yet — skip silently
  }
}

/**
 * List all post IDs that have a content folder.
 */
export async function listContentPostIds(): Promise<string[]> {
  try {
    const entries = await fs.readdir(CONTENT_DIR, { withFileTypes: true })
    return entries.filter((e) => e.isDirectory()).map((e) => e.name)
  } catch {
    return []
  }
}
