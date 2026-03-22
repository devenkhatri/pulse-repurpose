# Claude Code Prompt — Content Repurposing App ("Pulse Repurpose")

## Project overview

Build a full-stack web application called **Pulse Repurpose** — a personal content operations tool that takes LinkedIn posts and repurposes them for Twitter/X, Threads, Instagram, Facebook, and Skool Community. The app is a thin orchestrator and review UI — it fires webhooks to n8n workflows which handle all AI calls (Claude for text, fal.ai for images) and all publishing end-to-end. The app is responsible for: triggering n8n workflows, polling Google Sheets for results, displaying and editing variants, hashtag intelligence (Claude called directly from app), brand voice profile management, content calendar, and approving/scheduling posts. Google Sheets is the master data tracker. Everything is local-first — this runs on localhost for personal use.

### Webhook architecture — three separate n8n workflows

The app communicates with n8n via three distinct webhook URLs, each triggering an independent workflow:

1. **Content repurpose webhook** — App sends post text + brand voice payload → n8n calls Claude API for all 5 platforms in parallel → n8n writes generated text + hashtags back to Google Sheet → n8n calls app callback endpoint to notify completion.
2. **Image repurpose webhook** — App sends post ID + image prompts per platform → n8n calls fal.ai for all 5 platforms in parallel → n8n writes image URLs back to Google Sheet → n8n calls app callback endpoint to notify completion.
3. **Publish webhook** — App sends approved variant data → n8n routes by platform and publishes → n8n writes published status + timestamp back to Sheet. (Option A single-router workflow, unchanged from prior spec.)

The app never calls Claude or fal.ai directly for repurposing. It only calls Claude directly for the AI chat sidebar (in-session edits) and hashtag suggestions, since those are interactive and synchronous by nature.

---

## Tech stack

- **Framework**: Next.js 14 (App Router)
- **Language**: TypeScript throughout — no `any` types
- **Styling**: Tailwind CSS + shadcn/ui components
- **AI (direct — chat sidebar + hashtags only)**: Anthropic Claude API (`claude-sonnet-4-20250514`)
- **AI (repurpose + images — via n8n)**: Claude + fal.ai called by n8n, not the app
- **Google Sheets**: Google Sheets API v4 via service account (read + write)
- **State management**: Zustand
- **Forms**: React Hook Form + Zod validation
- **Calendar**: FullCalendar (React)
- **Drag and drop**: @dnd-kit/core for calendar rescheduling
- **HTTP client**: Axios
- **Date handling**: date-fns
- **Notifications**: Sonner (toast notifications)
- **Icons**: Lucide React

---

## Project structure

```
pulse-repurpose/
├── app/
│   ├── layout.tsx                  # Root layout with sidebar nav
│   ├── page.tsx                    # Redirect to /dashboard
│   ├── dashboard/
│   │   └── page.tsx
│   ├── repurpose/
│   │   └── page.tsx
│   ├── calendar/
│   │   └── page.tsx
│   ├── settings/
│   │   └── page.tsx                # Brand voice profile
│   └── api/
│       ├── posts/
│       │   ├── route.ts            # GET all posts from Sheet
│       │   └── [id]/
│       │       └── route.ts        # GET/PATCH single post
│       ├── trigger/
│       │   ├── repurpose/
│       │   │   └── route.ts        # POST — fire content repurpose webhook to n8n
│       │   └── images/
│       │       └── route.ts        # POST — fire image repurpose webhook to n8n
│       ├── callback/
│       │   ├── repurpose/
│       │   │   └── route.ts        # POST — n8n calls this when text generation is done
│       │   └── images/
│       │       └── route.ts        # POST — n8n calls this when image generation is done
│       ├── hashtags/
│       │   └── route.ts            # POST — generate hashtag suggestions (Claude direct)
│       ├── chat/
│       │   └── route.ts            # POST — AI chat sidebar (Claude direct)
│       ├── publish/
│       │   └── route.ts            # POST — fire publish webhook to n8n
│       ├── skills/
│       │   ├── repurpose/
│       │   │   └── route.ts        # POST — memory-aware master repurpose skill executor
│       │   └── platform-prompt/
│       │       └── route.ts        # POST — executes any platform skill, returns prompt payload
│       ├── brand-voice/
│       │   └── route.ts            # GET/POST brand voice config
│       ├── hashtag-bank/
│       │   └── route.ts            # GET/POST/DELETE hashtag bank entries
│       └── docs/
│           ├── sync/
│           │   └── route.ts        # POST — trigger doc regeneration after feature changes
│           └── status/
│               └── route.ts        # GET — check which docs are stale
├── components/
│   ├── layout/
│   │   ├── Sidebar.tsx
│   │   └── TopBar.tsx
│   ├── dashboard/
│   │   ├── PostsTable.tsx
│   │   ├── PostRow.tsx
│   │   ├── StatusBadge.tsx
│   │   └── PlatformStatusGrid.tsx
│   ├── repurpose/
│   │   ├── SourcePostPanel.tsx
│   │   ├── PlatformCard.tsx
│   │   ├── ImagePreview.tsx
│   │   ├── HashtagSuggestions.tsx
│   │   ├── AIChatSidebar.tsx
│   │   ├── GenerationStatusPanel.tsx   # Shows n8n workflow progress
│   │   └── ApproveButton.tsx
│   ├── calendar/
│   │   ├── CalendarView.tsx
│   │   ├── EventPopover.tsx
│   │   └── GapWarningBanner.tsx
│   ├── settings/
│   │   ├── BrandVoiceForm.tsx
│   │   ├── ExamplePostsInput.tsx
│   │   ├── AvoidListInput.tsx
│   │   ├── TopicPillarsInput.tsx
│   │   └── HashtagBankManager.tsx
│   └── shared/
│       ├── PlatformIcon.tsx
│       ├── LoadingSpinner.tsx
│       └── ConfirmDialog.tsx
├── lib/
│   ├── anthropic.ts                # Claude API client — chat sidebar + hashtags ONLY
│   ├── n8n.ts                      # All four webhook fire helpers (sheet + repurpose + images + publish)
│   ├── n8n-sheet.ts                # Typed helper for all Sheet operations via n8n webhook
│   ├── content-store.ts            # Read/write content .md files per post per platform
│   ├── docs-sync.ts                # Doc impact map, context builder, Claude + template generators
│   ├── brand-voice.ts              # Read/write brand voice config JSON
│   ├── hashtag-bank.ts             # Read/write hashtag bank JSON
│   ├── platform-rules.ts           # Per-platform constraints and prompt rules
│   └── utils.ts                    # Shared utilities
├── stores/
│   ├── postsStore.ts               # Zustand — posts state
│   ├── repurposeStore.ts           # Zustand — current repurpose session + generation status
│   └── settingsStore.ts            # Zustand — brand voice + hashtag bank
├── types/
│   └── index.ts                    # All TypeScript interfaces
├── config/
│   ├── brand-voice.json            # Persisted brand voice profile
│   └── hashtag-bank.json           # Persisted hashtag bank
├── .env.local                      # All secrets
├── README.md
├── CHANGELOG.md                    # Append-only change journal — written by Claude Code after every task
│
├── SOUL.md                         # App identity, values, operating principles
├── Heartbeat.md                    # Master index — points to all living system files
│
├── memory/
│   ├── USER.md                     # Who the user is, preferences, observed patterns
│   ├── MEMORY.md                   # Rolling working memory — current context + state
│   ├── learnings.md                # Accumulated learnings across all sessions
│   └── daily/
│       ├── YYYY-MM-DD.md           # Auto-generated daily memory snapshot (one per day)
│       └── ...
│
├── skills/
│   ├── repurpose.md                # Master repurpose skill (orchestrates platform skills)
│   ├── cron.md                     # Cron skill — scheduled automation runbook
│   └── platforms/
│       ├── twitter-content.md      # Twitter/X content prompt factory
│       ├── twitter-image.md        # Twitter/X image prompt factory
│       ├── threads-content.md      # Threads content prompt factory
│       ├── threads-image.md        # Threads image prompt factory
│       ├── instagram-content.md    # Instagram content prompt factory
│       ├── instagram-image.md      # Instagram image prompt factory
│       ├── facebook-content.md     # Facebook content prompt factory
│       ├── facebook-image.md       # Facebook image prompt factory
│       ├── skool-content.md        # Skool content prompt factory
│       └── skool-image.md          # Skool image prompt factory
│
└── content/
    └── [post_id]/                  # One folder per LinkedIn post (e.g. post_001/)
        ├── _source.md              # Original LinkedIn post text + metadata
        ├── twitter.md              # Repurposed Twitter/X variant
        ├── threads.md              # Repurposed Threads variant
        ├── instagram.md            # Repurposed Instagram variant
        ├── facebook.md             # Repurposed Facebook variant
        └── skool.md                # Repurposed Skool variant
```

---

## Environment variables (.env.local)

```env
# Anthropic — used only for chat sidebar and hashtag suggestions
ANTHROPIC_API_KEY=

# n8n — four separate webhook URLs, one per workflow
N8N_SHEET_WEBHOOK_URL=                 # Webhook 0: all Google Sheet read/write operations
N8N_CONTENT_REPURPOSE_WEBHOOK_URL=     # Webhook 1: receives pre-built prompt payloads from platform skills, calls Claude
N8N_IMAGE_REPURPOSE_WEBHOOK_URL=       # Webhook 2: receives pre-built image payloads from platform skills, calls fal.ai
N8N_PUBLISH_WEBHOOK_URL=               # Webhook 3: publishes to platforms

# App — used by n8n to call back when async workflows complete
NEXT_PUBLIC_APP_URL=http://localhost:3000

# No Google Sheets credentials here — all Sheet access is handled exclusively by n8n
```

---

## TypeScript types (types/index.ts)

Define all shared types here. Every other file imports from this file.

```typescript
export type Platform = 'twitter' | 'threads' | 'instagram' | 'facebook' | 'skool' | 'linkedin'

export type PostStatus = 'pending' | 'approved' | 'scheduled' | 'published' | 'failed'

export type GenerationStatus = 'idle' | 'generating_text' | 'generating_images' | 'done' | 'failed'

export interface LinkedInPost {
  id: string                        // Unique row ID from Sheet (row number as string)
  linkedinText: string              // Original LinkedIn post text
  linkedinImageUrl: string | null   // Original image URL if available
  postedAt: string                  // ISO date string
  platforms: Record<Platform, PlatformVariant>
}

export interface PlatformVariant {
  text: string | null
  contentPrompt: string | null      // JSON string of { systemPrompt, userPrompt } from content skill — Sheet col F/O/X/AG/AP
  imagePrompt: string | null        // fal.ai prompt string from image skill — Sheet col G/P/Y/AH/AQ
  imageUrl: string | null
  hashtags: string[]
  status: PostStatus
  generatedAt: string | null        // ISO date string, set when AI generates
  scheduledAt: string | null        // ISO date string
  publishedAt: string | null        // ISO date string
  approvedAt: string | null         // ISO date string, set when user approves
  isEdited: boolean
  error: string | null
}

export interface BrandVoiceProfile {
  toneDescriptors: string[]         // e.g. ["direct", "practical", "no fluff"]
  writingStyle: string              // Free text paragraph describing writing style
  topicPillars: string[]            // e.g. ["solopreneurship", "AI tools", "productivity"]
  avoidList: string[]               // Words, phrases, or patterns to never use
  examplePosts: string[]            // 3–5 raw LinkedIn post texts the user loves
  lastUpdated: string               // ISO date string
}

export interface HashtagBankEntry {
  id: string
  hashtag: string                   // Without # prefix
  platforms: Platform[]             // Which platforms this is relevant for
  topicPillar: string | null        // Which pillar it belongs to
  usageCount: number
  lastUsed: string | null
}

export interface RepurposeSession {
  sourcePost: LinkedInPost
  variants: Record<Platform, RepurposeVariantDraft>
  activeChat: ChatMessage[]
  activePlatform: Platform | null
  generationStatus: GenerationStatus
  imageGenerationStatus: GenerationStatus
}

export interface RepurposeVariantDraft {
  text: string
  imageUrl: string | null
  imagePrompt: string | null        // The prompt n8n will use to generate the image
  hashtags: string[]
  suggestedHashtags: string[]       // From AI, not yet added
  isApproved: boolean
  isEdited: boolean                 // True if user manually edited the AI output
}

export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
  timestamp: string
}

// Webhook 1: App → n8n content repurpose workflow
export interface ContentRepurposeWebhookPayload {
  postId: string
  linkedinText: string
  platforms: Platform[]             // Which platforms to generate for
  brandVoice: {
    toneDescriptors: string[]
    writingStyle: string
    topicPillars: string[]
    avoidList: string[]
    examplePosts: string[]
  }
  hashtagBank: Array<{
    hashtag: string
    platforms: Platform[]
    topicPillar: string | null
  }>
  callbackUrl: string               // App's /api/callback/repurpose endpoint
}

// Webhook 2: App → n8n image repurpose workflow
export interface ImageRepurposeWebhookPayload {
  postId: string
  imagePrompts: Partial<Record<Platform, string>>  // Per-platform image prompts
  imageSizes: Partial<Record<Platform, { width: number; height: number }>>
  callbackUrl: string               // App's /api/callback/images endpoint
}

// Webhook 3: App → n8n publish workflow (unchanged Option A router)
export interface PublishWebhookPayload {
  platform: Platform
  text: string
  imageUrl: string | null
  hashtags: string[]
  scheduledAt: string | null
  sheetRowId: string
  postId: string
}

// n8n → App callback (after content or image generation is done)
export interface N8nCallbackPayload {
  postId: string
  status: 'done' | 'failed'
  error?: string
  // n8n writes results directly to Sheet; callback just notifies the app to re-poll
}

export interface CalendarEvent {
  id: string
  postId: string
  platform: Platform
  title: string                     // First 60 chars of text
  start: Date
  status: PostStatus
  color: string                     // Platform color hex
}

export interface GapWarning {
  platform: Platform
  lastPostDate: string
  daysGap: number
  pillarGap: string | null          // e.g. "No AI tools content in 10 days"
}
```

---

## Google Sheets schema

The spreadsheet must have a sheet named **"Posts"** with the following columns in exact order. This schema is configured once inside n8n — the app has no knowledge of column positions and never accesses the Sheet directly.

```
Column A:  post_id               (string — unique, e.g. "post_001")
Column B:  linkedin_text         (string — full post text)
Column C:  linkedin_image_url    (string or empty)
Column D:  posted_at             (ISO date string)

Each platform uses 9 columns in order: text, content_prompt, image_prompt, image_url, hashtags, status, scheduled_at, published_at, error.

- content_prompt: JSON string of { systemPrompt, userPrompt } — written by the app when the content skill executes, before the n8n webhook fires. Stored for audit, debugging, and learning system reference.
- image_prompt: the exact fal.ai generation prompt string — written by the image skill before the image webhook fires.

Column E:  twitter_text
Column F:  twitter_content_prompt  (JSON — { systemPrompt, userPrompt } from twitter-content.md skill)
Column G:  twitter_image_prompt    (fal.ai prompt string from twitter-image.md skill)
Column H:  twitter_image_url
Column I:  twitter_hashtags        (comma-separated, no # prefix)
Column J:  twitter_status          (pending/approved/scheduled/published/failed)
Column K:  twitter_scheduled_at    (ISO date string or empty)
Column L:  twitter_published_at    (ISO date string or empty)
Column M:  twitter_error           (error message or empty)

Column N:  threads_text
Column O:  threads_content_prompt
Column P:  threads_image_prompt
Column Q:  threads_image_url
Column R:  threads_hashtags
Column S:  threads_status
Column T:  threads_scheduled_at
Column U:  threads_published_at
Column V:  threads_error

Column W:  instagram_text
Column X:  instagram_content_prompt
Column Y:  instagram_image_prompt
Column Z:  instagram_image_url
Column AA: instagram_hashtags
Column AB: instagram_status
Column AC: instagram_scheduled_at
Column AD: instagram_published_at
Column AE: instagram_error

Column AF: facebook_text
Column AG: facebook_content_prompt
Column AH: facebook_image_prompt
Column AI: facebook_image_url
Column AJ: facebook_hashtags
Column AK: facebook_status
Column AL: facebook_scheduled_at
Column AM: facebook_published_at
Column AN: facebook_error

Column AO: skool_text
Column AP: skool_content_prompt
Column AQ: skool_image_prompt
Column AR: skool_image_url
Column AS: skool_hashtags
Column AT: skool_status
Column AU: skool_scheduled_at
Column AV: skool_published_at
Column AW: skool_error
```

---

## Google Sheets workflow — n8n Webhook 0 (lib/n8n-sheet.ts)

All Sheet reads and writes go through a single n8n webhook URL (`N8N_SHEET_WEBHOOK_URL`). The app sends a structured action payload; n8n handles the Sheet operation and returns the result synchronously in the HTTP response.

The app has **zero Google credentials** and **no Sheets SDK**. `googleapis` is not installed. All Sheet logic — column mapping, row lookup, batch updates, rate limit handling — lives exclusively inside n8n.

### Webhook payload structure

Every request to the Sheet webhook follows this envelope:

```typescript
interface SheetWebhookRequest {
  action: SheetAction
  payload: SheetActionPayload[SheetAction]
}

type SheetAction =
  | 'GET_ALL_POSTS'
  | 'GET_POST_BY_ID'
  | 'UPDATE_PLATFORM_VARIANT'
  | 'UPDATE_MULTIPLE_PLATFORMS'
  | 'WRITE_CONTENT_PROMPTS'
  | 'WRITE_IMAGE_PROMPTS'
  | 'UPDATE_STATUS'
```

### Actions and payloads

**GET_ALL_POSTS**
```typescript
// Request payload: none (empty object)
// Response: { posts: LinkedInPost[] }
// n8n reads all rows, maps columns to LinkedInPost[], skips rows with empty post_id
// Supports optional filters passed as payload:
{
  statusFilter?: PostStatus        // only return posts where any platform has this status
  platformFilter?: Platform        // only return posts that have content for this platform
  fromDate?: string                // ISO date — filter by posted_at
  toDate?: string                  // ISO date — filter by posted_at
}
```

**GET_POST_BY_ID**
```typescript
// Request payload:
{ postId: string }
// Response: { post: LinkedInPost | null }
```

**UPDATE_PLATFORM_VARIANT**
```typescript
// Request payload: update a single platform's columns for one post
{
  postId: string
  platform: Platform
  variant: Partial<PlatformVariant>  // only provided fields are written
}
// Response: { success: boolean }
```

**UPDATE_MULTIPLE_PLATFORMS**
```typescript
// Request payload: batch update multiple platforms at once
{
  postId: string
  variants: Partial<Record<Platform, Partial<PlatformVariant>>>
}
// Response: { success: boolean }
// n8n does a single batch update call to Sheets for all platforms at once
```

**WRITE_CONTENT_PROMPTS**
```typescript
// Request payload: write content prompts before firing content repurpose webhook
// n8n writes all platform content_prompt columns as JSON strings
{
  postId: string
  prompts: Partial<Record<Platform, string>>  // JSON.stringify({ systemPrompt, userPrompt }) per platform
}
// Response: { success: boolean }
```

**WRITE_IMAGE_PROMPTS**
```typescript
// Request payload: write image prompts before firing image repurpose webhook
// n8n writes all platform image_prompt columns
{
  postId: string
  prompts: Partial<Record<Platform, string>>  // fal.ai prompt string per platform
}
// Response: { success: boolean }
```

**UPDATE_STATUS**
```typescript
// Request payload: lightweight status-only update (used by publish workflow callbacks)
{
  postId: string
  platform: Platform
  status: PostStatus
  publishedAt?: string   // set when status = 'published'
  error?: string         // set when status = 'failed'
}
// Response: { success: boolean }
```

### lib/n8n-sheet.ts — app-side helper

This file wraps all Sheet webhook calls with typed functions. Every function POSTs to `N8N_SHEET_WEBHOOK_URL` with the action envelope and returns the typed response.

```typescript
// All functions follow this pattern:
async function sheetRequest<T>(action: SheetAction, payload: object): Promise<T> {
  const response = await axios.post(process.env.N8N_SHEET_WEBHOOK_URL, { action, payload }, { timeout: 15000 })
  if (!response.data?.success && action !== 'GET_ALL_POSTS' && action !== 'GET_POST_BY_ID') {
    throw new Error(`Sheet operation ${action} failed`)
  }
  return response.data
}

export async function getAllPosts(filters?: GetAllPostsFilters): Promise<LinkedInPost[]>
export async function getPostById(postId: string): Promise<LinkedInPost | null>
export async function updatePlatformVariant(postId: string, platform: Platform, variant: Partial<PlatformVariant>): Promise<void>
export async function updateMultiplePlatforms(postId: string, variants: Partial<Record<Platform, Partial<PlatformVariant>>>): Promise<void>
export async function writeContentPrompts(postId: string, prompts: Partial<Record<Platform, string>>): Promise<void>  // prompts = JSON.stringify({ systemPrompt, userPrompt }) per platform
export async function writeImagePrompts(postId: string, prompts: Partial<Record<Platform, string>>): Promise<void>
export async function updateStatus(postId: string, platform: Platform, status: PostStatus, meta?: { publishedAt?: string; error?: string }): Promise<void>
```

Timeout is 15 seconds for read operations (Sheet may have many rows), 10 seconds for writes.

### n8n Workflow 0 — Sheet operations spec

**Trigger**: Webhook node (POST), responds synchronously (not fire-and-forget).

**Important**: Unlike the other three workflows, this webhook must respond with data — n8n should NOT use "Respond to Webhook" immediately. It must complete the Sheet operation first, then respond.

**Steps**:
1. Receive `{ action, payload }` from app
2. Switch node on `action` value — 7 branches
3. Each branch executes the appropriate Google Sheets node operation:
   - `GET_ALL_POSTS` → Read all rows from "Posts" sheet, apply filters if present, map to `LinkedInPost[]` structure using a Code node, return `{ posts: [...] }`
   - `GET_POST_BY_ID` → Read all rows, find by `post_id` column, return `{ post: {...} }` or `{ post: null }`
   - `UPDATE_PLATFORM_VARIANT` → Update only the specific platform columns for the matching row. Use a Code node to map `PlatformVariant` fields to the correct column letters.
   - `UPDATE_MULTIPLE_PLATFORMS` → Same as above but loops over all provided platforms in a single batch update
   - `WRITE_IMAGE_PROMPTS` → Write each platform's `image_prompt` column value for the matching row
   - `UPDATE_STATUS` → Write `status`, optionally `published_at` and `error` columns for the matching platform
4. All branches end at a "Respond to Webhook" node returning the result as JSON
5. On any error: return `{ success: false, error: "message" }` with HTTP 200 (not 500 — the app handles all error checking from the response body)

**Column mapping in n8n**: Use a Code node that defines a constant mapping object:
```javascript
const COLUMN_MAP = {
  twitter:   { text: 'E', contentPrompt: 'F', imagePrompt: 'G', imageUrl: 'H', hashtags: 'I', status: 'J', scheduledAt: 'K', publishedAt: 'L', error: 'M' },
  threads:   { text: 'N', contentPrompt: 'O', imagePrompt: 'P', imageUrl: 'Q', hashtags: 'R', status: 'S', scheduledAt: 'T', publishedAt: 'U', error: 'V' },
  instagram: { text: 'W', contentPrompt: 'X', imagePrompt: 'Y', imageUrl: 'Z', hashtags: 'AA', status: 'AB', scheduledAt: 'AC', publishedAt: 'AD', error: 'AE' },
  facebook:  { text: 'AF', contentPrompt: 'AG', imagePrompt: 'AH', imageUrl: 'AI', hashtags: 'AJ', status: 'AK', scheduledAt: 'AL', publishedAt: 'AM', error: 'AN' },
  skool:     { text: 'AO', contentPrompt: 'AP', imagePrompt: 'AQ', imageUrl: 'AR', hashtags: 'AS', status: 'AT', scheduledAt: 'AU', publishedAt: 'AV', error: 'AW' },
}
```
This mapping is referenced by all write branches so column positions are defined in exactly one place inside n8n.

---

## Platform rules (lib/platform-rules.ts)

This file is the single source of truth for all platform-specific constraints. Every prompt builder and UI component reads from here.

```typescript
export const PLATFORM_RULES = {
  twitter: {
    label: 'Twitter / X',
    color: '#000000',
    maxChars: 280,
    threadEnabled: true,            // Can generate as thread if over 280 chars
    maxThreadTweets: 10,
    imageAspectRatio: '16:9',       // or '1:1'
    imageWidth: 1200,
    imageHeight: 675,
    hashtagCount: { min: 1, max: 3 },
    tone: 'punchy, hook-first, no filler words, each tweet self-contained',
    formatRules: 'Start with a bold hook. Use short punchy sentences. If thread, number tweets 1/ 2/ etc. No corporate language.',
    avoidPatterns: ['Let me know your thoughts', 'Comment below', 'long sentences over 20 words'],
  },
  threads: {
    label: 'Threads',
    color: '#000000',
    maxChars: 500,
    threadEnabled: false,
    maxThreadTweets: null,
    imageAspectRatio: '1:1',
    imageWidth: 1080,
    imageHeight: 1080,
    hashtagCount: { min: 0, max: 5 },
    tone: 'conversational, casual, like texting a smart friend',
    formatRules: 'Write as if talking to someone directly. Short paragraphs. Casual contractions ok. Can end with a soft question.',
    avoidPatterns: ['hashtag spam', 'overly formal language'],
  },
  instagram: {
    label: 'Instagram',
    color: '#E1306C',
    maxChars: 2200,
    threadEnabled: false,
    maxThreadTweets: null,
    imageAspectRatio: '1:1',
    imageWidth: 1080,
    imageHeight: 1080,
    hashtagCount: { min: 5, max: 15 },
    tone: 'story-driven, personal, visual-first mindset',
    formatRules: 'Lead with a strong first line (visible before "more"). Tell a mini story. Put hashtags at the very end, separated by line breaks. Use line breaks generously for readability.',
    avoidPatterns: ['link in bio (no links work)', 'excessive emojis'],
  },
  facebook: {
    label: 'Facebook',
    color: '#1877F2',
    maxChars: 63206,
    threadEnabled: false,
    maxThreadTweets: null,
    imageAspectRatio: '16:9',
    imageWidth: 1200,
    imageHeight: 630,
    hashtagCount: { min: 0, max: 3 },
    tone: 'warm, community-oriented, slightly longer form ok',
    formatRules: 'Can be longer than other platforms. End with a direct question to drive comments. Paragraphs over bullet points. Personal tone.',
    avoidPatterns: ['aggressive CTAs', 'spammy hashtags'],
  },
  skool: {
    label: 'Skool Community',
    color: '#00A693',
    maxChars: 10000,
    threadEnabled: false,
    maxThreadTweets: null,
    imageAspectRatio: '16:9',
    imageWidth: 1200,
    imageHeight: 675,
    hashtagCount: { min: 0, max: 0 },  // No hashtags on Skool
    tone: 'community discussion starter, teaching mindset, inviting participation',
    formatRules: 'Reframe as a discussion prompt or lesson for the community. Start with "I want to share..." or a direct insight. End with a question that invites replies. No hashtags.',
    avoidPatterns: ['sales language', 'hashtags', 'external links without context'],
  },
} as const
```

---

## Brand voice system (lib/brand-voice.ts)

- Store brand voice profile at `config/brand-voice.json`
- `getBrandVoice(): Promise<BrandVoiceProfile>` — Read and parse the JSON file. Return defaults if file doesn't exist.
- `saveBrandVoice(profile: BrandVoiceProfile): Promise<void>` — Write to JSON file.
- `buildBrandVoiceSystemPrompt(profile: BrandVoiceProfile): string` — Construct the system prompt fragment injected into every Claude call. Format:

```
You are repurposing content for a personal brand with the following voice profile:

TONE: [toneDescriptors joined by ", "]
WRITING STYLE: [writingStyle]
TOPIC PILLARS: [topicPillars joined by ", "]
WORDS AND PHRASES TO NEVER USE: [avoidList joined by ", "]

Here are example posts from this brand that represent the ideal voice:
---
[examplePosts[0]]
---
[examplePosts[1]]
---
[...etc]
---

Always match this voice. Never deviate from the avoid list. Ensure the content feels authored by this specific person, not generic AI.
```

Default brand voice (used before user configures):
```json
{
  "toneDescriptors": ["clear", "practical"],
  "writingStyle": "Writes in a direct, no-nonsense way. Gets to the point fast. Uses real examples over theory.",
  "topicPillars": [],
  "avoidList": ["synergy", "leverage", "game-changer", "thought leader"],
  "examplePosts": [],
  "lastUpdated": ""
}
```

---

## Hashtag bank (lib/hashtag-bank.ts)

- Store at `config/hashtag-bank.json`
- `getHashtagBank(): Promise<HashtagBankEntry[]>`
- `addHashtag(entry: Omit<HashtagBankEntry, 'id' | 'usageCount' | 'lastUsed'>): Promise<HashtagBankEntry>`
- `removeHashtag(id: string): Promise<void>`
- `incrementUsage(hashtag: string): Promise<void>` — Called when a hashtag is used in an approved post
- `getRelevantHashtags(platform: Platform, topicPillar: string | null, limit: number): Promise<HashtagBankEntry[]>` — Filter by platform and optionally by topic pillar, sorted by usage count descending

---

## n8n webhook layer (lib/n8n.ts)

This file contains the three async webhook fire functions (content repurpose, image repurpose, publish). All Sheet operations are in `lib/n8n-sheet.ts` (see above). The app never calls Claude, fal.ai, or Google Sheets directly — everything goes through n8n.

### fireContentRepurposeWebhook

```typescript
async function fireContentRepurposeWebhook(params: {
  post: LinkedInPost
  platforms: Platform[]
  brandVoice: BrandVoiceProfile
  hashtagBank: HashtagBankEntry[]
}): Promise<{ success: boolean; error?: string }>
```

Builds a `ContentRepurposeWebhookPayload` and POSTs to `process.env.N8N_CONTENT_REPURPOSE_WEBHOOK_URL`.

The payload includes:
- `postId`, `linkedinText`, `platforms`
- Full `brandVoice` object (n8n uses this to build the Claude system prompt — the app ships the entire brand voice so n8n has everything it needs without a separate config lookup)
- Flattened `hashtagBank` array (only fields n8n needs: hashtag, platforms, topicPillar)
- `callbackUrl`: `${process.env.NEXT_PUBLIC_APP_URL}/api/callback/repurpose`

After firing: update all selected platform statuses to `generating_text` in the Sheet immediately via `updateMultiplePlatforms`.

Timeout: 5 seconds (n8n should respond with 200 immediately and process async — if it takes longer than 5s to acknowledge, treat as failure).

### fireImageRepurposeWebhook

```typescript
async function fireImageRepurposeWebhook(params: {
  post: LinkedInPost
  imagePrompts: Partial<Record<Platform, string>>
}): Promise<{ success: boolean; error?: string }>
```

Builds an `ImageRepurposeWebhookPayload` and POSTs to `process.env.N8N_IMAGE_REPURPOSE_WEBHOOK_URL`.

The payload includes:
- `postId`
- `imagePrompts`: object mapping each platform to its image generation prompt. The app generates these prompts by calling Claude directly (one fast call) before firing the webhook — prompts are derived from the post text and platform context.
- `imageSizes`: object mapping each platform to `{ width, height }` sourced from `PLATFORM_RULES`
- `callbackUrl`: `${process.env.NEXT_PUBLIC_APP_URL}/api/callback/images`

After firing: update all platform image statuses to `generating_images` in Sheet.

### firePublishWebhook

```typescript
async function firePublishWebhook(payload: PublishWebhookPayload): Promise<{ success: boolean; error?: string }>
```

POSTs to `process.env.N8N_PUBLISH_WEBHOOK_URL`. Timeout: 10 seconds. On success, update Sheet status to `scheduled`. On failure, keep status as `approved` and return error.

---

## Image prompt generation (lib/anthropic.ts)

The app still calls Claude directly in two narrow cases: the chat sidebar (interactive edits) and generating image prompts before firing the image webhook.

### generateImagePrompts

```typescript
async function generateImagePrompts(params: {
  linkedinText: string
  brandVoice: BrandVoiceProfile
  platforms: Platform[]
}): Promise<Partial<Record<Platform, string>>>
```

Single Claude call (not per-platform) that returns all image prompts at once. Prompt:

```
Given this LinkedIn post, generate image generation prompts for each platform listed.
Each prompt should describe a professional, clean image that visually represents the post's key idea.
No text overlays in the image. Match the brand tone: [toneDescriptors].

Post: [linkedinText]

Platforms: [platforms]

Respond in JSON only:
{
  "twitter": "prompt for Twitter image",
  "instagram": "prompt for Instagram image",
  ...
}
```

This runs before `fireImageRepurposeWebhook` so n8n receives ready-to-use prompts.

### chatWithAI

```typescript
async function chatWithAI(params: {
  messages: ChatMessage[]
  currentVariantText: string
  platform: Platform
  brandVoice: BrandVoiceProfile
  instruction: string
}): Promise<{ updatedText: string; explanation: string }>
```

Called from `/api/chat`. System: brand voice prompt + platform rules. Returns `{ updatedText, explanation }` as JSON. This is the only synchronous Claude call that modifies post content — it runs directly in the app because it needs to be interactive and immediate.

### generateHashtagSuggestions

```typescript
async function generateHashtagSuggestions(params: {
  postText: string
  platform: Platform
  brandVoice: BrandVoiceProfile
  existingHashtags: string[]
  count: number
}): Promise<string[]>
```

Called from `/api/hashtags`. Returns suggested hashtags as a JSON array of strings without # prefix.

---

## n8n workflow specifications

Document these in the README so you can build the n8n workflows correctly.

### Workflow 1 — Content repurpose

**Trigger**: Webhook node (POST)
**Expected payload**: `ContentRepurposeWebhookPayload`

Steps:
1. Webhook receives payload, responds with `200 OK` immediately (before processing — use n8n's "Respond to Webhook" node early to avoid timeout)
2. For each platform in `payload.platforms`, run a Claude API HTTP Request node in parallel (use n8n's Split In Batches or parallel branches)
3. Each Claude call uses:
   - Model: `claude-sonnet-4-20250514`
   - System prompt: built from `payload.brandVoice` + platform rules (hardcode platform rules in n8n or use a Code node to derive them by platform name)
   - User prompt: `"Repurpose the following LinkedIn post for [platform]: [payload.linkedinText]"`
   - Response format: JSON `{ text, hashtags, imagePrompt }` (imagePrompt is not used in this workflow but returned for reference)
4. After all platforms complete: Google Sheets node — batch update all platform text + hashtag columns for `payload.postId` row
5. Set all updated platform statuses to `repurposed` in the Sheet
6. HTTP Request node: POST to `payload.callbackUrl` with body `{ postId: payload.postId, status: "done" }`
7. On any error: POST to `payload.callbackUrl` with `{ postId, status: "failed", error: "..." }` and update Sheet status to `failed`

### Workflow 2 — Image repurpose

**Trigger**: Webhook node (POST)
**Expected payload**: `ImageRepurposeWebhookPayload`

Steps:
1. Webhook responds with `200 OK` immediately
2. For each platform in `payload.imagePrompts`, run a fal.ai HTTP Request node in parallel
3. Each fal.ai call:
   - URL: `https://fal.run/fal-ai/flux/schnell`
   - Auth: Bearer token from n8n credential
   - Body: `{ prompt: payload.imagePrompts[platform], image_size: { width, height } }` from `payload.imageSizes[platform]`
4. After all images complete: Google Sheets node — batch update all platform image URL columns for `payload.postId` row
5. HTTP Request node: POST to `payload.callbackUrl` with `{ postId, status: "done" }`
6. On error: POST to callback with `{ postId, status: "failed", error: "..." }`, update Sheet

### Workflow 3 — Publish (Option A router — unchanged)

**Trigger**: Webhook node (POST)
**Expected payload**: `PublishWebhookPayload`

Steps:
1. Webhook responds `200 OK` immediately
2. Switch node on `payload.platform`
3. Each branch: platform-specific publish API call
4. Google Sheets node: update `[platform]_status` to `published`, set `[platform]_published_at` to current timestamp
5. On error: update Sheet `[platform]_status` to `failed`, set `[platform]_error` to error message

---

## Callback handling (app side)

### POST /api/callback/repurpose

Called by n8n Workflow 1 when text generation is complete.

```typescript
// Request body: N8nCallbackPayload
// 1. Validate the postId exists
// 2. Call getPostById(postId) from lib/n8n-sheet.ts to re-fetch the post
//    (n8n has already written results to the Sheet before calling this callback)
// 3. Signal the UI to refresh (polling will pick it up on next cycle)
// 4. Return 200 OK
```

Since Next.js API routes can't push to the browser, use one of these two patterns (implement whichever is simpler):

**Option A — Polling (simpler)**: The UI polls `/api/posts/[id]` every 3 seconds while `generationStatus` is `generating_text` or `generating_images`. The callback endpoint just returns 200 and the UI picks up the changes on the next poll cycle.

**Option B — Server-Sent Events**: Implement an `/api/events/[postId]` SSE endpoint. Callback writes to an in-memory event emitter. UI subscribes to SSE and updates instantly. More complex but better UX.

**Default to Option A (polling)**. Note in a code comment that Option B can replace it for better UX.

### POST /api/callback/images

Same pattern as above, but for image generation completion. Re-fetches the post from Sheets and triggers a UI refresh.

---

## API routes

### POST /api/trigger/repurpose

Request body:
```typescript
{
  postId: string
  platforms: Platform[]    // default: all 5 if omitted
}
```

1. Call `getPostById(postId)` from `lib/n8n-sheet.ts` (goes to n8n Sheet webhook)
2. Load brand voice + hashtag bank from local config files
3. Call `fireContentRepurposeWebhook`
4. Return `{ success: boolean; error?: string }`

This route is called both automatically (on post import detection) and manually (user clicks "Repurpose").

**Auto-trigger logic**: On the dashboard page, when posts are loaded and a post has all platform statuses as `pending` AND it was posted within the last 7 days, automatically call this endpoint. Show a subtle "Auto-repurposing..." indicator. The auto-trigger fires only once per post (track in Zustand — if `generationStatus` is anything other than `idle`, skip).

### POST /api/trigger/images

Request body:
```typescript
{
  postId: string
  platforms: Platform[]
}
```

1. Call `getPostById(postId)` from `lib/n8n-sheet.ts`
2. Load brand voice from local config
3. Call `generateImagePrompts` (Claude direct — fast single call)
4. Call `writeImagePrompts(postId, prompts)` from `lib/n8n-sheet.ts` — persists prompts to Sheet via n8n before anything else
5. Call `fireImageRepurposeWebhook` with the generated prompts
6. Return `{ success: boolean; error?: string }`

Image generation is always triggered manually — the user clicks "Generate images" after reviewing the text variants. It is never auto-triggered.

### POST /api/hashtags

Request body:
```typescript
{
  postText: string
  platform: Platform
  existingHashtags: string[]
}
```

Calls `generateHashtagSuggestions` directly (Claude) and returns `{ suggestions: string[] }`.

### POST /api/chat

Request body:
```typescript
{
  messages: ChatMessage[]
  currentVariantText: string
  platform: Platform
  instruction: string
}
```

Calls `chatWithAI` directly (Claude) and returns `{ updatedText: string; explanation: string }`.

### POST /api/publish

Request body:
```typescript
{
  postId: string
  platform: Platform
  scheduledAt: string | null
}
```

1. Call `getPostById(postId)` from `lib/n8n-sheet.ts` to fetch current variant
2. Validate: text not empty, status is `approved`
3. Build `PublishWebhookPayload`
4. Call `firePublishWebhook`
5. Call `updateStatus(postId, platform, 'scheduled')` or `updateStatus(postId, platform, 'failed', { error })` via `lib/n8n-sheet.ts`
6. Return `{ success: boolean; error?: string }`

### GET /api/posts

Calls `getAllPosts(filters)` from `lib/n8n-sheet.ts` which fires a `GET_ALL_POSTS` action to the n8n Sheet webhook. Supports query params:
- `?status=pending` — filter by any platform having this status
- `?platform=twitter` — filter posts that have content for this platform
- `?from=YYYY-MM-DD&to=YYYY-MM-DD` — filter by `postedAt` range

Filters are passed in the Sheet webhook payload so n8n applies them server-side before returning data.

### PATCH /api/posts/[id]

Request body: `Partial<LinkedInPost>` — update specific platform variants (used when user manually edits text in the UI, or when rescheduling from the calendar).

Calls `updateMultiplePlatforms` or `updatePlatformVariant` from `lib/n8n-sheet.ts` depending on how many platforms are being updated.

### GET/POST /api/brand-voice

GET returns current `BrandVoiceProfile`. POST saves and returns updated profile.

---

## UI — Dashboard page

**Route**: `/dashboard`

**Layout**: Full-width table with sticky header. Top bar has filter controls.

**Search bar** (above filter controls):
- Full-text search across the original LinkedIn post text AND all repurposed platform text fields
- Case-insensitive substring match, client-side
- Empty state message shows the search query when no posts match

**Filter controls** (horizontal row below search bar):
- Platform filter: pill toggles for All / Twitter / Threads / Instagram / Facebook / Skool
- Status filter: All / Pending / Approved / Scheduled / Published
- Date range picker
- Clear button resets all filters AND the search query

**Table columns** (all sortable except Actions):
- Date (posted_at, formatted as "Mar 12") — **default sort: latest first (descending)**
- LinkedIn post (first 80 chars, expandable on click)
- Twitter status badge
- Threads status badge
- Instagram status badge
- Facebook status badge
- Skool status badge
- Actions: "Repurpose" button, "View" button (not sortable)

**Column sorting**:
- Click any column header (except Actions) to sort by that column
- Click the same header again to toggle direction (↑ ascending / ↓ descending)
- Click a different header to sort by that column (resets to descending)
- Sort indicators: active column shows ↑ or ↓; inactive columns show ↕
- Date → sorts by `postedAt` ISO string
- LinkedIn Post → sorts alphabetically by `linkedinText`
- Platform columns → sorts by status priority: published > approved > scheduled > pending > failed

**Status badge colors**:
- `pending` → gray
- `approved` → blue
- `scheduled` → amber
- `published` → green
- `failed` → red

**Clicking a row** opens a slide-over panel showing:
- Full LinkedIn post text
- Per-platform: generated text, image preview, hashtags, status, scheduled time
- Quick approve/reject buttons per platform
- "Edit in Repurpose" button that navigates to `/repurpose?postId=[id]`

**Stats bar** at top of dashboard:
- Total posts
- Total repurposed (at least one platform has non-pending status)
- Published this week
- Pending approval

---

## UI — Repurpose page

**Route**: `/repurpose?postId=[id]`

**Layout**: Three-column layout.

**Column 1 — Source post** (left, ~25% width):
- LinkedIn post text (read-only, scrollable)
- Original image if available
- Post date
- "Repurpose text" button → fires `POST /api/trigger/repurpose`
- "Generate images" button → fires `POST /api/trigger/images` (enabled only after text variants exist)
- Platform checklist (select which platforms to include)
- Generation status indicators: "Text: generating..." / "Images: generating..." / "Done ✓"

**Column 2 — Platform cards** (center, ~50% width):
- One card per selected platform, stacked vertically
- **While text is generating** (n8n workflow running): show skeleton card with animated pulse and label "Waiting for n8n..." — the app is polling the Sheet in the background every 3 seconds
- **After text arrives** (polling detects non-null text in Sheet): skeleton is replaced with the real card
- Each card contains:
  - Platform icon + label
  - Editable textarea with character count (shows red if over limit)
  - Character count indicator (e.g. "247 / 280") — turns red when over limit
  - Image section: skeleton while generating → image preview when done → "Regenerate image" button
  - Hashtags section: chips showing selected hashtags + "Suggest more" button
  - Suggested hashtags appear as faded chips you can click to add
  - Approve toggle (green checkmark when approved)
  - Status badge
  - "Schedule" datetime picker (appears after approving)
  - "Publish now" button (appears after approving)
- When text is edited by user, mark card with a subtle "edited" indicator

**Generation status panel** (`GenerationStatusPanel` component) — shown between Column 1 and Column 2 while any generation is in progress:
- Shows two status rows: "Text generation" and "Image generation"
- Each row: icon (spinner/check/error) + label + elapsed time
- Text: "n8n is generating platform variants via Claude..."
- Images: "n8n is generating images via fal.ai..."
- Disappears once both are done

**Column 3 — AI chat sidebar** (right, ~25% width):
- Chat interface showing message history
- Input box at bottom: "Edit the Twitter version to be more provocative"
- Chat calls `/api/chat` directly (synchronous Claude call — not via n8n)
- Chat is context-aware: references the currently focused platform card
- Clicking any platform card focuses it — chat context switches to that platform
- Quick action chips above input: "Make shorter", "Add a hook", "More casual", "Add emoji"
- After AI responds and updates the text, show diff highlighting (old text struck through, new text highlighted)
- Note: chat sidebar is only enabled after text variants have arrived (disabled with message "Waiting for text generation to complete..." while n8n is running)

**Top bar actions**:
- "Approve all" — marks all generated platforms as approved
- "Publish all approved" — fires publish webhooks for all approved platforms
- Loading states show which specific workflow is running

**Generation flow (auto + manual)**:
1. User lands on page with a `postId`
2. App checks Sheet for existing variants
3. **If all platforms are `pending`** and post is within 7 days: auto-trigger `POST /api/trigger/repurpose`. Show status panel immediately.
4. **If variants exist** (any non-pending status): show existing variants. "Repurpose text" button becomes "Re-generate text".
5. While n8n runs: app polls `/api/posts/[id]` every 3 seconds. When Sheet has new data, update UI.
6. After text variants appear: "Generate images" button becomes active. User clicks it → fires `POST /api/trigger/images`. Image skeletons appear. Same polling pattern.
7. User reviews, edits via chat if needed, approves, publishes.

---

## UI — Calendar page

**Route**: `/calendar`

**Component**: FullCalendar with `dayGridMonth` and `timeGridWeek` views. Toggle between views.

**Events**:
- Each scheduled/published post variant = one event
- Event color = platform color (from `PLATFORM_RULES[platform].color`)
- Event title = `[PlatformIcon] [first 40 chars of text]`
- Multiple events on same day stack vertically

**Click an event** → popover showing:
- Platform + post date
- Full text preview
- Current status
- Image thumbnail
- "Edit" button → navigates to repurpose page
- "Reschedule" datetime picker → updates Sheet + n8n queue via PATCH
- "Cancel scheduled" button → updates Sheet status back to `approved`

**Gap warning banner**:
- Below the calendar, show a list of `GapWarning` objects
- Gap detection: for each platform, if the last scheduled/published post was more than 3 days ago AND there's no upcoming post in the next 3 days, show a warning
- Topic pillar gap: scan post texts for topic pillar keywords. If a pillar hasn't appeared in posts in the last 10 days, flag it.
- Warning card: "No Twitter posts in 5 days — [Repurpose a post]"

---

## UI — Settings page (Brand voice profile)

**Route**: `/settings`

**Layout**: Tabbed interface: "Brand Voice" tab and "Hashtag Bank" tab.

### Brand Voice tab

Form with these sections:

**Tone descriptors**
- Tag input — type a word and press Enter to add
- Pre-suggestions as pills: "direct", "practical", "conversational", "educational", "inspiring", "no-fluff", "analytical", "storytelling"
- Max 8 descriptors

**Writing style**
- Textarea: "Describe your writing style in your own words..."
- Placeholder: "e.g. Gets to the point fast. Uses real examples over theory. Short sentences. First-person always."
- Max 500 chars

**Topic pillars**
- Tag input — type and press Enter
- These feed into hashtag intelligence and gap detection
- Max 6 pillars

**Words / phrases to avoid**
- Tag input
- Pre-suggestions: "synergy", "game-changer", "leverage", "thought leader", "circle back", "touch base"
- Unlimited

**Example posts**
- Up to 5 text areas
- Label: "Paste a LinkedIn post that sounds exactly like you"
- Add/remove buttons
- Character count per post

**Save button**:
- On save: update `config/brand-voice.json`
- Show toast: "Brand voice saved — all future repurposing will use this profile"
- Show warning if no example posts have been added: "Adding example posts significantly improves repurposing quality"

### Hashtag Bank tab

**Add hashtag form**:
- Hashtag input (without #)
- Platform checkboxes (which platforms to use this on)
- Topic pillar dropdown (from configured pillars)
- Add button

**Hashtag table**:
- Columns: Hashtag | Platforms | Topic pillar | Usage count | Last used | Delete
- Sortable by usage count
- Filter by platform
- Bulk import: paste comma-separated hashtags

---

## UI — Design system

**Color palette**:
```css
--bg-primary: #0A0A0A
--bg-secondary: #111111
--bg-card: #161616
--bg-hover: #1C1C1C
--border: #2A2A2A
--text-primary: #F5F5F5
--text-secondary: #888888
--text-muted: #555555
--accent: #7C3AED          /* Purple — primary actions */
--accent-hover: #6D28D9
--success: #10B981
--warning: #F59E0B
--error: #EF4444
--info: #3B82F6
```

**Dark-first design** — The entire app uses a dark theme. No light mode toggle needed.

**Typography**:
- Font: `Geist` (from `next/font/google`) for UI
- Mono: `Geist Mono` for post text previews and code

**Component conventions**:
- Cards: `bg-card` background, `border` border, `rounded-xl`, `p-4`
- Buttons: Primary = purple fill; Ghost = transparent with border; Destructive = red
- Status badges: Small pill with colored dot + label
- Platform icons: Custom SVG components per platform (Twitter bird, Instagram gradient, etc.)
- All loading states use skeleton placeholders, not spinners (except for in-progress AI calls which use an animated typing indicator)

---

## Error handling

Handle these scenarios gracefully throughout:

1. **Sheet webhook failure** — If the n8n Sheet webhook (`N8N_SHEET_WEBHOOK_URL`) returns an error or times out, show banner "Data sync unavailable — n8n Sheet workflow not responding" and let the app continue with cached Zustand state. Retry the failed call after 30 seconds. Never crash or show a blank screen — cached data is better than nothing.
2. **n8n content repurpose webhook failure** — Show toast: "Text generation could not be triggered — [Retry]". Keep platform statuses as `pending`. Retry button re-fires `POST /api/trigger/repurpose`.
3. **n8n image repurpose webhook failure** — Show toast: "Image generation could not be triggered — [Retry]". Retry button re-fires `POST /api/trigger/images`. Never block text repurposing.
4. **n8n callback reports failure** — When `/api/callback/repurpose` or `/api/callback/images` receives `status: "failed"`, update the UI status panel to show "Generation failed: [error]" with a Retry button. Update Sheet status to `failed`.
5. **n8n publish webhook failure** — Show toast error. Keep status as `approved` in Sheet. Show "Retry publish" button.
6. **Polling timeout** — If polling runs for more than 5 minutes without the Sheet updating, stop polling and show warning: "Generation is taking longer than expected — check your n8n workflow." with a manual "Refresh" button.
7. **Character limit exceeded** — Warn visually in the platform card but still allow approval. User may want to manually trim.
8. **Empty brand voice** — Show a persistent banner on the repurpose page: "Your brand voice profile is empty — [Set it up] for better results." This also means n8n will receive empty brand voice fields — acceptable, it will just generate without brand constraints.
9. **Sheet row not found** — Show error and offer to refresh posts from Sheet.
10. **Claude API failure (chat / hashtags)** — These are direct Claude calls from the app. Show inline error in the chat sidebar or hashtag panel with a Retry option.

---

## Key behaviors and edge cases

1. **Regenerate single platform** — Each platform card has a "Re-generate" button. This fires `POST /api/trigger/repurpose` with `platforms: [thisPlatform]` only. Only that card goes into skeleton/polling mode — others are unaffected.

2. **Regenerate single image** — Each platform card has a "Re-generate image" button. This fires `POST /api/trigger/images` with `platforms: [thisPlatform]` and the existing image prompt (or re-generates the prompt first). Only that card's image goes into skeleton mode.

3. **Partial approval** — User can approve only 2 of 5 platforms and publish just those. Unapproved platforms stay as drafts.

4. **Manual edit detection** — If user edits text directly in a platform card textarea, set `isEdited: true` on that variant. Show a subtle indicator. If user then clicks "Re-generate", show confirmation: "This will overwrite your manual edits. Continue?"

5. **Twitter thread detection** — If generated Twitter text exceeds 280 chars, automatically split into a numbered thread (1/, 2/, etc.) and show each tweet as a separate block within the Twitter card.

6. **Skool has no hashtags** — When platform is Skool, hide the hashtag section entirely. The brand voice payload sent to n8n should include a note in the platform context that Skool does not use hashtags.

7. **Schedule time validation** — Scheduled time must be at least 15 minutes in the future. Show validation error if not.

8. **Duplicate prevention** — Before firing the publish webhook, check if current Sheet status is already `scheduled` or `published`. If so, show confirmation: "This post is already scheduled for [platform]. Publish again?"

9. **Image URL storage** — Images generated by fal.ai (via n8n) are stored as URLs in the Sheet. Add a comment in the code noting these URLs may expire; a future improvement is to have n8n upload them to permanent storage (Cloudflare R2, Google Drive, etc.) before writing to the Sheet.

10. **First-run experience** — If `config/brand-voice.json` doesn't exist OR `examplePosts` is empty, redirect to `/settings` on first visit with a welcome modal: "Before repurposing, let's set up your brand voice. This profile gets sent to n8n and is used by Claude to match your voice."

11. **Auto-trigger safeguard** — Auto-trigger only fires if: (a) all platforms are `pending`, (b) post is within last 7 days, (c) `generationStatus` in Zustand store is `idle` for this post. This prevents double-triggering if the user navigates away and back.

12. **n8n webhook URL validation on startup** — On app start, check that all four `N8N_*_WEBHOOK_URL` env vars are set (`N8N_SHEET_WEBHOOK_URL`, `N8N_CONTENT_REPURPOSE_WEBHOOK_URL`, `N8N_IMAGE_REPURPOSE_WEBHOOK_URL`, `N8N_PUBLISH_WEBHOOK_URL`). If any are missing, show a persistent banner specifying which URL is missing and what feature it blocks. A missing `N8N_SHEET_WEBHOOK_URL` disables the entire app since no data can load.

13. **Keyboard shortcuts**:
    - `Cmd+Enter` → Approve focused platform card
    - `Cmd+R` → Re-generate focused platform card (shows confirmation if edited)
    - `Cmd+S` → Save settings form
    - `Escape` → Close slide-over / popover

---

## README.md content

Generate a README with:
1. Project overview and architecture summary (app = thin UI + orchestrator, n8n = AI + publishing engine)
2. Prerequisites (Node 18+, n8n instance running, API keys needed)
3. Setup steps (clone, install, configure .env, run dev)
4. How to set up Google Sheets — create the spreadsheet, set column headers, share with n8n service account (credentials live only in n8n, not in the app)
5. How to configure n8n — four workflows to create: Sheet operations (Workflow 0), content repurpose (Workflow 1), image repurpose (Workflow 2), publish (Workflow 3). For each: webhook URL to copy into .env.local, expected payload structure, what it writes to the Sheet, callback URL format.
6. n8n workflow specs summary (one paragraph per workflow: input payload fields, Sheet columns written, callback format, error handling)
7. First-run guide (set brand voice first, verify n8n workflows are live via test endpoint, then import posts)
8. Platform API setup notes (which platforms need what credentials in n8n — Twitter API v2, Facebook/Instagram Graph API, Threads API, Skool)
9. Content store overview — what the content/ folder is, how files are named, how to read them, and why git tracking is recommended
9b. Auto-documentation system — how CHANGELOG.md works, what triggers doc sync, how to check doc freshness via the dashboard, and the mandatory Claude Code instruction
10. AOS overview — what SOUL.md, Heartbeat.md, memory files, and skills files are, where they live, and how the learning system works
10. How to set up the cron schedule — CRON_SECRET, CRON_SCHEDULE env var, and how to point an external scheduler (Vercel Cron, system crontab, or n8n Schedule node) to POST /api/cron

---


---


---

---

---

## Platform skills — prompt factories for content and image repurposing

Each platform has two dedicated skill files: one for content repurposing and one for image repurposing. These skills are **prompt factories** — they read source material, learnings, and platform rules, then produce a structured prompt payload. They do not call Claude or fal.ai directly. n8n receives the payload and executes the actual API calls.

This separation means:
- Skills are human-readable Markdown — you can read, edit, and understand exactly what prompt any platform will receive
- n8n handles all external API complexity and retries
- Prompts are consistent, versioned, and improvable independently of the execution layer
- The same skill file is read both when generating prompts AND when the docs system documents what each platform does

---

### Skills directory structure

```
skills/
├── repurpose.md                          # Master repurpose runbook (orchestrates all platform skills)
├── cron.md                               # Cron skill
└── platforms/
    ├── twitter-content.md                # Twitter/X content prompt factory
    ├── twitter-image.md                  # Twitter/X image prompt factory
    ├── threads-content.md                # Threads content prompt factory
    ├── threads-image.md                  # Threads image prompt factory
    ├── instagram-content.md              # Instagram content prompt factory
    ├── instagram-image.md                # Instagram image prompt factory
    ├── facebook-content.md               # Facebook content prompt factory
    ├── facebook-image.md                 # Facebook image prompt factory
    ├── skool-content.md                  # Skool content prompt factory
    └── skool-image.md                    # Skool image prompt factory
```

---

### Content skill — output contract

Every content skill file, when executed by `/api/skills/platform-prompt`, produces this structured object:

```typescript
interface ContentPromptOutput {
  platform: Platform
  postId: string
  systemPrompt: string        // Full system prompt — brand voice + platform rules + learnings injected
  userPrompt: string          // The actual instruction with source post text
  context: {
    platformLabel: string     // e.g. "Twitter / X"
    maxChars: number          // Character limit for this platform
    hashtagCount: string      // e.g. "1-3 hashtags"
    threadEnabled: boolean    // Whether thread format is available
    learningsApplied: string[] // Which learnings.md entries were injected (for audit trail)
  }
}
```

n8n receives this object and passes `systemPrompt` + `userPrompt` directly to the Claude API messages format. The `context` fields are used by n8n to validate the output (e.g. check character count before writing to Sheet).

---

### Image skill — output contract

Every image skill file, when executed, produces this structured object:

```typescript
interface ImagePromptOutput {
  platform: Platform
  postId: string
  sourceImageUrl: string | null   // Original LinkedIn image URL passed in
  prompt: string                  // The fal.ai generation prompt
  styleDirectives: {
    aspectRatio: string           // e.g. "1:1", "16:9"
    width: number                 // Pixel width
    height: number                // Pixel height
    mood: string                  // e.g. "clean, professional, minimal"
    colorTone: string             // e.g. "warm neutrals, no harsh contrasts"
    composition: string           // e.g. "centered subject, generous whitespace"
    textOverlay: false            // Always false — never text in generated images
  }
  negativePrompt: string          // What to avoid — passed to fal.ai as negative_prompt
}
```

n8n uses all fields: `prompt` + `styleDirectives` dimensions for the fal.ai API call, `negativePrompt` for quality control, `sourceImageUrl` if the model supports image-to-image conditioning.

---

### Content skill format — annotated example (twitter-content.md)

All 5 content skill files follow this exact structure. Only the platform-specific sections differ.

```markdown
# Skill: Twitter/X Content Prompt Factory

## Purpose
Generate the structured prompt payload for repurposing a LinkedIn post as Twitter/X content.
This skill produces a system prompt + user prompt. It does not call Claude directly.
The output is passed to n8n which makes the Claude API call.

## Inputs required
- `linkedinText`: string — the source LinkedIn post text
- `postId`: string — for audit trail
- `brandVoice`: BrandVoiceProfile — from config/brand-voice.json
- `learnings`: string — relevant sections from memory/learnings.md (Twitter section + content performance)
- `userProfile`: string — voice fingerprint + approval patterns from memory/USER.md

## Platform identity
- Platform: Twitter / X
- Character limit: 280 per tweet (thread supported up to 10 tweets)
- Hashtag count: 1–3
- Thread format: YES — use when content naturally has multiple distinct points
- Image: 1200×675 (16:9) or 1080×1080 (1:1)

## System prompt template

```
You are a content repurposing specialist for a personal brand on Twitter/X.

BRAND VOICE:
Tone: {brandVoice.toneDescriptors}
Writing style: {brandVoice.writingStyle}
Topic pillars: {brandVoice.topicPillars}
Never use: {brandVoice.avoidList}

EXAMPLE POSTS (study these — they represent the ideal voice):
{brandVoice.examplePosts — each separated by ---}

PLATFORM RULES FOR TWITTER/X:
- Maximum 280 characters per tweet
- If content has multiple distinct points, format as a numbered thread (1/, 2/, 3/)
- Start with a bold hook — the first tweet must stop the scroll
- Short punchy sentences — rarely over 15 words
- Each tweet must be self-contained and make sense without the others
- End the thread with a single punchy conclusion or call to reflect
- Use 1–3 hashtags maximum, placed at the end of the last tweet
- No corporate language. No "Let me know your thoughts". No "Comment below".

OBSERVED APPROVAL PATTERNS — CRITICAL, THESE OVERRIDE THE RULES ABOVE:
{learnings — Twitter section, full text}

USER VOICE FINGERPRINT:
{userProfile.voiceFingerprint}

USER TWITTER APPROVAL PATTERNS:
{userProfile.approvalPatterns.twitter}

Your goal: generate Twitter content that will be approved without any edits.
Study the approval patterns above — they are real observations of what this creator
approves and what they change. Optimize for zero-edit approval above all else.

Output format: JSON only, no markdown, no explanation.
{
  "text": "full tweet text or full thread with tweets separated by \n\n",
  "hashtags": ["tag1", "tag2"],
  "format": "single" | "thread",
  "tweetCount": 1
}
```

## User prompt template

```
Repurpose the following LinkedIn post for Twitter/X.

Source post:
{linkedinText}

If the content has 3 or more distinct points or lessons, format as a thread.
If it is a single focused insight, keep as a single tweet (can be up to 280 chars).
```

## Learnings injection rules
When building the system prompt, inject learnings in this priority order:
1. Twitter-specific approval patterns (from learnings.md ## Approval patterns ### Twitter)
2. Content performance observations (from learnings.md ## Content performance)
3. Platform-specific tone adjustments for Twitter (from learnings.md ## Platform-specific tone adjustments ### Twitter)

If the learnings section for Twitter is empty (early use, no data yet), omit the
"OBSERVED APPROVAL PATTERNS" section entirely rather than showing an empty block.

## Output validation rules
Before returning the output, validate:
- If format is "single": text must be ≤280 chars (including hashtags)
- If format is "thread": each tweet separated by \n\n must individually be ≤280 chars
- hashtags array must have 1–3 items
- No item in avoidList appears in the text
If validation fails: flag in the context.learningsApplied array as "VALIDATION_WARNING: {issue}"
```

---

### Image skill format — annotated example (twitter-image.md)

```markdown
# Skill: Twitter/X Image Prompt Factory

## Purpose
Generate the structured image prompt payload for repurposing a LinkedIn post image for Twitter/X.
This skill produces a fal.ai prompt + style directives + negative prompt.
n8n receives this payload and calls fal.ai directly.

## Inputs required
- `linkedinText`: string — source post text (used to understand visual subject matter)
- `sourceImageUrl`: string | null — original LinkedIn image URL
- `postId`: string
- `brandVoice`: BrandVoiceProfile — for visual tone alignment
- `learnings`: string — visual/image learnings from memory/learnings.md if any

## Platform image identity
- Platform: Twitter / X
- Dimensions: 1200 × 675 (16:9 landscape)
- Aspect ratio: 16:9
- Optimal visual style: clean, bold, designed to stop scroll in a fast-moving feed
- Text overlay: NEVER — no text, words, or captions in the image

## Prompt construction rules
The image prompt must:
1. Capture the core visual concept of the LinkedIn post in one scene
2. Be optimized for 16:9 landscape — horizontal compositions, nothing portrait-oriented
3. Feel professional but not corporate — real, not stock-photo
4. Have strong visual contrast for small-screen legibility
5. Align with brand tone descriptors (e.g. if tone is "direct, no-fluff" — image should be minimal, not cluttered)

## Prompt template

```
A [visual concept derived from post topic] — [composition style] — [mood/atmosphere].
[Lighting description]. [Color palette]. Professional quality, photorealistic/illustrated (choose based on post topic).
No text, no words, no captions, no overlays. 16:9 landscape composition. [Any brand-specific visual notes from brandVoice].
```

## Style directives (always fixed for this platform)
```json
{
  "aspectRatio": "16:9",
  "width": 1200,
  "height": 675,
  "mood": "bold, clean, high contrast, scroll-stopping",
  "colorTone": "strong contrast, vivid but not garish, aligned with post emotional tone",
  "composition": "landscape-first, strong focal point, generous negative space",
  "textOverlay": false
}
```

## Negative prompt template
```
text, words, letters, captions, watermarks, logos, blurry, low quality, distorted,
portrait orientation, stock photo clichés (handshake, lightbulb, magnifying glass),
oversaturated, pixelated, ugly, deformed
```

## Example output
Given a LinkedIn post about "the biggest mistake founders make with retention":

```json
{
  "platform": "twitter",
  "postId": "post_001",
  "sourceImageUrl": "https://...",
  "prompt": "A leaking bucket with water pouring out — clean minimal studio shot — metaphor for customer churn. Soft dramatic lighting from above. Muted blue-grey palette with one warm amber accent. Professional quality, photorealistic. No text, no words, no overlays. 16:9 landscape.",
  "styleDirectives": {
    "aspectRatio": "16:9",
    "width": 1200,
    "height": 675,
    "mood": "bold, clean, high contrast, scroll-stopping",
    "colorTone": "muted blue-grey with warm amber accent",
    "composition": "centered subject, generous negative space on sides",
    "textOverlay": false
  },
  "negativePrompt": "text, words, letters, captions, watermarks, logos, blurry, low quality, distorted, portrait orientation, handshake, lightbulb, magnifying glass, oversaturated, pixelated"
}
```
```

---

### Platform skill variations — what differs per platform

All 10 skill files share the same structure. Here is what specifically changes per platform:

#### Content skills — platform-specific deltas

| Platform | Key system prompt differences |
|---|---|
| **Twitter** | Thread format enabled. 280-char limit enforced. Hook-first. Numbered threads. |
| **Threads** | 500-char limit. No thread format. Conversational register. Soft question ending ok. |
| **Instagram** | 2200-char limit. Story arc structure. First line must work as preview. Hashtags at end separated by line break. |
| **Facebook** | Long form ok. End with a direct question. Paragraph prose, no bullets. Warm community tone. |
| **Skool** | Reframe as community discussion starter. "I want to share a lesson..." opening. End with discussion question. NO hashtags — omit hashtag output field entirely. |

#### Image skills — platform-specific deltas

| Platform | Dimensions | Aspect | Style directive | Key composition rule |
|---|---|---|---|---|
| **Twitter** | 1200×675 | 16:9 | Bold, high contrast | Landscape-first, strong focal point |
| **Threads** | 1080×1080 | 1:1 | Warm, casual, personal feel | Square-centered, intimate framing |
| **Instagram** | 1080×1080 | 1:1 | Polished, aesthetic, thumb-stopping | Grid-aware, color palette consistency |
| **Facebook** | 1200×630 | 16:9 | Warm, community-oriented | Inviting scene, human element preferred |
| **Skool** | 1200×675 | 16:9 | Educational, clear, trustworthy | Clean diagram style or simple scene |

---

### API route — POST /api/skills/platform-prompt

This route executes a platform skill file and returns the structured prompt payload. Called by the repurpose skill before firing the n8n webhook.

**Request body:**
```typescript
{
  postId: string
  platform: Platform
  skillType: 'content' | 'image'
  sourceImageUrl?: string          // Required for image skills
}
```

**Implementation:**
```typescript
// app/api/skills/platform-prompt/route.ts

export async function POST(req: Request) {
  const { postId, platform, skillType, sourceImageUrl } = await req.json()

  // 1. Fetch source post via n8n Sheet webhook
  const post = await getPostById(postId)
  if (!post) return Response.json({ error: 'Post not found' }, { status: 404 })

  // 2. Load all context needed by the skill
  const brandVoice = await getBrandVoice()
  const learnings = await fs.readFile('memory/learnings.md', 'utf-8').catch(() => '')
  const userProfile = await fs.readFile('memory/USER.md', 'utf-8').catch(() => '')

  // 3. Read the skill file
  const skillPath = `skills/platforms/${platform}-${skillType}.md`
  const skillContent = await fs.readFile(skillPath, 'utf-8')

  // 4. Extract relevant learnings for this platform
  const relevantLearnings = extractPlatformLearnings(learnings, platform)

  // 5. Call Claude to execute the skill — Claude reads the skill file and
  //    produces the structured output according to the skill's output contract
  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 2048,
    system: `You are executing a skill file for the Pulse Repurpose app.
Read the skill file carefully and produce the exact output format it specifies.
Return JSON only. No markdown. No explanation.`,
    messages: [{
      role: 'user',
      content: `Execute this skill:

${skillContent}

With these inputs:
- postId: ${postId}
- linkedinText: ${post.linkedinText}
- sourceImageUrl: ${sourceImageUrl ?? 'null'}
- brandVoice: ${JSON.stringify(brandVoice)}
- learnings (platform-relevant): ${relevantLearnings}
- userProfile: ${userProfile}

Return the structured output object as specified in the skill file.`
    }]
  })

  const output = JSON.parse(
    response.content[0].type === 'text' ? response.content[0].text : '{}'
  )

  // 6. Persist generated prompts — both to content .md file and to Google Sheet
  if (skillType === 'content') {
    // Write full prompt to Sheet as JSON string (for audit + n8n to use)
    const promptJson = JSON.stringify({
      systemPrompt: output.systemPrompt,
      userPrompt: output.userPrompt,
    })
    await writeContentPrompts(postId, { [platform]: promptJson })
    // Write truncated version to content .md file frontmatter for human readability
    await updatePlatformFileMeta(postId, platform, {
      content_prompt_preview: output.userPrompt?.slice(0, 200) + '...',
    })
  }
  if (skillType === 'image') {
    await updatePlatformFileMeta(postId, platform, {
      image_prompt: output.prompt,
    })
    // Also write image prompt to Sheet via n8n
    await writeImagePrompts(postId, { [platform]: output.prompt })
  }

  return Response.json(output)
}
```

---

### Updated repurpose flow — how skills slot in

The master `skills/repurpose.md` and `POST /api/skills/repurpose` route are updated to call platform skills before firing n8n webhooks.

**Updated Step 3 in skills/repurpose.md:**

```markdown
### Step 3 — Generate prompt payloads via platform skills

For each target platform, call POST /api/skills/platform-prompt with skillType: "content".
This executes the platform's content skill file and returns { systemPrompt, userPrompt, context }.

Run all 5 platform content skill calls in parallel.

Collect all outputs into a prompts map:
{
  twitter:   { systemPrompt: "...", userPrompt: "..." },
  threads:   { systemPrompt: "...", userPrompt: "..." },
  instagram: { systemPrompt: "...", userPrompt: "..." },
  facebook:  { systemPrompt: "...", userPrompt: "..." },
  skool:     { systemPrompt: "...", userPrompt: "..." },
}

### Step 4 — Fire content repurpose webhook with prompt payloads

POST to N8N_CONTENT_REPURPOSE_WEBHOOK_URL.

Updated payload — the contentPrompts field replaces the old brandVoice field:
{
  postId,
  contentPrompts: {  // pre-built per-platform prompt pairs from skills
    twitter:   { systemPrompt, userPrompt },
    threads:   { systemPrompt, userPrompt },
    instagram: { systemPrompt, userPrompt },
    facebook:  { systemPrompt, userPrompt },
    skool:     { systemPrompt, userPrompt },
  },
  callbackUrl
}

n8n no longer builds prompts itself. It receives ready-to-use system + user prompt pairs
and passes them directly to the Claude API for each platform.
```

**Updated Step 5 for images in skills/repurpose.md:**

```markdown
### Step 5 — Generate image prompt payloads via platform skills

For each target platform, call POST /api/skills/platform-prompt with:
- skillType: "image"
- sourceImageUrl: post.linkedinImageUrl

Run all 5 platform image skill calls in parallel.

Collect outputs into an imagePayloads map:
{
  twitter:   { prompt, sourceImageUrl, styleDirectives, negativePrompt },
  threads:   { prompt, sourceImageUrl, styleDirectives, negativePrompt },
  instagram: { prompt, sourceImageUrl, styleDirectives, negativePrompt },
  facebook:  { prompt, sourceImageUrl, styleDirectives, negativePrompt },
  skool:     { prompt, sourceImageUrl, styleDirectives, negativePrompt },
}

### Step 6 — Fire image repurpose webhook with full image payloads

POST to N8N_IMAGE_REPURPOSE_WEBHOOK_URL.

Updated payload:
{
  postId,
  imagePayloads: {  // pre-built per-platform image prompt objects from skills
    twitter:   { prompt, sourceImageUrl, styleDirectives, negativePrompt },
    // ...etc
  },
  callbackUrl
}

n8n receives complete, ready-to-use image payloads per platform.
It passes prompt + styleDirectives dimensions to fal.ai, negativePrompt for quality,
and sourceImageUrl if the model supports image-to-image conditioning.
```

---

### Updated n8n workflow specs — simplified

Because skills now pre-build all prompts, n8n workflows 1 and 2 become significantly simpler.

**Workflow 1 (Content repurpose) — updated:**

Previously: n8n built system prompts from brand voice payload → called Claude per platform.
Now: n8n receives pre-built `{ systemPrompt, userPrompt }` per platform → passes directly to Claude.

For each platform in `payload.contentPrompts`:
```javascript
// n8n HTTP Request node — Claude API call per platform
{
  model: "claude-sonnet-4-20250514",
  max_tokens: 1024,
  system: payload.contentPrompts[platform].systemPrompt,
  messages: [{ role: "user", content: payload.contentPrompts[platform].userPrompt }]
}
```

Remove: Code node that built system prompts from brand voice. No longer needed.
Keep: Sheet write, callback, error handler.

**Workflow 2 (Image repurpose) — updated:**

Previously: n8n received image prompts as simple strings → called fal.ai with basic params.
Now: n8n receives full `{ prompt, sourceImageUrl, styleDirectives, negativePrompt }` per platform.

For each platform in `payload.imagePayloads`:
```javascript
// n8n HTTP Request node — fal.ai call per platform
{
  prompt: payload.imagePayloads[platform].prompt,
  image_size: {
    width: payload.imagePayloads[platform].styleDirectives.width,
    height: payload.imagePayloads[platform].styleDirectives.height
  },
  negative_prompt: payload.imagePayloads[platform].negativePrompt,
  // If sourceImageUrl provided and model supports img2img:
  image_url: payload.imagePayloads[platform].sourceImageUrl
}
```

Remove: imageSizes and imagePrompts as separate fields. Replaced by imagePayloads.
Keep: Sheet write, callback, error handler.

---

### Updated ContentRepurposeWebhookPayload and ImageRepurposeWebhookPayload types

Update in `types/index.ts`:

```typescript
// Updated Webhook 1 payload — skills pre-build all prompts
export interface ContentRepurposeWebhookPayload {
  postId: string
  contentPrompts: Partial<Record<Platform, {
    systemPrompt: string
    userPrompt: string
    context: {
      platformLabel: string
      maxChars: number
      hashtagCount: string
      threadEnabled: boolean
      learningsApplied: string[]
    }
  }>>
  callbackUrl: string
  // brandVoice and hashtagBank removed — now handled inside skill files
}

// Updated Webhook 2 payload — skills pre-build full image payloads
export interface ImageRepurposeWebhookPayload {
  postId: string
  imagePayloads: Partial<Record<Platform, {
    prompt: string
    sourceImageUrl: string | null
    styleDirectives: {
      aspectRatio: string
      width: number
      height: number
      mood: string
      colorTone: string
      composition: string
      textOverlay: false
    }
    negativePrompt: string
  }>>
  callbackUrl: string
  // imagePrompts and imageSizes as separate fields removed — merged into imagePayloads
}
```

---

### Learning system integration with platform skills

Platform skill files are living documents — they improve as the learning system accumulates data. The cron skill's learning update operation (Operation 3) now also updates platform skill files when strong patterns emerge.

Add to `skills/cron.md` Operation 3:

```markdown
### Operation 3b — Platform skill refinement

After updating learnings.md, check if any platform has 5+ new high-confidence observations
since the skill file was last updated (check file modified timestamp vs learnings entries).

If yes:
1. Call POST /api/docs/sync with:
   - changelogEntry: "Learning system: [N] new high-confidence observations for [platform] — skill file updated"
   - changedFiles: ["memory/learnings.md"]
   - changeType: "feature-updated"

This triggers the auto-documentation system to regenerate the platform skill file
with the latest learnings baked directly into the prompt templates — so future
repurposing uses improved prompts without any manual intervention.
```

---

### Implementation order additions

Add after step 14c:

```
14c-i.  Platform skill files — generate all 10 skill files (5 content + 5 image) with correct
         starter templates as specified above. These must exist before the repurpose skill executes.
14c-ii. POST /api/skills/platform-prompt route — executes any platform skill and returns
         structured output. Test each platform skill end-to-end before proceeding.
14c-iii. Update POST /api/skills/repurpose to call platform skills in parallel before firing
          n8n webhooks. Replace old brandVoice payload with contentPrompts map.
14c-iv. Update n8n Workflow 1 and Workflow 2 to use the new simplified payload structure.
         Update the n8n MCP prompt in the spec to reflect the simplified workflows.
```

---

## Auto-documentation system — living docs that update with the codebase

Every time a feature is added, updated, or removed in Pulse Repurpose, the app automatically regenerates the affected documentation and AOS files. The app never drifts out of sync with its own docs. README.md always reflects what the app actually does. SOUL.md always reflects how it actually works. Skills always reflect what they actually execute.

This system has two parts: a **detection layer** (what changed?) and a **generation layer** (what needs rewriting?).

---

### How it works — overview

When Claude Code makes any meaningful change to the codebase, it calls `POST /api/docs/sync` as a final step. This route:

1. Reads a `CHANGELOG.md` entry (written by Claude Code describing what changed)
2. Determines which docs are affected using a **file-to-doc impact map**
3. For narrative docs (README, SOUL, skills): calls Claude API to intelligently rewrite affected sections
4. For state/template docs (Heartbeat): rebuilds from structured app state
5. Writes updated files to disk
6. Logs the update to `memory/MEMORY.md`

Claude Code is instructed (in the final notes section) to always call this route after completing any feature work.

---

### CHANGELOG.md — the change journal

Located at project root. Append-only. Written by Claude Code after every meaningful change. This file is the input to the doc sync system — it describes *what* changed so the system knows *what to update*.

Format:

```markdown
# CHANGELOG.md

## [2026-03-17] — Add content store

### Type: feature-added
### Files changed: lib/content-store.ts, app/api/content/[postId]/route.ts, app/api/callback/repurpose/route.ts
### Summary: Added Markdown file persistence for all repurposed content. Each post now gets a content/[post_id]/ folder with _source.md and one .md file per platform. Files are written by callbacks and updated on approval/edit/publish events.
### Docs affected: README.md, skills/repurpose.md, Heartbeat.md

---

## [2026-03-16] — Add cron skill

### Type: feature-added
### Files changed: app/api/cron/route.ts, skills/cron.md
### Summary: Implemented the cron skill execution route. Reads skills/cron.md and runs all 8 operations in sequence. Added CRON_SECRET protection and manual trigger button on dashboard.
### Docs affected: README.md, skills/cron.md, SOUL.md

---
```

**Claude Code must write a CHANGELOG.md entry** — using the format above — at the end of every task before calling `/api/docs/sync`. If Claude Code forgets, the sync route reads the last git diff as a fallback.

---

### File-to-doc impact map (lib/docs-sync.ts)

This map defines which documentation files are affected when specific parts of the codebase change. The sync route uses this to avoid regenerating everything on every change — only affected docs are updated.

```typescript
export const DOC_IMPACT_MAP: Record<string, string[]> = {
  // App routes
  'app/api/**':                     ['README.md'],
  'app/api/cron/**':                ['README.md', 'skills/cron.md', 'SOUL.md'],
  'app/api/skills/**':              ['README.md', 'skills/repurpose.md'],
  'app/api/skills/platform-prompt/**': ['README.md', 'skills/repurpose.md'],
  'skills/platforms/**':            ['README.md', 'skills/repurpose.md'],
  'app/api/trigger/**':             ['README.md', 'skills/repurpose.md'],
  'app/api/callback/**':            ['README.md', 'skills/repurpose.md'],
  'app/api/publish/**':             ['README.md'],
  'app/api/docs/**':                ['README.md'],

  // Core lib
  'lib/n8n.ts':                     ['README.md', 'skills/repurpose.md', 'skills/cron.md'],
  'lib/n8n-sheet.ts':               ['README.md', 'skills/repurpose.md', 'skills/cron.md'],
  'lib/anthropic.ts':               ['README.md', 'SOUL.md', 'skills/repurpose.md'],
  'lib/content-store.ts':           ['README.md', 'skills/repurpose.md'],
  'lib/platform-rules.ts':          ['README.md', 'skills/repurpose.md', 'skills/cron.md'],
  'lib/brand-voice.ts':             ['README.md', 'skills/repurpose.md'],

  // AOS files themselves
  'skills/repurpose.md':            ['README.md', 'Heartbeat.md'],
  'skills/cron.md':                 ['README.md', 'Heartbeat.md', 'SOUL.md'],
  'memory/**':                      ['Heartbeat.md'],

  // Types
  'types/index.ts':                 ['README.md', 'skills/repurpose.md'],

  // UI pages
  'app/dashboard/**':               ['README.md'],
  'app/repurpose/**':               ['README.md', 'skills/repurpose.md'],
  'app/calendar/**':                ['README.md'],
  'app/settings/**':                ['README.md', 'SOUL.md'],

  // Config
  '.env.local.example':             ['README.md'],
  'config/**':                      ['README.md', 'SOUL.md'],
}

// Resolve which docs need updating given a list of changed files
export function resolveAffectedDocs(changedFiles: string[]): string[] {
  const affected = new Set<string>()
  for (const changed of changedFiles) {
    for (const [pattern, docs] of Object.entries(DOC_IMPACT_MAP)) {
      if (minimatch(changed, pattern)) {
        docs.forEach(d => affected.add(d))
      }
    }
  }
  return Array.from(affected)
}
```

Install `minimatch` for glob matching: `npm install minimatch`.

---

### Generation strategy per file

Each doc file has its own generation strategy. Claude handles narrative docs; structured templates handle state files.

```typescript
export const DOC_GENERATION_STRATEGY: Record<string, 'claude' | 'template' | 'claude+template'> = {
  'README.md':              'claude',           // Full rewrite by Claude
  'SOUL.md':                'claude',           // Selective section update by Claude
  'skills/repurpose.md':    'claude',           // Selective step update by Claude
  'skills/cron.md':         'claude',           // Selective operation update by Claude
  'Heartbeat.md':           'template',         // Rebuilt from live app state
  'memory/learnings.md':    'template',         // Append-only — new entry added, not rewritten
}
```

---

### POST /api/docs/sync — the sync route

This is the core of the auto-documentation system. Called by Claude Code after every feature change.

**Request body:**
```typescript
{
  changelogEntry: string        // The CHANGELOG.md entry text for this change
  changedFiles: string[]        // List of files modified (relative paths)
  changeType: 'feature-added' | 'feature-updated' | 'feature-removed' | 'bugfix' | 'refactor'
  forceAll?: boolean            // If true, regenerate all docs regardless of impact map
}
```

**Route implementation:**

```typescript
// app/api/docs/sync/route.ts

export async function POST(req: Request) {
  const body = await req.json()
  const { changelogEntry, changedFiles, changeType, forceAll } = body

  // 1. Append to CHANGELOG.md
  await appendToChangelog(changelogEntry)

  // 2. Determine affected docs
  const affectedDocs = forceAll
    ? Object.keys(DOC_GENERATION_STRATEGY)
    : resolveAffectedDocs(changedFiles)

  const results: Record<string, 'updated' | 'skipped' | 'failed'> = {}

  // 3. Process each affected doc
  for (const doc of affectedDocs) {
    try {
      const strategy = DOC_GENERATION_STRATEGY[doc]

      if (strategy === 'claude' || strategy === 'claude+template') {
        await regenerateWithClaude(doc, changelogEntry, changeType)
      }

      if (strategy === 'template' || strategy === 'claude+template') {
        await regenerateWithTemplate(doc)
      }

      results[doc] = 'updated'
    } catch (err) {
      results[doc] = 'failed'
      console.error(`Failed to update ${doc}:`, err)
    }
  }

  // 4. Log to MEMORY.md
  const updatedList = Object.entries(results)
    .filter(([, v]) => v === 'updated')
    .map(([k]) => k)
    .join(', ')
  await appendToMemory(
    `[${new Date().toISOString()}] Doc sync triggered by ${changeType}. Updated: ${updatedList}. Change: ${changelogEntry.split('\n')[0]}`
  )

  return Response.json({ results, affectedDocs })
}
```

---

### Claude-powered doc regeneration (lib/docs-sync.ts)

```typescript
async function regenerateWithClaude(
  docPath: string,
  changelogEntry: string,
  changeType: string
): Promise<void> {

  // Read current file content
  const currentContent = await fs.readFile(docPath, 'utf-8').catch(() => '')

  // Read current codebase context (relevant files only, not entire codebase)
  const context = await buildDocContext(docPath)

  const systemPrompt = `You are the documentation system for Pulse Repurpose — a personal content
repurposing app built as an Agentic Operating System.

Your job is to update the file "${docPath}" to accurately reflect the current state of the app
after a recent change.

Rules:
- Preserve the existing tone, structure, and style of the document
- Only update sections that are genuinely affected by the change
- Never remove sections unless the feature they describe was explicitly removed
- For README.md: keep it developer-friendly, accurate, and scannable
- For SOUL.md: only update operating principles if the change fundamentally alters how the app works
- For skills/*.md: update the specific steps or operations that changed — not the whole file
- Return the COMPLETE updated file content, not just the changed sections
- Do not add commentary, preamble, or explanation — return only the file content`

  const userPrompt = `The following change was just made to the app:

${changelogEntry}

Change type: ${changeType}

Current content of ${docPath}:
\`\`\`
${currentContent}
\`\`\`

Relevant codebase context:
${context}

Return the updated content of ${docPath} that accurately reflects this change.`

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 4096,
    messages: [{ role: 'user', content: userPrompt }],
    system: systemPrompt,
  })

  const updatedContent = response.content[0].type === 'text' ? response.content[0].text : ''
  if (updatedContent.trim()) {
    await fs.writeFile(docPath, updatedContent)
  }
}
```

---

### Context builder — what Claude reads per doc

Claude doesn't read the entire codebase for every doc update — only the files relevant to each doc are passed as context. This keeps prompts focused and fast.

```typescript
async function buildDocContext(docPath: string): Promise<string> {
  const contextMap: Record<string, string[]> = {
    'README.md': [
      'package.json',
      '.env.local.example',
      'types/index.ts',
      'lib/platform-rules.ts',
      'SOUL.md',
    ],
    'SOUL.md': [
      'lib/platform-rules.ts',
      'lib/anthropic.ts',
      'lib/n8n.ts',
      'skills/repurpose.md',
      'skills/cron.md',
    ],
    'skills/repurpose.md': [
      'app/api/skills/repurpose/route.ts',
      'app/api/trigger/repurpose/route.ts',
      'app/api/callback/repurpose/route.ts',
      'lib/anthropic.ts',
      'lib/n8n.ts',
      'lib/content-store.ts',
    ],
    'skills/cron.md': [
      'app/api/cron/route.ts',
      'lib/n8n-sheet.ts',
      'lib/n8n.ts',
    ],
  }

  const files = contextMap[docPath] ?? []
  const parts: string[] = []

  for (const file of files) {
    try {
      const fileContent = await fs.readFile(file, 'utf-8')
      parts.push(`### ${file}
\`\`\`
${fileContent.slice(0, 3000)}
\`\`\``)
    } catch {
      // File doesn't exist — skip
    }
  }

  return parts.join('

')
}
```

---

### Template-based regeneration

For Heartbeat.md (state file) and learnings.md (append-only), Claude is not used — these are rebuilt or appended programmatically.

```typescript
async function regenerateWithTemplate(docPath: string): Promise<void> {
  if (docPath === 'Heartbeat.md') {
    await rebuildHeartbeat()   // existing function — reads app state and rewrites Heartbeat.md
    return
  }

  if (docPath === 'memory/learnings.md') {
    // Append a doc-change observation rather than rewriting
    const entry = `
- [${new Date().toISOString().split('T')[0]}] System: Documentation auto-synced after codebase change. learnings.md structure preserved.`
    await fs.appendFile('memory/learnings.md', entry)
    return
  }
}
```

---

### Claude Code instructions — mandatory final step

Add the following to the **Final notes for Claude Code** section. This is the instruction that makes the whole system work — Claude Code must follow this after every task.

> **MANDATORY: After completing any feature addition, update, or removal:**
>
> 1. Write a `CHANGELOG.md` entry in the format specified in the auto-documentation section. Include: date, type (feature-added/feature-updated/feature-removed), files changed, summary (2-3 sentences), docs affected.
> 2. Call `POST /api/docs/sync` with the changelog entry, list of changed files, and change type.
> 3. Wait for the sync response and verify all affected docs returned `"updated"` status. If any returned `"failed"`, retry that specific doc by calling the route again with `forceAll: false` and only the failed doc in `changedFiles`.
> 4. If the `/api/docs/sync` route does not exist yet (early in build), write the CHANGELOG.md entry manually and skip the API call — the route will catch up when built.
>
> This step is non-negotiable. Every feature change must be reflected in the docs before the task is considered complete.

---

### GET /api/docs/status — doc freshness check

```typescript
// Returns the sync status of all docs — when each was last updated and whether
// it may be stale relative to recent CHANGELOG entries

// Response:
{
  docs: {
    'README.md':           { lastUpdated: '2026-03-17T...', status: 'fresh' },
    'SOUL.md':             { lastUpdated: '2026-03-15T...', status: 'stale' },  // older than last changelog
    'skills/repurpose.md': { lastUpdated: '2026-03-17T...', status: 'fresh' },
    'skills/cron.md':      { lastUpdated: '2026-03-17T...', status: 'fresh' },
    'Heartbeat.md':        { lastUpdated: '2026-03-17T...', status: 'fresh' },
  },
  lastChangelogEntry: '2026-03-17T...',
  staleDocs: ['SOUL.md']
}
```

Add a **Docs status** indicator to the dashboard system panel (alongside the Heartbeat status bar). Show a green dot for fresh docs, amber for stale. "Sync docs" button triggers `POST /api/docs/sync` with `forceAll: true` for any stale docs.

---

### .gitignore additions

```gitignore
# CHANGELOG.md should always be committed — it is the audit trail of all changes
# Do not gitignore it.

# .env.local.example should be committed (no secrets, just key names)
# .env.local should NOT be committed (contains real secrets)
.env.local
```

---

### Project structure additions

Add these files to the project root:

```
CHANGELOG.md                        # Append-only change journal written by Claude Code
```

And these routes:
```
app/api/docs/
├── sync/
│   └── route.ts                    # POST — trigger doc regeneration
└── status/
    └── route.ts                    # GET — check doc freshness
```

And this lib file:
```
lib/docs-sync.ts                    # Impact map, context builder, Claude + template generators
```

---

## Content store — Markdown files per post per platform

Every repurposed post is persisted as plain Markdown files in the `content/` directory. This is the human-readable, git-trackable, LLM-accessible record of all content ever created by the app. It complements the Google Sheet (which is the operational state tracker) — the Sheet tells you *where* a post is in the pipeline, the content files tell you *what* was written and how it evolved.

### Directory structure

```
content/
└── post_001/
    ├── _source.md
    ├── twitter.md
    ├── threads.md
    ├── instagram.md
    ├── facebook.md
    └── skool.md
```

One folder per LinkedIn post, named by `post_id`. Created automatically when a post is first repurposed. Files are created or overwritten whenever content for that platform changes.

---

### File formats

#### `_source.md` — Original LinkedIn post

Created when repurposing begins. Never overwritten after creation.

```markdown
---
post_id: post_001
posted_at: 2026-03-15T08:30:00Z
linkedin_image_url: https://...
scraped_at: 2026-03-15T09:00:00Z
---

# Source — LinkedIn

The biggest mistake I made in my first year of building was optimizing
for revenue instead of retention. Here's what I learned the hard way...

[full LinkedIn post text]
```

#### `twitter.md` — Twitter/X variant

```markdown
---
post_id: post_001
platform: twitter
status: published
generated_at: 2026-03-15T09:05:00Z
approved_at: 2026-03-15T11:20:00Z
published_at: 2026-03-15T14:00:00Z
scheduled_at: 2026-03-15T14:00:00Z
image_url: https://...
image_prompt: A split visual showing a revenue graph declining while a retention graph rises...
hashtags: buildinpublic, startups, saas
edited_by_user: false
version: 1
---

# Twitter / X

Optimizing for revenue before retention almost killed my startup.

Here's the painful lesson:

1/ We hit $10k MRR in month 3. Everyone celebrated.

2/ Churn hit 18% in month 4. We'd been papering over a leaky bucket.

3/ It took 6 months to fix the product. Revenue stalled. Team morale tanked.

The companies that win long-term obsess over why people stay, not just why they sign up.

Build retention first. Revenue follows.
```

#### `threads.md`, `instagram.md`, `facebook.md`, `skool.md`

Same structure as `twitter.md` — frontmatter + content body. Each uses the appropriate platform-specific format.

**Instagram example:**

```markdown
---
post_id: post_001
platform: instagram
status: approved
generated_at: 2026-03-15T09:05:00Z
approved_at: 2026-03-15T11:45:00Z
published_at: null
scheduled_at: 2026-03-16T11:00:00Z
image_url: https://...
image_prompt: Clean minimal graphic showing a retention funnel with a heart icon...
hashtags: buildinpublic, startuplessons, saas, founderlife, productgrowth, retention, churn, startuplife
edited_by_user: true
version: 2
---

# Instagram

I almost destroyed my startup chasing the wrong number.

We hit $10k MRR and I thought we'd made it.

Then churn hit 18%.

Turns out we'd been pouring water into a bucket with holes.

Six months of painful rebuilding followed.

The lesson I'll never forget: revenue is a lagging indicator.
Retention tells you the truth.

Build something people actually want to keep using.
That's the only metric that compounds.

#buildinpublic #startuplessons #saas #founderlife #productgrowth #retention #churn #startuplife
```

---

### Frontmatter fields — full spec

All platform files use these frontmatter fields:

```yaml
post_id: string                   # Links back to the Sheet row
platform: string                  # twitter | threads | instagram | facebook | skool
status: string                    # pending | approved | scheduled | published | failed
generated_at: ISO string          # When AI first generated this variant
approved_at: ISO string | null    # When user approved
published_at: ISO string | null   # When actually published
scheduled_at: ISO string | null   # When scheduled to publish
image_url: string | null          # URL of the generated image
image_prompt: string | null       # Exact prompt used to generate the image
hashtags: string                  # Comma-separated, no # prefix
edited_by_user: boolean           # true if user made any manual edits
version: integer                  # Increments on every regeneration (starts at 1)
```

---

### lib/content-store.ts — file system helper

Create this file to handle all reads and writes to the `content/` directory.

```typescript
import fs from 'fs/promises'
import path from 'path'
import matter from 'gray-matter'           // npm install gray-matter

const CONTENT_DIR = path.join(process.cwd(), 'content')

// Ensure post folder exists
async function ensurePostDir(postId: string): Promise<string> {
  const dir = path.join(CONTENT_DIR, postId)
  await fs.mkdir(dir, { recursive: true })
  return dir
}

// Write _source.md — only if it doesn't already exist
export async function writeSourceFile(post: LinkedInPost): Promise<void> {
  const dir = await ensurePostDir(post.id)
  const filePath = path.join(dir, '_source.md')
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
    const body = `# Source — LinkedIn

${post.linkedinText}`
    await fs.writeFile(filePath, matter.stringify(body, frontmatter))
  }
}

// Write or overwrite a platform variant file
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
    const existing = matter(await fs.readFile(filePath, 'utf-8'))
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
    hashtags: variant.hashtags.join(', '),
    edited_by_user: variant.isEdited ?? false,
    version,
  }

  const platformLabel = {
    twitter: 'Twitter / X',
    threads: 'Threads',
    instagram: 'Instagram',
    facebook: 'Facebook',
    skool: 'Skool Community',
  }[platform]

  const hashtagLine = variant.hashtags.length > 0 && ['instagram', 'threads'].includes(platform)
    ? `

${variant.hashtags.map(h => '#' + h).join(' ')}`
    : ''

  const body = `# ${platformLabel}

${variant.text ?? ''}${hashtagLine}`
  await fs.writeFile(filePath, matter.stringify(body, frontmatter))
}

// Read a platform file back into a structured object
export async function readPlatformFile(
  postId: string,
  platform: Platform
): Promise<{ frontmatter: Record<string, unknown>; text: string } | null> {
  const filePath = path.join(CONTENT_DIR, postId, `${platform}.md`)
  try {
    const raw = await fs.readFile(filePath, 'utf-8')
    const parsed = matter(raw)
    return { frontmatter: parsed.data, text: parsed.content.trim() }
  } catch {
    return null
  }
}

// Read all platform files for a post
export async function readAllPlatformFiles(
  postId: string
): Promise<Partial<Record<Platform, { frontmatter: Record<string, unknown>; text: string }>>> {
  const platforms: Platform[] = ['twitter', 'threads', 'instagram', 'facebook', 'skool']
  const results: Partial<Record<Platform, { frontmatter: Record<string, unknown>; text: string }>> = {}
  await Promise.all(
    platforms.map(async (p) => {
      const result = await readPlatformFile(postId, p)
      if (result) results[p] = result
    })
  )
  return results
}

// Update only the frontmatter fields of an existing file (e.g. status change)
export async function updatePlatformFileMeta(
  postId: string,
  platform: Platform,
  updates: Partial<Record<string, unknown>>
): Promise<void> {
  const filePath = path.join(CONTENT_DIR, postId, `${platform}.md`)
  try {
    const raw = await fs.readFile(filePath, 'utf-8')
    const parsed = matter(raw)
    const newFrontmatter = { ...parsed.data, ...updates }
    await fs.writeFile(filePath, matter.stringify(parsed.content, newFrontmatter))
  } catch {
    // File doesn't exist yet — skip silently
  }
}

// List all post IDs that have a content folder
export async function listContentPostIds(): Promise<string[]> {
  try {
    const entries = await fs.readdir(CONTENT_DIR, { withFileTypes: true })
    return entries.filter(e => e.isDirectory()).map(e => e.name)
  } catch {
    return []
  }
}
```

Also add `generated_at` and `isEdited` to `PlatformVariant` type in `types/index.ts`:
```typescript
export interface PlatformVariant {
  text: string | null
  contentPrompt: string | null      // JSON string of { systemPrompt, userPrompt } from content skill — Sheet col F/O/X/AG/AP
  imagePrompt: string | null        // fal.ai prompt string from image skill — Sheet col G/P/Y/AH/AQ
  imageUrl: string | null
  hashtags: string[]
  status: PostStatus
  generatedAt: string | null        // ISO date string, set when AI generates
  scheduledAt: string | null
  publishedAt: string | null
  approvedAt: string | null         // ISO date string, set when user approves
  isEdited: boolean
  error: string | null
}
```

---

### When content files are written

Content files are written at these moments — all calls go through `lib/content-store.ts`:

| Event | File written | Who calls it |
|---|---|---|
| Repurpose triggered for a post | `_source.md` | `POST /api/skills/repurpose` — before firing webhook |
| n8n callback received (text done) | `[platform].md` for all platforms with text | `POST /api/callback/repurpose` |
| n8n callback received (images done) | Update `image_url` + `image_prompt` frontmatter in each platform file | `POST /api/callback/images` |
| User approves a variant | Update `status: approved`, `approved_at` frontmatter | `PATCH /api/posts/[id]` |
| User edits text in UI | Overwrite body, set `edited_by_user: true`, increment `version` | `PATCH /api/posts/[id]` |
| User schedules a variant | Update `scheduled_at` frontmatter | `POST /api/publish` |
| n8n publish callback | Update `status: published`, `published_at` frontmatter | `POST /api/callback/publish` (new) |
| User regenerates a platform | Overwrite `[platform].md`, increment `version` | `POST /api/skills/repurpose` single-platform |

---

### Content files and the learning system

The content files feed directly into the AOS learning layer:

- **learnings.md** — the cron skill reads content files to detect edits (diff between `edited_by_user: true` files and their AI-generated version 1), then appends observations to `learnings.md`
- **skills/repurpose.md** — the repurpose skill can scan existing content files for approved posts to extract voice patterns before generating new content (in addition to learnings.md)
- **memory/USER.md** — the cron skill reads approved content files to build/update the user's voice fingerprint in USER.md
- **Heartbeat.md** — pipeline counts in Heartbeat.md are derived by scanning content file frontmatter statuses (as a cross-check against the Sheet)

---

### API route additions

**GET /api/content/[postId]**
- Returns all platform files for a post as structured JSON
- Calls `readAllPlatformFiles(postId)`
- Used by the repurpose page to load existing content without a Sheet round-trip

**GET /api/content/[postId]/[platform]**
- Returns a single platform file
- Used for the "view raw markdown" button in the platform card

**GET /api/content**
- Lists all post IDs that have content folders
- Returns `{ postIds: string[] }`

---

### UI additions

**"View markdown" button** on each platform card in the repurpose page:
- Opens a slide-over showing the raw `.md` file content (read-only, monospace font)
- Shows frontmatter fields as a clean key-value table above the content body
- Shows version number and edit history metadata
- "Copy markdown" button to copy to clipboard

**Content browser** in the dashboard slide-over panel:
- When viewing a post's detail slide-over, add a "Content files" tab alongside the existing platform status view
- Shows each platform file's current version, last edited timestamp, and a preview of the first 100 chars of content

---

### .gitignore guidance

Add a comment in `.gitignore` explaining the content folder strategy:

```gitignore
# AOS Memory — personal data, optionally gitignore
# memory/learnings.md
# memory/USER.md
# memory/daily/

# Content store — these are your repurposed posts, git tracking is recommended
# so you have a full history of every version of every piece of content.
# Uncomment below only if you want to keep content local:
# content/
```

The default is to **commit** the `content/` folder — version history in git doubles as a content audit trail, and you can see exactly how a post evolved across regenerations via `git log content/post_001/twitter.md`.


---

## Creating n8n workflows via n8n MCP server

Once the app is built, use the n8n MCP server connected to Claude Code to create all 4 workflows automatically — no manual clicking in the n8n UI required.

### Step 1 — Connect the n8n MCP server to Claude Code

Run this command in your terminal (replace URL and token with your own):

```bash
claude mcp add --transport http n8n-mcp https://your-n8n-instance.com/mcp-server/http \
  --header "Authorization: Bearer YOUR_N8N_API_KEY"
```

Generate your API key in n8n under **Settings → API → Create API Key**.
Verify the connection is working by running `claude` and checking that n8n tools appear.

### Step 2 — Create workflows one at a time

Paste each prompt below into Claude Code **one at a time**, verify the workflow was created and activated in n8n, copy the returned webhook URL into `.env.local`, then proceed to the next.

**Order is important**: Workflow 0 must be created and activated first since Workflows 1, 2, and 3 all depend on its webhook URL.

---

### WORKFLOW 0 PROMPT — Sheet Operations

```
Using the n8n MCP server tools, create a new n8n workflow with the following exact specification. Create it step by step, adding each node, connecting them correctly, and adding all sticky note nodes as documentation. Name the workflow "Pulse - Sheet Operations".

═══════════════════════════════════════
STICKY NOTES — add these first
═══════════════════════════════════════

STICKY NOTE 1 — top of canvas, named "📋 WORKFLOW OVERVIEW":
Content:
PULSE - SHEET OPERATIONS (Workflow 0)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

PURPOSE:
Single gateway for ALL Google Sheet read/write operations.
Every other workflow and the app itself calls THIS workflow
instead of touching Google Sheets directly.
The app has zero Google credentials — this workflow owns all Sheet access.

TRIGGER: POST webhook — called by:
  - App routes (via lib/n8n-sheet.ts helper)
  - Workflow 1 (Content Repurpose) — to write generated text
  - Workflow 2 (Image Repurpose) — to write image URLs
  - Workflow 3 (Publish) — to update post status

CRITICAL — THIS WORKFLOW IS SYNCHRONOUS:
Unlike Workflows 1, 2, 3 which respond immediately and process async,
this workflow MUST complete the Sheet operation BEFORE responding.
The caller is waiting for the response — do NOT use immediate response.
Timeout on caller side is 15 seconds. Keep Sheet operations fast.

SUPPORTED ACTIONS (7 total):
  GET_ALL_POSTS             → Read all rows, map to LinkedInPost[]
  GET_POST_BY_ID            → Find one row by post_id
  UPDATE_PLATFORM_VARIANT   → Update one platform's columns on one row
  UPDATE_MULTIPLE_PLATFORMS → Update all platforms on one row (batch)
  WRITE_CONTENT_PROMPTS     → Write content_prompt columns only
  WRITE_IMAGE_PROMPTS       → Write image_prompt columns only
  UPDATE_STATUS             → Write status/published_at/error columns only

GOOGLE SHEET STRUCTURE:
  Sheet name: "Posts"
  Columns A-D: post_id, linkedin_text, linkedin_image_url, posted_at
  Columns E-AW: 5 platforms x 9 columns each
  Each platform: text, content_prompt, image_prompt, image_url,
                 hashtags, status, scheduled_at, published_at, error

CREDENTIALS REQUIRED:
  Google Sheets service account — credential name: "Google Sheets - Pulse Repurpose"
  Spreadsheet ID: stored in n8n variable SPREADSHEET_ID

COLUMN MAP (hardcoded in "Define Column Map" Code node):
  twitter:   E F G H I J K L M
  threads:   N O P Q R S T U V
  instagram: W X Y Z AA AB AC AD AE
  facebook:  AF AG AH AI AJ AK AL AM AN
  skool:     AO AP AQ AR AS AT AU AV AW

STICKY NOTE 2 — near Webhook node, named "⚡ WEBHOOK TRIGGER":
Content:
WEBHOOK TRIGGER
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Path: pulse-sheet
Method: POST
Response Mode: Using Respond to Webhook Node

WHY "RESPOND TO WEBHOOK" MODE?
This mode tells n8n to NOT auto-respond after the trigger fires.
Instead, each action branch ends with its own "Respond to Webhook"
node that sends back the actual data. Required for synchronous
request/response behaviour.

EXPECTED REQUEST ENVELOPE:
{ "action": "GET_ALL_POSTS", "payload": { ...fields... } }

COPY THIS URL after activating:
→ Add to .env.local as N8N_SHEET_WEBHOOK_URL
→ Add to Workflow 1, 2, 3 as variable N8N_SHEET_WEBHOOK_URL
→ This is the most important URL in the entire system.

TESTING:
curl -X POST [this-url] \
  -H "Content-Type: application/json" \
  -d '{"action":"GET_ALL_POSTS","payload":{}}'
Should return { posts: [...] }

STICKY NOTE 3 — near "Define Column Map" node, named "🗺️ COLUMN MAP":
Content:
DEFINE COLUMN MAP
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
This Code node defines COLUMN_MAP and passes it downstream to every
branch. It is the single source of truth for column positions.

COLUMN LAYOUT (9 columns per platform):
  [0] text           — repurposed post text
  [1] content_prompt — JSON { systemPrompt, userPrompt } from skill
  [2] image_prompt   — fal.ai prompt string from image skill
  [3] image_url      — generated image URL
  [4] hashtags       — comma-separated, no # prefix
  [5] status         — pending/repurposed/approved/scheduled/published/failed
  [6] scheduled_at   — ISO date string
  [7] published_at   — ISO date string
  [8] error          — error message or empty

IF YOU ADD A COLUMN IN FUTURE:
Update ONLY this node. All other nodes use COLUMN_MAP dynamically.

STICKY NOTE 4 — near Switch node, named "🔀 ACTION ROUTER":
Content:
ACTION ROUTER (Switch Node)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Routes incoming requests to the correct branch based on "action" field.
Output 0 → GET_ALL_POSTS
Output 1 → GET_POST_BY_ID
Output 2 → UPDATE_PLATFORM_VARIANT
Output 3 → UPDATE_MULTIPLE_PLATFORMS
Output 4 → WRITE_CONTENT_PROMPTS
Output 5 → WRITE_IMAGE_PROMPTS
Output 6 → UPDATE_STATUS

STICKY NOTE 5 — near GET_ALL_POSTS branch, named "📖 GET ALL POSTS":
Content:
BRANCH: GET_ALL_POSTS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Reads all rows, maps to LinkedInPost[] format.
OPTIONAL FILTERS: statusFilter, platformFilter, fromDate, toDate
GOOGLE SHEETS NODE: Operation=Get Many, Return All=YES, First Row as Headers=YES
RESPONSE: { success: true, posts: LinkedInPost[] }

STICKY NOTE 6 — near GET_POST_BY_ID branch, named "🔍 GET POST BY ID":
Content:
BRANCH: GET_POST_BY_ID
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PAYLOAD: { postId: "post_001" }
RESPONSE: { success: true, post: LinkedInPost | null }
Returns null (not an error) if post_id not found.

STICKY NOTE 7 — near UPDATE_PLATFORM_VARIANT branch, named "✏️ UPDATE VARIANT":
Content:
BRANCH: UPDATE_PLATFORM_VARIANT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PAYLOAD: { postId, platform, variant: Partial<PlatformVariant> }
Only fields explicitly provided in variant are written.
Undefined fields are left unchanged in the Sheet.

STICKY NOTE 8 — near UPDATE_MULTIPLE_PLATFORMS branch, named "✏️✏️ UPDATE MULTI":
Content:
BRANCH: UPDATE_MULTIPLE_PLATFORMS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PAYLOAD: { postId, variants: { [platform]: Partial<PlatformVariant> } }
Updates multiple platforms in a single Google Sheets API call.
Used by Workflows 1 and 2 after generating content/images.

STICKY NOTE 9 — near WRITE_CONTENT_PROMPTS branch, named "📝 CONTENT PROMPTS":
Content:
BRANCH: WRITE_CONTENT_PROMPTS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PAYLOAD: { postId, prompts: { [platform]: JSON.stringify({systemPrompt, userPrompt}) } }
Written BEFORE Workflow 1 fires so prompt is persisted even if Claude fails.
Stored as JSON string in content_prompt column per platform.

STICKY NOTE 10 — near WRITE_IMAGE_PROMPTS branch, named "🎨 IMAGE PROMPTS":
Content:
BRANCH: WRITE_IMAGE_PROMPTS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PAYLOAD: { postId, prompts: { [platform]: "fal.ai prompt string" } }
Written BEFORE Workflow 2 fires so prompt is persisted even if fal.ai fails.
Plain string (not JSON) in image_prompt column per platform.

STICKY NOTE 11 — near UPDATE_STATUS branch, named "🚦 UPDATE STATUS":
Content:
BRANCH: UPDATE_STATUS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PAYLOAD: { postId, platform, status, publishedAt?, error? }
VALID STATUS VALUES:
  pending → repurposed → approved → scheduled → published → failed
Used by Workflow 3 after publishing. Lightweight — only touches status columns.

STICKY NOTE 12 — near error handler, named "❌ ERROR HANDLER":
Content:
ERROR HANDLER
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Returns HTTP 200 (not 500) with { success: false, error: "message" }.
App checks response.data.success, not HTTP status code.

COMMON ERRORS:
- "caller does not have permission" → share Sheet with service account email (Editor)
- "Unable to parse range" → sheet tab must be named exactly "Posts"
- "Quota exceeded" → Google Sheets API rate limit, add Wait node
- Empty response → ensure row 1 is headers, data starts row 2

═══════════════════════════════════════
NODES
═══════════════════════════════════════

STEP 1 — Create workflow named "Pulse - Sheet Operations"

STEP 2 — Webhook node:
- HTTP Method: POST, Path: pulse-sheet
- Response Mode: Using Respond to Webhook Node

STEP 3 — Code node "Define Column Map" (connected to Webhook):
- Mode: Run Once for All Items
const COLUMN_MAP = {
  twitter:   { text:'E', contentPrompt:'F', imagePrompt:'G', imageUrl:'H', hashtags:'I', status:'J', scheduledAt:'K', publishedAt:'L', error:'M' },
  threads:   { text:'N', contentPrompt:'O', imagePrompt:'P', imageUrl:'Q', hashtags:'R', status:'S', scheduledAt:'T', publishedAt:'U', error:'V' },
  instagram: { text:'W', contentPrompt:'X', imagePrompt:'Y', imageUrl:'Z', hashtags:'AA', status:'AB', scheduledAt:'AC', publishedAt:'AD', error:'AE' },
  facebook:  { text:'AF', contentPrompt:'AG', imagePrompt:'AH', imageUrl:'AI', hashtags:'AJ', status:'AK', scheduledAt:'AL', publishedAt:'AM', error:'AN' },
  skool:     { text:'AO', contentPrompt:'AP', imagePrompt:'AQ', imageUrl:'AR', hashtags:'AS', status:'AT', scheduledAt:'AU', publishedAt:'AV', error:'AW' },
};
const body = $input.first().json.body;
return [{ json: { ...body, COLUMN_MAP } }];

STEP 4 — Switch node "Route Action" (connected to "Define Column Map"):
- Mode: Rules, Data Type: String
- Value: {{ $json.action }}
- Rule 1: equals "GET_ALL_POSTS" → output 0
- Rule 2: equals "GET_POST_BY_ID" → output 1
- Rule 3: equals "UPDATE_PLATFORM_VARIANT" → output 2
- Rule 4: equals "UPDATE_MULTIPLE_PLATFORMS" → output 3
- Rule 5: equals "WRITE_CONTENT_PROMPTS" → output 4
- Rule 6: equals "WRITE_IMAGE_PROMPTS" → output 5
- Rule 7: equals "UPDATE_STATUS" → output 6

STEP 5 — BRANCH 0 (GET_ALL_POSTS):
Google Sheets node "GS Read All Rows":
- Operation: Get Many, Sheet: Posts, Return All: true, First Row as Headers: true
- Credential: "Google Sheets - Pulse Repurpose", SpreadsheetID: ={{ $vars.SPREADSHEET_ID }}

Code node "Map Rows To Posts":
const rows = $input.all();
const COLUMN_MAP = $('Define Column Map').first().json.COLUMN_MAP;
const payload = $('Define Column Map').first().json.payload || {};
const platforms = ['twitter','threads','instagram','facebook','skool'];
const posts = rows.map(row => {
  const r = row.json;
  if (!r['post_id']) return null;
  const platformData = {};
  platforms.forEach(p => {
    const cols = COLUMN_MAP[p];
    platformData[p] = {
      text: r[cols.text]||null, contentPrompt: r[cols.contentPrompt]||null,
      imagePrompt: r[cols.imagePrompt]||null, imageUrl: r[cols.imageUrl]||null,
      hashtags: r[cols.hashtags] ? r[cols.hashtags].split(',').map(h=>h.trim()).filter(Boolean) : [],
      status: r[cols.status]||'pending', scheduledAt: r[cols.scheduledAt]||null,
      publishedAt: r[cols.publishedAt]||null, error: r[cols.error]||null,
    };
  });
  return { id:r['post_id'], linkedinText:r['linkedin_text']||null, linkedinImageUrl:r['linkedin_image_url']||null, postedAt:r['posted_at']||null, platforms:platformData };
}).filter(Boolean);
let filtered = posts;
if (payload.statusFilter) filtered = filtered.filter(p => Object.values(p.platforms).some(v => v.status===payload.statusFilter));
if (payload.platformFilter) filtered = filtered.filter(p => p.platforms[payload.platformFilter]?.text);
if (payload.fromDate) filtered = filtered.filter(p => p.postedAt >= payload.fromDate);
if (payload.toDate) filtered = filtered.filter(p => p.postedAt <= payload.toDate);
return [{ json: { success:true, posts:filtered } }];

Respond to Webhook node "Respond: GET_ALL_POSTS":
- Response Body: {{ JSON.stringify($json) }}

STEP 6 — BRANCH 1 (GET_POST_BY_ID):
Google Sheets node "GS Read For Lookup": same settings as STEP 5

Code node "Find Row By Post ID":
const rows = $input.all();
const COLUMN_MAP = $('Define Column Map').first().json.COLUMN_MAP;
const postId = $('Define Column Map').first().json.payload?.postId;
const platforms = ['twitter','threads','instagram','facebook','skool'];
const row = rows.find(r => r.json['post_id'] === postId);
if (!row) return [{ json: { success:true, post:null } }];
const r = row.json;
const platformData = {};
platforms.forEach(p => {
  const cols = COLUMN_MAP[p];
  platformData[p] = {
    text:r[cols.text]||null, contentPrompt:r[cols.contentPrompt]||null,
    imagePrompt:r[cols.imagePrompt]||null, imageUrl:r[cols.imageUrl]||null,
    hashtags:r[cols.hashtags]?r[cols.hashtags].split(',').map(h=>h.trim()).filter(Boolean):[],
    status:r[cols.status]||'pending', scheduledAt:r[cols.scheduledAt]||null,
    publishedAt:r[cols.publishedAt]||null, error:r[cols.error]||null,
  };
});
return [{ json: { success:true, post:{ id:r['post_id'], linkedinText:r['linkedin_text']||null, linkedinImageUrl:r['linkedin_image_url']||null, postedAt:r['posted_at']||null, platforms:platformData } } }];

Respond to Webhook node "Respond: GET_POST_BY_ID":
- Response Body: {{ JSON.stringify($json) }}

STEP 7 — BRANCH 2 (UPDATE_PLATFORM_VARIANT):
Code node "Build Single Variant Update":
const COLUMN_MAP = $('Define Column Map').first().json.COLUMN_MAP;
const { postId, platform, variant } = $('Define Column Map').first().json.payload;
const cols = COLUMN_MAP[platform];
const updateObj = { 'post_id': postId };
if (variant.text !== undefined) updateObj[cols.text] = variant.text;
if (variant.contentPrompt !== undefined) updateObj[cols.contentPrompt] = variant.contentPrompt;
if (variant.imagePrompt !== undefined) updateObj[cols.imagePrompt] = variant.imagePrompt;
if (variant.imageUrl !== undefined) updateObj[cols.imageUrl] = variant.imageUrl;
if (variant.hashtags !== undefined) updateObj[cols.hashtags] = Array.isArray(variant.hashtags)?variant.hashtags.join(','):variant.hashtags;
if (variant.status !== undefined) updateObj[cols.status] = variant.status;
if (variant.scheduledAt !== undefined) updateObj[cols.scheduledAt] = variant.scheduledAt||'';
if (variant.publishedAt !== undefined) updateObj[cols.publishedAt] = variant.publishedAt||'';
if (variant.error !== undefined) updateObj[cols.error] = variant.error||'';
return [{ json: updateObj }];

Google Sheets node "GS Update Single Variant":
- Operation: Update, Sheet: Posts, Matching Column: post_id
- SpreadsheetID: ={{ $vars.SPREADSHEET_ID }}, Credential: "Google Sheets - Pulse Repurpose"

Respond to Webhook node "Respond: UPDATE_VARIANT": Response Body: {"success":true}

STEP 8 — BRANCH 3 (UPDATE_MULTIPLE_PLATFORMS):
Code node "Build Multi Platform Update":
const COLUMN_MAP = $('Define Column Map').first().json.COLUMN_MAP;
const { postId, variants } = $('Define Column Map').first().json.payload;
const updateObj = { 'post_id': postId };
Object.entries(variants).forEach(([platform, variant]) => {
  const cols = COLUMN_MAP[platform];
  if (!cols) return;
  if (variant.text !== undefined) updateObj[cols.text] = variant.text;
  if (variant.contentPrompt !== undefined) updateObj[cols.contentPrompt] = variant.contentPrompt;
  if (variant.imagePrompt !== undefined) updateObj[cols.imagePrompt] = variant.imagePrompt;
  if (variant.imageUrl !== undefined) updateObj[cols.imageUrl] = variant.imageUrl;
  if (variant.hashtags !== undefined) updateObj[cols.hashtags] = Array.isArray(variant.hashtags)?variant.hashtags.join(','):variant.hashtags;
  if (variant.status !== undefined) updateObj[cols.status] = variant.status;
  if (variant.scheduledAt !== undefined) updateObj[cols.scheduledAt] = variant.scheduledAt||'';
  if (variant.publishedAt !== undefined) updateObj[cols.publishedAt] = variant.publishedAt||'';
  if (variant.error !== undefined) updateObj[cols.error] = variant.error||'';
});
return [{ json: updateObj }];

Google Sheets node "GS Update Multiple Platforms":
- Operation: Update, Sheet: Posts, Matching Column: post_id
- SpreadsheetID: ={{ $vars.SPREADSHEET_ID }}, Credential: "Google Sheets - Pulse Repurpose"

Respond to Webhook node "Respond: UPDATE_MULTI": Response Body: {"success":true}

STEP 9 — BRANCH 4 (WRITE_CONTENT_PROMPTS):
Code node "Build Content Prompts Update":
const COLUMN_MAP = $('Define Column Map').first().json.COLUMN_MAP;
const { postId, prompts } = $('Define Column Map').first().json.payload;
const updateObj = { 'post_id': postId };
Object.entries(prompts).forEach(([platform, prompt]) => {
  const cols = COLUMN_MAP[platform];
  if (cols) updateObj[cols.contentPrompt] = prompt;
});
return [{ json: updateObj }];

Google Sheets node "GS Write Content Prompts":
- Operation: Update, Sheet: Posts, Matching Column: post_id
- SpreadsheetID: ={{ $vars.SPREADSHEET_ID }}, Credential: "Google Sheets - Pulse Repurpose"

Respond to Webhook node "Respond: WRITE_CONTENT_PROMPTS": Response Body: {"success":true}

STEP 10 — BRANCH 5 (WRITE_IMAGE_PROMPTS):
Code node "Build Image Prompts Update":
const COLUMN_MAP = $('Define Column Map').first().json.COLUMN_MAP;
const { postId, prompts } = $('Define Column Map').first().json.payload;
const updateObj = { 'post_id': postId };
Object.entries(prompts).forEach(([platform, prompt]) => {
  const cols = COLUMN_MAP[platform];
  if (cols) updateObj[cols.imagePrompt] = prompt;
});
return [{ json: updateObj }];

Google Sheets node "GS Write Image Prompts":
- Operation: Update, Sheet: Posts, Matching Column: post_id
- SpreadsheetID: ={{ $vars.SPREADSHEET_ID }}, Credential: "Google Sheets - Pulse Repurpose"

Respond to Webhook node "Respond: WRITE_IMAGE_PROMPTS": Response Body: {"success":true}

STEP 11 — BRANCH 6 (UPDATE_STATUS):
Code node "Build Status Update":
const COLUMN_MAP = $('Define Column Map').first().json.COLUMN_MAP;
const { postId, platform, status, publishedAt, error } = $('Define Column Map').first().json.payload;
const cols = COLUMN_MAP[platform];
const updateObj = { 'post_id':postId, [cols.status]:status };
if (publishedAt) updateObj[cols.publishedAt] = publishedAt;
if (error) updateObj[cols.error] = error;
return [{ json: updateObj }];

Google Sheets node "GS Update Status":
- Operation: Update, Sheet: Posts, Matching Column: post_id
- SpreadsheetID: ={{ $vars.SPREADSHEET_ID }}, Credential: "Google Sheets - Pulse Repurpose"

Respond to Webhook node "Respond: UPDATE_STATUS": Response Body: {"success":true}

STEP 12 — ERROR HANDLER:
Error Trigger node "On Workflow Error" connected to:
Respond to Webhook node "Respond: Error":
- Response Body: {"success":false,"error":"={{ $json.message || 'Unknown error' }}"}
- HTTP Status Code: 200

STEP 13 — WORKFLOW VARIABLES:
- SPREADSHEET_ID: your Google Sheets spreadsheet ID (from sheet URL)

STEP 14 — CREDENTIAL:
All Google Sheets nodes use credential "Google Sheets - Pulse Repurpose" (Service Account).
Share the spreadsheet with the service account email (Editor access).

STEP 15 — Activate the workflow.
STEP 16 — Return the full webhook URL → add to .env.local as N8N_SHEET_WEBHOOK_URL
          Also add this URL as variable N8N_SHEET_WEBHOOK_URL in Workflows 1, 2, and 3.
```

---

### WORKFLOW 1 PROMPT — Content Repurpose

```
Using the n8n MCP server tools, create a new n8n workflow with the following exact specification. Create it step by step, adding each node, connecting them correctly, and adding all sticky note nodes. Name the workflow "Pulse - Content Repurpose".

═══════════════════════════════════════
STICKY NOTES
═══════════════════════════════════════

STICKY NOTE 1 — top of canvas, named "📋 WORKFLOW OVERVIEW":
PULSE - CONTENT REPURPOSE (Workflow 1)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PURPOSE:
Receives pre-built Claude prompt payloads from the app (generated by
platform content skill files), calls Claude API for all 5 platforms in
parallel, writes results to Google Sheets via Workflow 0, then notifies
the app via callback URL.

TRIGGER: POST webhook — called by app route POST /api/trigger/repurpose

CRITICAL — RESPONDS IMMEDIATELY:
"Respond to Webhook" fires right after the trigger, BEFORE Claude calls.
Claude generation takes 10-30 seconds. Without immediate response the
app times out. Results written to Sheet; app polls for them.

INPUTS:
- postId: string
- contentPrompts: { [platform]: { systemPrompt: string, userPrompt: string } }
- callbackUrl: string

IMPORTANT — PROMPTS ARE PRE-BUILT:
The app's platform skill files already built systemPrompt + userPrompt.
This workflow passes them directly to Claude — it does NOT build prompts.

CREDENTIALS:
- "Anthropic - Pulse" (API key header credential)
- N8N_SHEET_WEBHOOK_URL (workflow variable = Workflow 0 URL)

FLOW:
Webhook → Respond 200 → Extract Body → Split Platforms →
Call Claude API → Parse Response → Aggregate → Write to Sheet → Callback

STICKY NOTE 2 — near Webhook, named "⚡ WEBHOOK TRIGGER":
Path: pulse-content-repurpose, Method: POST
Response Mode: Using Respond to Webhook Node
COPY THIS URL → .env.local as N8N_CONTENT_REPURPOSE_WEBHOOK_URL

PAYLOAD:
{
  "postId": "post_001",
  "contentPrompts": {
    "twitter":   { "systemPrompt": "...", "userPrompt": "..." },
    "threads":   { "systemPrompt": "...", "userPrompt": "..." },
    "instagram": { "systemPrompt": "...", "userPrompt": "..." },
    "facebook":  { "systemPrompt": "...", "userPrompt": "..." },
    "skool":     { "systemPrompt": "...", "userPrompt": "..." }
  },
  "callbackUrl": "https://your-app.com/api/callback/repurpose"
}

STICKY NOTE 3 — near "Split Platforms", named "🔀 SPLIT PLATFORMS":
Converts contentPrompts object into 5 separate items (one per platform)
so Claude API node runs once per platform concurrently.
All 5 Claude calls fire at the same time — total wait = slowest single call.

STICKY NOTE 4 — near "Call Claude API", named "🤖 CLAUDE API CALL":
MODEL: claude-sonnet-4-20250514, MAX TOKENS: 1024
CREDENTIAL: "Anthropic - Pulse" (Header Auth: x-api-key)
PROMPTS ARE PRE-BUILT — pass systemPrompt and userPrompt directly.
EXPECTED CLAUDE RESPONSE (JSON):
{ "text": "post text", "hashtags": ["tag1"], "format": "single"|"thread" }

STICKY NOTE 5 — near "Parse Claude Response", named "🔍 PARSE RESPONSE":
Extracts Claude's JSON from content[0].text.
Fallback: regex extract JSON block if Claude added explanation text.
OUTPUT: { postId, platform, callbackUrl, generatedText, hashtags, format }

STICKY NOTE 6 — near "Aggregate Results", named "📊 AGGREGATE":
Waits for ALL 5 Claude calls, combines into single variants object.
Sets status: "repurposed" for all platforms.
Single Sheet write is faster than 5 separate writes.

STICKY NOTE 7 — near "Write to Sheet", named "💾 WRITE TO SHEET":
HTTP POST to Workflow 0 using UPDATE_MULTIPLE_PLATFORMS action.
URL: {{ $vars.N8N_SHEET_WEBHOOK_URL }}
Sets all platform statuses to "repurposed" — app polling detects this.

STICKY NOTE 8 — near "Callback to App", named "📞 CALLBACK":
POST to callbackUrl: { postId, status: "done" }
App's /api/callback/repurpose re-fetches post from Sheet and refreshes UI.
Continue on Fail: true — never block on callback failure.

STICKY NOTE 9 — near error handler, named "❌ ERROR HANDLER":
On error: sets all platform statuses to "failed" in Sheet via Workflow 0,
then calls callbackUrl with { status: "failed", error: "..." }.
COMMON ERRORS:
- Anthropic 401 → check "Anthropic - Pulse" credential API key
- Anthropic 429 → rate limit, retry after 60s
- N8N_SHEET_WEBHOOK_URL undefined → set workflow variable

═══════════════════════════════════════
NODES
═══════════════════════════════════════

STEP 1 — Create workflow "Pulse - Content Repurpose"

STEP 2 — Webhook node:
- HTTP Method: POST, Path: pulse-content-repurpose
- Response Mode: Using Respond to Webhook Node

STEP 3 — Respond to Webhook node "Respond 200 Immediately" (connected directly to Webhook):
- Response Code: 200, Body: {"received":true}
- This fires FIRST before any processing

STEP 4 — Code node "Extract Body" (connected to Webhook, parallel to Respond node):
- Mode: Run Once for All Items
const body = $input.first().json.body;
return [{ json: { postId:body.postId, contentPrompts:body.contentPrompts, callbackUrl:body.callbackUrl } }];

STEP 5 — Code node "Split Platforms" (connected to "Extract Body"):
- Mode: Run Once for All Items
const { postId, contentPrompts, callbackUrl } = $input.first().json;
return Object.entries(contentPrompts).map(([platform, prompts]) => ({
  json: { postId, platform, systemPrompt:prompts.systemPrompt, userPrompt:prompts.userPrompt, callbackUrl }
}));

STEP 6 — HTTP Request node "Call Claude API" (connected to "Split Platforms"):
- Method: POST, URL: https://api.anthropic.com/v1/messages
- Authentication: Header Auth, Credential: "Anthropic - Pulse"
  (Header Name: x-api-key, Value: your Anthropic API key)
- Additional header: anthropic-version = 2023-06-01
- Body Type: JSON:
{
  "model": "claude-sonnet-4-20250514",
  "max_tokens": 1024,
  "system": "={{ $json.systemPrompt }}",
  "messages": [{ "role": "user", "content": "={{ $json.userPrompt }}" }]
}
- Run per item, Timeout: 60000ms, Continue on Fail: true

STEP 7 — Code node "Parse Claude Response" (connected to "Call Claude API"):
- Mode: Run Once for Each Item
const item = $input.first().json;
const rawText = item.content?.[0]?.text || '';
let parsed = { text:rawText, hashtags:[], format:'single' };
try { parsed = JSON.parse(rawText); } catch {
  const match = rawText.match(/\{[\s\S]*\}/);
  if (match) { try { parsed = JSON.parse(match[0]); } catch {} }
}
return [{ json: {
  postId: $('Split Platforms').item.json.postId,
  platform: $('Split Platforms').item.json.platform,
  callbackUrl: $('Split Platforms').item.json.callbackUrl,
  generatedText: parsed.text||rawText,
  hashtags: parsed.hashtags||[],
  format: parsed.format||'single',
} }];

STEP 8 — Code node "Aggregate Results" (connected to "Parse Claude Response"):
- Mode: Run Once for All Items
const items = $input.all();
const postId = items[0].json.postId;
const callbackUrl = items[0].json.callbackUrl;
const variants = {};
items.forEach(item => {
  variants[item.json.platform] = { text:item.json.generatedText, hashtags:item.json.hashtags, status:'repurposed' };
});
return [{ json: { postId, callbackUrl, variants } }];

STEP 9 — HTTP Request node "Write to Sheet" (connected to "Aggregate Results"):
- Method: POST, URL: ={{ $vars.N8N_SHEET_WEBHOOK_URL }}, Timeout: 15000ms
- Body: { "action":"UPDATE_MULTIPLE_PLATFORMS", "payload": { "postId":"={{ $json.postId }}", "variants":"={{ $json.variants }}" } }

STEP 10 — HTTP Request node "Callback to App" (connected to "Write to Sheet"):
- Method: POST, URL: ={{ $('Aggregate Results').item.json.callbackUrl }}, Timeout: 10000ms
- Body: { "postId":"={{ $('Aggregate Results').item.json.postId }}", "status":"done" }
- Continue on Fail: true

STEP 11 — Error Trigger "On Workflow Error" → Code node "Build Error Payload":
const error = $input.first().json;
const body = $('Extract Body').first()?.json || {};
return [{ json: { postId:body.postId||'unknown', callbackUrl:body.callbackUrl||null, errorMessage:error.message||'Unknown error' } }];

→ HTTP Request "Write Error to Sheet":
{ "action":"UPDATE_MULTIPLE_PLATFORMS", "payload": { "postId":"={{ $json.postId }}", "variants":{ "twitter":{"status":"failed","error":"={{ $json.errorMessage }}"}, "threads":{"status":"failed","error":"={{ $json.errorMessage }}"}, "instagram":{"status":"failed","error":"={{ $json.errorMessage }}"}, "facebook":{"status":"failed","error":"={{ $json.errorMessage }}"}, "skool":{"status":"failed","error":"={{ $json.errorMessage }}"} } } }

→ HTTP Request "Error Callback":
{ "postId":"={{ $('Build Error Payload').item.json.postId }}", "status":"failed", "error":"={{ $('Build Error Payload').item.json.errorMessage }}" }
Continue on Fail: true

STEP 12 — WORKFLOW VARIABLE:
N8N_SHEET_WEBHOOK_URL = webhook URL from Workflow 0

STEP 13 — Activate the workflow.
STEP 14 — Return the webhook URL → add to .env.local as N8N_CONTENT_REPURPOSE_WEBHOOK_URL
```

---

### WORKFLOW 2 PROMPT — Image Repurpose

```
Using the n8n MCP server tools, create a new n8n workflow with the following exact specification. Name the workflow "Pulse - Image Repurpose".

═══════════════════════════════════════
STICKY NOTES
═══════════════════════════════════════

STICKY NOTE 1 — top of canvas, named "📋 WORKFLOW OVERVIEW":
PULSE - IMAGE REPURPOSE (Workflow 2)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PURPOSE:
Receives pre-built image prompt payloads from the app (generated by
platform image skill files), calls fal.ai for all 5 platforms in parallel,
writes image URLs to Google Sheets via Workflow 0, then notifies app.

TRIGGER: POST webhook — called by app route POST /api/trigger/images

CRITICAL — RESPONDS IMMEDIATELY:
fal.ai generation takes 15-45s per image. 5 in parallel = slowest single.
Without immediate response the app times out (10s limit).

INPUTS:
- postId: string
- imagePayloads: { [platform]: { prompt, sourceImageUrl, styleDirectives: { width, height }, negativePrompt } }
- callbackUrl: string

PROMPTS ARE PRE-BUILT by image skill files — this workflow passes them directly to fal.ai.

CREDENTIALS:
- "fal.ai - Pulse" (Generic credential: field apiKey)
  Get key: https://fal.ai/dashboard/keys
- N8N_SHEET_WEBHOOK_URL (workflow variable = Workflow 0 URL)

FAL.AI MODEL: fal-ai/flux/schnell
Cost: ~$0.003/image, ~$0.015 per full repurpose run (5 platforms)

FLOW:
Webhook → Respond 200 → Extract Body → Split Platforms →
Call fal.ai → Parse Image URL → Aggregate → Write to Sheet → Callback

STICKY NOTE 2 — near Webhook, named "⚡ WEBHOOK TRIGGER":
Path: pulse-image-repurpose, Method: POST
Response Mode: Using Respond to Webhook Node
COPY THIS URL → .env.local as N8N_IMAGE_REPURPOSE_WEBHOOK_URL

PAYLOAD:
{
  "postId": "post_001",
  "imagePayloads": {
    "twitter": { "prompt": "...", "sourceImageUrl": null, "styleDirectives": { "width":1200, "height":675 }, "negativePrompt": "text, words..." },
    "threads": { ... }, "instagram": { ... }, "facebook": { ... }, "skool": { ... }
  },
  "callbackUrl": "https://your-app.com/api/callback/images"
}

STICKY NOTE 3 — near "Split Platforms", named "🔀 SPLIT PLATFORMS":
Converts imagePayloads into 5 items. All 5 fal.ai calls run concurrently.
Each item: { postId, platform, prompt, sourceImageUrl, width, height, negativePrompt, callbackUrl }

STICKY NOTE 4 — near "Call fal.ai API", named "🎨 FAL.AI API CALL":
MODEL: fal-ai/flux/schnell
URL: https://fal.run/fal-ai/flux/schnell
AUTH: Authorization: Key YOUR_FAL_KEY (credential "fal.ai - Pulse")
BODY: { prompt, image_size: {width, height}, negative_prompt, num_inference_steps:4, num_images:1 }
If sourceImageUrl provided, also include: image_url: sourceImageUrl
Timeout: 60s, Continue on Fail: true (one failed image doesn't block others)
Cost: ~$0.003 per image

STICKY NOTE 5 — near "Parse Image URL", named "🔍 PARSE IMAGE URL":
Extracts images[0].url from fal.ai response.
On failure: imageUrl = null (not fatal — app shows "regenerate image" button).
Image failure never blocks text content approval flow.

STICKY NOTE 6 — near "Aggregate Results", named "📊 AGGREGATE":
Waits for all 5 fal.ai calls (including any nulls from failures).
Status stays "repurposed" even if imageUrl is null.
Single batch Sheet write for all platforms.

STICKY NOTE 7 — near "Write Image URLs to Sheet", named "💾 WRITE TO SHEET":
HTTP POST to Workflow 0 with UPDATE_MULTIPLE_PLATFORMS.
Only imageUrl field updated — text and hashtags from Workflow 1 unchanged.
URL: {{ $vars.N8N_SHEET_WEBHOOK_URL }}

STICKY NOTE 8 — near "Callback to App", named "📞 CALLBACK":
POST to callbackUrl: { postId, status: "done" }
App /api/callback/images re-fetches post and refreshes image previews in UI.
Continue on Fail: true

STICKY NOTE 9 — near error handler, named "❌ ERROR HANDLER":
Catches fatal errors (not per-platform fal.ai failures — those use Continue on Fail).
Calls callbackUrl with { status: "failed", error: "..." }.
COMMON ERRORS:
- fal.ai 401 → check "fal.ai - Pulse" API key at fal.ai/dashboard/keys
- fal.ai 504 → timeout, retry or switch to fal-ai/flux/dev
- N8N_SHEET_WEBHOOK_URL undefined → set workflow variable

═══════════════════════════════════════
NODES
═══════════════════════════════════════

STEP 1 — Create workflow "Pulse - Image Repurpose"

STEP 2 — Webhook node:
- HTTP Method: POST, Path: pulse-image-repurpose
- Response Mode: Using Respond to Webhook Node

STEP 3 — Respond to Webhook "Respond 200 Immediately" (connected directly to Webhook):
- Response Code: 200, Body: {"received":true}

STEP 4 — Code node "Extract Body" (connected to Webhook, parallel to Respond):
const body = $input.first().json.body;
return [{ json: { postId:body.postId, imagePayloads:body.imagePayloads, callbackUrl:body.callbackUrl } }];

STEP 5 — Code node "Split Platforms" (connected to "Extract Body"):
const { postId, imagePayloads, callbackUrl } = $input.first().json;
return Object.entries(imagePayloads).map(([platform, payload]) => ({
  json: {
    postId, platform, callbackUrl,
    prompt: payload.prompt,
    sourceImageUrl: payload.sourceImageUrl||null,
    width: payload.styleDirectives?.width||1080,
    height: payload.styleDirectives?.height||1080,
    negativePrompt: payload.negativePrompt||'text, words, letters, blurry, low quality, distorted',
  }
}));

STEP 6 — HTTP Request node "Call fal.ai API" (connected to "Split Platforms"):
- Method: POST, URL: https://fal.run/fal-ai/flux/schnell
- Authentication: Header Auth, Credential: "fal.ai - Pulse"
  (Header: Authorization, Value: Key {{ $credentials['fal.ai - Pulse'].apiKey }})
- Body Type: JSON (expression mode):
={
  "prompt": $json.prompt,
  "image_size": { "width": $json.width, "height": $json.height },
  "negative_prompt": $json.negativePrompt,
  "num_inference_steps": 4,
  "num_images": 1,
  ...($json.sourceImageUrl ? { "image_url": $json.sourceImageUrl } : {})
}
- Run per item, Timeout: 60000ms, Continue on Fail: true

STEP 7 — Code node "Parse Image URL" (connected to "Call fal.ai API"):
const response = $input.first().json;
const platformData = $('Split Platforms').item.json;
let imageUrl = null;
let error = null;
try {
  imageUrl = response.images?.[0]?.url||null;
  if (!imageUrl) error = 'fal.ai returned no image URL';
} catch(e) { error = e.message; }
return [{ json: { postId:platformData.postId, platform:platformData.platform, callbackUrl:platformData.callbackUrl, imageUrl, error } }];

STEP 8 — Code node "Aggregate Results" (connected to "Parse Image URL"):
const items = $input.all();
const postId = items[0].json.postId;
const callbackUrl = items[0].json.callbackUrl;
const variants = {};
items.forEach(item => { variants[item.json.platform] = { imageUrl:item.json.imageUrl }; });
return [{ json: { postId, callbackUrl, variants } }];

STEP 9 — HTTP Request "Write Image URLs to Sheet":
- Method: POST, URL: ={{ $vars.N8N_SHEET_WEBHOOK_URL }}, Timeout: 15000ms
- Body: { "action":"UPDATE_MULTIPLE_PLATFORMS", "payload": { "postId":"={{ $json.postId }}", "variants":"={{ $json.variants }}" } }

STEP 10 — HTTP Request "Callback to App":
- Method: POST, URL: ={{ $('Aggregate Results').item.json.callbackUrl }}, Timeout: 10000ms
- Body: { "postId":"={{ $('Aggregate Results').item.json.postId }}", "status":"done" }
- Continue on Fail: true

STEP 11 — Error Trigger "On Workflow Error" → Code "Build Error Payload":
const error = $input.first().json;
const body = $('Extract Body').first()?.json||{};
return [{ json: { postId:body.postId||'unknown', callbackUrl:body.callbackUrl||null, errorMessage:error.message||'Unknown error' } }];

→ HTTP Request "Error Callback":
{ "postId":"={{ $json.postId }}", "status":"failed", "error":"={{ $json.errorMessage }}" }
URL: ={{ $json.callbackUrl }}, Continue on Fail: true

STEP 12 — CREDENTIAL: Create Generic credential "fal.ai - Pulse" with field apiKey = your fal.ai key

STEP 13 — WORKFLOW VARIABLE: N8N_SHEET_WEBHOOK_URL = Workflow 0 webhook URL

STEP 14 — Activate the workflow.
STEP 15 — Return webhook URL → add to .env.local as N8N_IMAGE_REPURPOSE_WEBHOOK_URL
```

---

### WORKFLOW 3 PROMPT — Publish

```
Using the n8n MCP server tools, create a new n8n workflow with the following exact specification. Name the workflow "Pulse - Publish".

═══════════════════════════════════════
STICKY NOTES
═══════════════════════════════════════

STICKY NOTE 1 — top of canvas, named "📋 WORKFLOW OVERVIEW":
PULSE - PUBLISH (Workflow 3)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PURPOSE:
Receives an approved post variant, routes to the correct platform,
publishes it, then updates Google Sheet status via Workflow 0.

TRIGGER: POST webhook — called by app route POST /api/publish

CRITICAL — RESPONDS IMMEDIATELY before publishing.

INPUTS: { postId, platform, text, imageUrl, hashtags, scheduledAt, sheetRowId }

OPTION A ROUTER: One webhook, Switch by platform. All publish logic in one place.

CREDENTIALS NEEDED:
- "Twitter - Pulse" (Twitter OAuth2)
- "Threads - Pulse" (HTTP Header Auth: Authorization: Bearer TOKEN)
- "Instagram - Pulse" (HTTP Header Auth: Authorization: Bearer TOKEN)
- "Facebook - Pulse" (HTTP Header Auth: Authorization: Bearer TOKEN)
- N8N_SHEET_WEBHOOK_URL (workflow variable)
- THREADS_USER_ID, INSTAGRAM_BUSINESS_ACCOUNT_ID, FACEBOOK_PAGE_ID (workflow variables)
- SKOOL_ZAPIER_WEBHOOK_URL, SKOOL_PUBLISH_MODE (workflow variables)

FLOW:
Webhook → Respond 200 → Extract & Format Body → Switch by Platform →
[Platform Publish Nodes] → Prepare Sheet Update → Update Sheet Status

STICKY NOTE 2 — near Webhook, named "⚡ WEBHOOK TRIGGER":
Path: pulse-publish, Method: POST
Response Mode: Using Respond to Webhook Node
COPY THIS URL → .env.local as N8N_PUBLISH_WEBHOOK_URL

PAYLOAD:
{ "postId":"post_001", "platform":"twitter", "text":"...", "imageUrl":"https://...",
  "hashtags":["tag1","tag2"], "scheduledAt":null, "sheetRowId":"post_001" }

STICKY NOTE 3 — near "Extract Body", named "📦 EXTRACT & FORMAT":
Formats text with hashtags per platform rules:
- Instagram: text + double newline + #hashtags
- Twitter/Threads/Facebook: text + double newline + #hashtags
- Skool: text only, NO hashtags ever

STICKY NOTE 4 — near Switch node, named "🔀 PLATFORM ROUTER":
Output 0 → twitter | Output 1 → threads | Output 2 → instagram
Output 3 → facebook | Output 4 → skool

STICKY NOTE 5 — near Twitter branch, named "🐦 TWITTER":
API: POST https://api.twitter.com/2/tweets
Auth: OAuth2, Credential: "Twitter - Pulse"
Scopes: tweet.read, tweet.write, users.read
Body: { "text": "post text with hashtags" }
Setup: https://developer.twitter.com/en/portal
Rate limits: Free=1500 tweets/month, Basic=3000/month

STICKY NOTE 6 — near Threads branch, named "🧵 THREADS":
TWO-STEP: Create container → Wait 2s → Publish container
Step 1: POST https://graph.threads.net/v1.0/{THREADS_USER_ID}/threads
        Body: { media_type:"TEXT"|"IMAGE", text:"...", image_url?:"..." }
        Returns: { id: "container_id" }
Step 2: POST https://graph.threads.net/v1.0/{THREADS_USER_ID}/threads_publish
        Body: { creation_id: "container_id" }
Get THREADS_USER_ID: GET https://graph.threads.net/v1.0/me?fields=id&access_token=TOKEN
Token scopes: threads_basic, threads_content_publish

STICKY NOTE 7 — near Instagram branch, named "📸 INSTAGRAM":
TWO-STEP: Create container → Wait 2s → Publish container
Requires Instagram Business/Creator account connected to Facebook Page.
Step 1: POST https://graph.facebook.com/v18.0/{INSTAGRAM_BUSINESS_ACCOUNT_ID}/media
        Body: { image_url:"public_url", caption:"text+hashtags" }
        NOTE: imageUrl MUST be publicly accessible. fal.ai URLs are public — this works.
        If imageUrl is null: skip publish, log error "Instagram requires an image"
Step 2: POST https://graph.facebook.com/v18.0/{INSTAGRAM_BUSINESS_ACCOUNT_ID}/media_publish
        Body: { creation_id: "container_id" }
Rate limit: 25 posts/day per account

STICKY NOTE 8 — near Facebook branch, named "👥 FACEBOOK":
API: POST https://graph.facebook.com/v18.0/{FACEBOOK_PAGE_ID}/feed
Auth: HTTP Header, Credential: "Facebook - Pulse" (Page Access Token)
Body text only: { "message": "text+hashtags" }
Body with image: { "message": "text+hashtags", "url": "imageUrl" }
Get Page Token: GET /me/accounts → copy page access_token
Token lasts indefinitely for pages you manage.

STICKY NOTE 9 — near Skool branch, named "🎓 SKOOL":
No official Skool API. Two options:
OPTION A (default): Zapier webhook → Skool integration
  Set SKOOL_ZAPIER_WEBHOOK_URL and SKOOL_PUBLISH_MODE="zapier"
  POST to Zapier: { "text": "post content", "postId": "post_001" }
OPTION B: Set SKOOL_PUBLISH_MODE="manual"
  Content saved, status set to "manual_required"
  User copy-pastes from dashboard
NO HASHTAGS — skool posts never include hashtags (enforced in Extract Body node)

STICKY NOTE 10 — near Sheet update nodes, named "💾 UPDATE SHEET":
After each platform publish (success or failure), calls Workflow 0 UPDATE_STATUS.
SUCCESS: { postId, platform, status:"published", publishedAt: ISO timestamp }
FAILURE: { postId, platform, status:"failed", error: "error message" }
App polls Sheet and reflects status in dashboard + calendar automatically.

STICKY NOTE 11 — near error handler, named "❌ ERROR HANDLER":
Catches fatal errors. Sets platform status to "failed" in Sheet.
COMMON PLATFORM ERRORS:
- Twitter 403 → app permissions not Read+Write
- Twitter 429 → rate limit, wait 15 min
- Threads 190 → token expired, refresh
- Instagram #9007 → imageUrl not publicly accessible
- Instagram #10 → account not Business/Creator type
- Facebook 200 → missing pages_manage_posts scope
- Skool Zapier 400 → check Zapier Zap is turned on

═══════════════════════════════════════
NODES
═══════════════════════════════════════

STEP 1 — Create workflow "Pulse - Publish"

STEP 2 — Webhook node:
- HTTP Method: POST, Path: pulse-publish
- Response Mode: Using Respond to Webhook Node

STEP 3 — Respond to Webhook "Respond 200 Immediately" (directly connected to Webhook):
- Response Code: 200, Body: {"received":true}

STEP 4 — Code node "Extract Body" (connected to Webhook, parallel branch):
const body = $input.first().json.body;
const hashtags = body.hashtags||[];
const hashtagStr = hashtags.map(h=>'#'+h).join(' ');
let textWithHashtags = body.text||'';
if (body.platform==='skool') {
  textWithHashtags = body.text;
} else if (hashtagStr) {
  textWithHashtags = body.text+'\n\n'+hashtagStr;
}
return [{ json: { postId:body.postId, platform:body.platform, text:body.text, textWithHashtags, imageUrl:body.imageUrl||null, hashtags, scheduledAt:body.scheduledAt||null, sheetRowId:body.sheetRowId||body.postId } }];

STEP 5 — Switch node "Route by Platform":
- Value: {{ $json.platform }}
- Rule 1: equals "twitter" → output 0
- Rule 2: equals "threads" → output 1
- Rule 3: equals "instagram" → output 2
- Rule 4: equals "facebook" → output 3
- Rule 5: equals "skool" → output 4

━━ TWITTER BRANCH (output 0) ━━

STEP 6a — HTTP Request "Twitter Post Tweet":
- Method: POST, URL: https://api.twitter.com/2/tweets
- Auth: OAuth2, Credential: "Twitter - Pulse"
- Body: { "text": "={{ $json.textWithHashtags }}" }
- Continue on Fail: true

STEP 6b — Code "Twitter Build Result":
const r=$input.first().json; const inp=$('Extract Body').first().json;
const success=!r.error&&r.data?.id;
return [{ json: { postId:inp.postId, platform:'twitter', sheetRowId:inp.sheetRowId, success, publishedPostId:r.data?.id||null, error:r.error?JSON.stringify(r.error):(success?null:'No post ID from Twitter') } }];

━━ THREADS BRANCH (output 1) ━━

STEP 7a — HTTP Request "Threads Create Container":
- Method: POST, URL: https://graph.threads.net/v1.0/={{ $vars.THREADS_USER_ID }}/threads
- Auth: Header Auth, Credential: "Threads - Pulse" (Authorization: Bearer TOKEN)
- Body (expression): ={ "media_type":$json.imageUrl?"IMAGE":"TEXT", "text":$json.textWithHashtags, ...($json.imageUrl?{"image_url":$json.imageUrl}:{}) }
- Continue on Fail: true

STEP 7b — Wait node "Wait 2s Before Threads Publish": 2 seconds

STEP 7c — HTTP Request "Threads Publish Container":
- Method: POST, URL: https://graph.threads.net/v1.0/={{ $vars.THREADS_USER_ID }}/threads_publish
- Auth: Header Auth, Credential: "Threads - Pulse"
- Body: { "creation_id": "={{ $('Threads Create Container').item.json.id }}" }
- Continue on Fail: true

STEP 7d — Code "Threads Build Result":
const r=$input.first().json; const inp=$('Extract Body').first().json;
const success=!r.error&&r.id;
return [{ json: { postId:inp.postId, platform:'threads', sheetRowId:inp.sheetRowId, success, publishedPostId:r.id||null, error:r.error?JSON.stringify(r.error):(success?null:'No ID from Threads') } }];

━━ INSTAGRAM BRANCH (output 2) ━━

STEP 8a — Code "Instagram Check Image":
const {imageUrl,postId,sheetRowId}=$input.first().json;
if(!imageUrl) return [{ json:{postId,platform:'instagram',sheetRowId,success:false,publishedPostId:null,error:'Instagram requires an image. Generate one first.'} }];
return [{ json:$input.first().json }];

STEP 8b — HTTP Request "Instagram Create Container":
- Method: POST, URL: https://graph.facebook.com/v18.0/={{ $vars.INSTAGRAM_BUSINESS_ACCOUNT_ID }}/media
- Auth: Header Auth, Credential: "Instagram - Pulse"
- Body: { "image_url":"={{ $json.imageUrl }}", "caption":"={{ $json.textWithHashtags }}" }
- Continue on Fail: true

STEP 8c — Wait "Wait 2s Before IG Publish": 2 seconds

STEP 8d — HTTP Request "Instagram Publish Container":
- Method: POST, URL: https://graph.facebook.com/v18.0/={{ $vars.INSTAGRAM_BUSINESS_ACCOUNT_ID }}/media_publish
- Auth: Header Auth, Credential: "Instagram - Pulse"
- Body: { "creation_id":"={{ $('Instagram Create Container').item.json.id }}" }
- Continue on Fail: true

STEP 8e — Code "Instagram Build Result":
const r=$input.first().json; const inp=$('Extract Body').first().json;
const success=!r.error&&r.id;
return [{ json:{postId:inp.postId,platform:'instagram',sheetRowId:inp.sheetRowId,success,publishedPostId:r.id||null,error:r.error?JSON.stringify(r.error):(success?null:'No ID from Instagram')} }];

━━ FACEBOOK BRANCH (output 3) ━━

STEP 9a — HTTP Request "Facebook Post to Page":
- Method: POST, URL: https://graph.facebook.com/v18.0/={{ $vars.FACEBOOK_PAGE_ID }}/feed
- Auth: Header Auth, Credential: "Facebook - Pulse"
- Body (expression): ={ "message":$json.textWithHashtags, ...($json.imageUrl?{"url":$json.imageUrl}:{}) }
- Continue on Fail: true

STEP 9b — Code "Facebook Build Result":
const r=$input.first().json; const inp=$('Extract Body').first().json;
const success=!r.error&&r.id;
return [{ json:{postId:inp.postId,platform:'facebook',sheetRowId:inp.sheetRowId,success,publishedPostId:r.id||null,error:r.error?JSON.stringify(r.error):(success?null:'No ID from Facebook')} }];

━━ SKOOL BRANCH (output 4) ━━

STEP 10a — Code "Skool Check Method":
const skoolMode=$vars.SKOOL_PUBLISH_MODE||'zapier';
const zapierUrl=$vars.SKOOL_ZAPIER_WEBHOOK_URL||null;
return [{ json:{...$input.first().json, skoolMode, zapierUrl, useZapier:skoolMode==='zapier'&&!!zapierUrl} }];

STEP 10b — HTTP Request "Skool Post via Zapier":
- Method: POST, URL: ={{ $json.zapierUrl||'https://hooks.zapier.com/placeholder' }}
- Body: { "text":"={{ $json.text }}", "postId":"={{ $json.postId }}" }
- Continue on Fail: true

STEP 10c — Code "Skool Build Result":
const r=$input.first().json; const inp=$('Extract Body').first().json;
const useZapier=$('Skool Check Method').item.json.useZapier;
const success=useZapier&&(r.status==='success'||r.attempt===1);
const status=!useZapier?'manual_required':success?'published':'failed';
const error=!useZapier?'Skool Zapier webhook not configured. Post manually.':success?null:JSON.stringify(r);
return [{ json:{postId:inp.postId,platform:'skool',sheetRowId:inp.sheetRowId,success,publishedPostId:null,status,error} }];

━━ SHARED SHEET UPDATE (receives from ALL 5 platform result nodes) ━━

STEP 11 — Code "Prepare Sheet Update" (merge all 5 result nodes as inputs):
const {postId,platform,success,error,status}=$input.first().json;
const finalStatus=status||(success?'published':'failed');
const payload={postId,platform,status:finalStatus};
if(success) payload.publishedAt=new Date().toISOString();
if(error) payload.error=error;
return [{ json:{action:'UPDATE_STATUS',payload} }];

STEP 12 — HTTP Request "Update Sheet Status":
- Method: POST, URL: ={{ $vars.N8N_SHEET_WEBHOOK_URL }}, Timeout: 15000ms
- Body: { "action":"={{ $json.action }}", "payload":"={{ $json.payload }}" }
- Continue on Fail: true

━━ ERROR HANDLER ━━

STEP 13 — Error Trigger "On Workflow Error" → Code "Build Fatal Error Payload":
const err=$input.first().json; const body=$('Extract Body').first()?.json||{};
return [{ json:{postId:body.postId||'unknown',platform:body.platform||'unknown',sheetRowId:body.sheetRowId||'unknown',errorMessage:err.message||'Unknown fatal error'} }];

→ HTTP Request "Fatal Error Update Sheet":
{ "action":"UPDATE_STATUS", "payload":{ "postId":"={{ $json.postId }}", "platform":"={{ $json.platform }}", "status":"failed", "error":"={{ $json.errorMessage }}" } }
URL: ={{ $vars.N8N_SHEET_WEBHOOK_URL }}, Continue on Fail: true

STEP 14 — WORKFLOW VARIABLES:
- N8N_SHEET_WEBHOOK_URL: Workflow 0 webhook URL
- THREADS_USER_ID: your Threads user ID
- INSTAGRAM_BUSINESS_ACCOUNT_ID: your Instagram Business Account ID
- FACEBOOK_PAGE_ID: your Facebook Page ID
- SKOOL_ZAPIER_WEBHOOK_URL: your Zapier webhook URL (or leave blank)
- SKOOL_PUBLISH_MODE: "zapier" or "manual"

STEP 15 — CREDENTIALS TO CREATE:
- "Twitter - Pulse" → Twitter OAuth2 API (scopes: tweet.read, tweet.write, users.read)
- "Threads - Pulse" → HTTP Header Auth (Header: Authorization, Value: Bearer TOKEN)
- "Instagram - Pulse" → HTTP Header Auth (Header: Authorization, Value: Bearer TOKEN)
- "Facebook - Pulse" → HTTP Header Auth (Header: Authorization, Value: Bearer PAGE_TOKEN)

STEP 16 — Activate the workflow.
STEP 17 — Return webhook URL → add to .env.local as N8N_PUBLISH_WEBHOOK_URL
```

---

### Step 3 — Copy webhook URLs to .env.local

After all 4 workflows are created and activated, your `.env.local` should contain:

```env
N8N_SHEET_WEBHOOK_URL=https://your-n8n.com/webhook/pulse-sheet
N8N_CONTENT_REPURPOSE_WEBHOOK_URL=https://your-n8n.com/webhook/pulse-content-repurpose
N8N_IMAGE_REPURPOSE_WEBHOOK_URL=https://your-n8n.com/webhook/pulse-image-repurpose
N8N_PUBLISH_WEBHOOK_URL=https://your-n8n.com/webhook/pulse-publish
```

### Step 4 — Add credentials inside n8n

After workflows are created, add these credentials in n8n (Settings → Credentials):
- **Google Sheets service account** — "Google Sheets - Pulse Repurpose" — share the spreadsheet with the service account email (Editor access)
- **Anthropic API key** — "Anthropic - Pulse" — Header Auth, header x-api-key
- **fal.ai API key** — "fal.ai - Pulse" — Generic credential with field apiKey
- **Twitter OAuth2** — "Twitter - Pulse" — scopes: tweet.read, tweet.write, users.read
- **Threads Bearer Token** — "Threads - Pulse" — HTTP Header Auth
- **Instagram Page Token** — "Instagram - Pulse" — HTTP Header Auth
- **Facebook Page Token** — "Facebook - Pulse" — HTTP Header Auth
- **Skool via Zapier** — no n8n credential needed, just set SKOOL_ZAPIER_WEBHOOK_URL variable

### Step 5 — Verify with the test endpoint

```
POST http://localhost:3000/api/test-webhooks
```

This fires test payloads to all 4 webhook URLs and reports which responded correctly. Fix any failures before going live.



## Agentic Operating System (AOS)

Pulse Repurpose is not just a CRUD app — it is a **living, learning agent** built on the Agentic Operating System ideology. The app has an identity, accumulates memory across sessions, learns from every repurposing decision, and runs autonomous scheduled operations. All intelligence is stored in plain Markdown files that the app reads, writes, and reasons over.

The AOS is made up of six layers: **Soul** (identity) → **Heartbeat** (orientation) → **User** (who it serves) → **Memory** (working context) → **Learnings** (accumulated intelligence) → **Skills** (executable runbooks).

---

### SOUL.md — App identity and operating principles

Located at the project root. Written once, rarely changed. This file defines what the app *is* and how it *thinks*. Every agent operation (cron, repurpose skill, memory updates) reads SOUL.md first to orient itself before acting.

Generate this file with the following content at project creation time:

```markdown
# SOUL.md — Pulse Repurpose

## Identity
I am Pulse Repurpose — a personal content operating system built for a single creator.
My purpose is to amplify one voice across every platform without diluting it.
I am not a scheduler. I am not a formatter. I am a learning creative partner.

## Core values
- **Voice fidelity**: Every repurposed piece must sound like the creator, not like AI.
- **Platform intelligence**: Each platform has its own culture. I adapt, never copy-paste.
- **Learning over rules**: I improve from every approval, rejection, and edit. Rules are defaults, patterns are truth.
- **Minimal friction**: The creator should spend time creating, not managing. I automate what is repetitive, surface what needs judgment.
- **Honest memory**: I only remember what I have actually observed. I do not invent patterns.

## Operating principles
1. Always read Heartbeat.md before starting any operation to orient to current system state.
2. Always read learnings.md before generating any content — learnings override default platform rules.
3. After every repurpose session, update MEMORY.md with what happened and learnings.md with what was learned.
4. Never overwrite a human-approved edit with a regenerated version without explicit confirmation.
5. When in doubt about voice, refer to the example posts in USER.md, not the brand voice config form.
6. Log every cron run to the daily memory folder with outcome and any anomalies.
7. The Google Sheet is the source of truth for post state. Memory files are the source of truth for intelligence.

## Technical principles
- All AI calls must include learnings.md context injected into the system prompt.
- Skills are runbooks, not code — they describe what to do, the app executes it.
- The Heartbeat.md file is the entry point for any agent operation. Always start there.
- Memory files are append-only for learnings, rolling-window for working memory.
- Daily memory snapshots are generated automatically at the end of each cron run.
- No external memory service (no vector DB, no embeddings) — everything is plain Markdown readable by any LLM.
```

---

### Heartbeat.md — Master orientation file

Located at the project root. Auto-updated by the cron skill after every run. Any agent operation — whether triggered by the user or by schedule — reads this file first to understand current system state before doing anything.

Generate this file at project creation with placeholder content. The cron skill overwrites it on each run.

```markdown
# Heartbeat.md — Pulse Repurpose System State

_Last updated: [auto-filled by cron]_

## System status
- App: running
- n8n workflows: [status filled by cron — all active / degraded / unknown]
- Last cron run: [ISO timestamp]
- Next cron run: [ISO timestamp]

## Content pipeline status
- New LinkedIn posts since last run: [N]
- Posts repurposed today: [N]
- Posts pending approval: [N]
- Posts scheduled this week: [N]
- Posts published this week: [N]

## Platform health
- Twitter: [last published / gap warning if >3 days]
- Threads: [last published / gap warning]
- Instagram: [last published / gap warning]
- Facebook: [last published / gap warning]
- Skool: [last published / gap warning]

## Active learning signals
- [auto-filled: e.g. "Twitter hooks with questions outperforming statements by 2x this month"]
- [auto-filled: e.g. "Instagram posts under 150 words getting approved faster"]

## Memory pointers
- USER.md: [path]
- MEMORY.md: [path]
- learnings.md: [path]
- Today's daily log: memory/daily/[date].md

## Flags requiring attention
- [auto-filled: e.g. "3 posts pending approval for >48h"]
- [auto-filled: e.g. "No Skool posts in 7 days"]
- [auto-filled: e.g. "Threads image generation failed for post_042"]
```

---

### memory/USER.md — User intelligence file

Written by the app after observing the user's behavior across sessions. Updated by the cron skill when new patterns emerge. This is the app's understanding of the human it serves — richer and more behavioral than the brand voice config form.

Generate with this initial structure, populated progressively by the learning system:

```markdown
# USER.md — Creator Profile

_Last updated: [auto-filled]_

## Identity
- Name: [filled from settings or first use]
- Primary platform: LinkedIn
- Content creation style: [observed — e.g. "writes long-form, then edits down"]
- Posting frequency: [observed — e.g. "3-4x per week on LinkedIn"]

## Voice fingerprint
_Observed from approved posts and manual edits — more reliable than the settings form._
- Sentence length: [e.g. "short, rarely over 20 words"]
- Opening style: [e.g. "starts with a direct statement or provocative question"]
- Closing style: [e.g. "ends with a call to think, rarely a call to action"]
- Recurring phrases: [e.g. "the truth is...", "most people don't realize..."]
- Emotional register: [e.g. "direct but not harsh, confident but not arrogant"]

## Platform behavior
- Platforms regularly approved: [filled by learning system]
- Platforms frequently edited before approval: [filled by learning system]
- Platforms often skipped: [filled by learning system]

## Approval patterns
_What gets approved fast vs what gets reworked._
- Fast approvals: [e.g. "Twitter threads under 5 tweets", "Skool posts reframed as questions"]
- Frequently edited: [e.g. "Instagram captions — user shortens them every time"]
- Frequently rejected: [e.g. "Facebook posts with bullet points"]

## Content preferences
- Best performing topics: [filled from performance data]
- Topics that underperform: [filled from performance data]
- Preferred hashtag style: [e.g. "3-5 specific hashtags, avoids generic ones like #entrepreneurship"]
```

---

### memory/MEMORY.md — Rolling working memory

This is the app's short-term working memory. It holds the current session context, recent actions, and anything relevant for the next operation. It is a rolling window — older entries are summarized and moved to the daily log when they exceed 500 lines.

The cron skill writes to this file. The repurpose skill reads from it. The API routes append to it after significant events.

```markdown
# MEMORY.md — Working Memory

_Rolling window — entries older than 7 days are archived to memory/daily/_

## Current session context
- Last repurposed post: [post_id, timestamp]
- Last platform published to: [platform, timestamp]
- Pending approvals: [list of post_ids and platforms]

## Recent events
[append-only log, newest first]
- [timestamp] Repurposed post_047 for all 5 platforms. Twitter auto-approved. Instagram edited (shortened caption).
- [timestamp] Cron run completed. 2 new LinkedIn posts found. Triggered repurpose for both.
- [timestamp] Facebook post for post_044 failed to publish — API token expired.
- [timestamp] User regenerated Twitter for post_043 — original was too formal.

## Open flags
- post_044 Facebook publish failed — needs manual token refresh
- post_046 pending approval for 3 days — no action taken

## Last learning update
- [timestamp] Updated learnings.md with Instagram caption length pattern
```

---

### memory/learnings.md — Accumulated intelligence

The most important memory file. This is what makes the app smarter over time. Every observation about what works and what doesn't is written here. The repurpose skill injects the relevant section of this file into every Claude prompt — so future repurposing is informed by past results.

Structured by category so relevant sections can be extracted efficiently.

```markdown
# learnings.md — Accumulated Intelligence

_Append-only. Never delete entries — mark as superseded if a learning is overridden._
_Last updated: [auto-filled]_

## Approval patterns
_Posts that get approved without edits vs posts that get reworked._

### Twitter
- [date] Threads of 3-5 tweets get approved faster than single long tweets. Confidence: medium (8 observations).
- [date] Tweets starting with a number ("3 things...", "After 5 years...") consistently approved without edits. Confidence: high (14 observations).
- [date] Tweets ending with a question get edited to remove the question ~60% of the time. User prefers statements. Confidence: medium (9 observations).

### Instagram
- [date] Captions over 200 words get shortened by user before approval every time. Target under 150 words. Confidence: high (11 observations).
- [date] Line breaks every 1-2 sentences approved as-is. Dense paragraphs always edited. Confidence: high (13 observations).

### Facebook
- [date] Bullet point format rejected 4/4 times. User rewrites to prose. Never use bullets. Confidence: high.
- [date] Posts ending with a direct question ("What do you think?") get published without edits. Confidence: medium (6 observations).

### Threads
- [date] Very short posts (under 100 words) get approved immediately. Longer ones get trimmed. Confidence: medium (7 observations).

### Skool
- [date] Posts reframed as "I want to share a lesson..." outperform direct rephrases. Confidence: medium (5 observations).

## Content performance
_Engagement data from LinkedIn scraping — which posts drive the most repurposing priority._

- [date] Posts about personal failures/lessons outperform tactical how-tos by ~40% on LinkedIn. Prioritize repurposing these first.
- [date] Posts with specific numbers in the headline (not vague) get more shares.
- [date] Short posts (under 300 words on LinkedIn) generate more comments than long ones.

## Hashtag intelligence
_Which hashtags have driven engagement vs which are noise._

- [date] #buildinpublic on Twitter consistently outperforms broader tags like #entrepreneur. Keep using.
- [date] Instagram: 8-12 hashtags outperforms 3-5 or 15+. Sweet spot identified.
- [date] #solopreneur on Threads underperforming — low engagement. Reduce usage.

## Platform-specific tone adjustments
_Tone corrections the user has made that reveal platform preferences._

- [date] Threads: user removes formal language ("it is important to note") every time. Keep very casual.
- [date] Twitter: user adds more punch to opening lines — the AI version is too gentle. Start more boldly.
- [date] Instagram: user adds personal "I" statements — AI version too general. First-person always.

## Superseded learnings
_Old learnings that have been replaced by newer observations._
- [superseded by entry above] ~~Instagram: 15 hashtags optimal~~ → updated to 8-12 based on newer data.
```

---

### memory/daily/YYYY-MM-DD.md — Daily memory snapshots

One file per day, auto-generated by the cron skill at the end of each run. These are permanent records — never deleted. They serve as an audit trail of what the app did each day.

```markdown
# Daily Memory — [DATE]

## Cron run summary
- Started: [timestamp]
- Completed: [timestamp]
- Duration: [N seconds]

## New LinkedIn posts found
- post_051: "The biggest mistake I made scaling my first product..." [snippet]
- post_052: "3 tools I use every morning before opening email" [snippet]

## Repurpose actions taken
- post_051: triggered content repurpose webhook ✓, image repurpose webhook ✓
- post_052: triggered content repurpose webhook ✓, image repurpose webhook pending (fal.ai timeout)

## Platform gap warnings surfaced
- Instagram: 4 days since last post — surfaced in Heartbeat.md
- Skool: 6 days since last post — surfaced in Heartbeat.md

## Calendar fill suggestions generated
- Suggested scheduling post_049 (approved, unscheduled) for Instagram on [date] at 09:00
- Suggested scheduling post_050 (approved, unscheduled) for Twitter on [date] at 14:00

## Learning updates
- Added 1 new approval pattern observation (Twitter)
- Updated USER.md posting frequency (now 4x/week LinkedIn)

## Flags raised
- post_052 image generation failed — fal.ai timeout. Added to MEMORY.md open flags.

## Heartbeat.md updated: ✓
```

---

### skills/repurpose.md — Repurpose skill

A skill is a plain-Markdown runbook that describes a complete operation end-to-end. It is not code — it is a specification that the app's agent layer reads and executes step by step. Think of it as a recipe the AI follows when performing the repurpose operation.

The app exposes a `/api/skills/repurpose` route that reads this file and executes each step, injecting memory context at the appropriate points.

```markdown
# Skill: Repurpose

## Purpose
Transform a LinkedIn post into platform-optimized variants for Twitter, Threads, Instagram,
Facebook, and Skool — using accumulated learnings to produce output that matches the creator's
voice and gets approved without editing.

## Pre-conditions
- Post exists in the Sheet with linkedinText populated
- SOUL.md is readable
- learnings.md is readable
- USER.md is readable

## Memory injection
Before generating any content, load and inject the following into the Claude system prompt:
1. Full contents of SOUL.md (operating principles section)
2. Full contents of memory/learnings.md (all sections relevant to the target platforms)
3. USER.md voice fingerprint and approval patterns sections
4. Brand voice profile from config/brand-voice.json
5. Platform rules from lib/platform-rules.ts

Priority order when conflicts exist: learnings.md > USER.md > brand-voice.json > platform-rules.ts
Learnings always win because they are observed truth. Rules are defaults.

## Execution steps

### Step 1 — Pre-flight
- Read Heartbeat.md to check system state
- Confirm n8n Sheet webhook is reachable (GET_POST_BY_ID with the target postId)
- Confirm N8N_CONTENT_REPURPOSE_WEBHOOK_URL is set
- Log start to MEMORY.md: "[timestamp] Starting repurpose for [postId]"

### Step 2 — Build enriched system prompt
Construct the Claude system prompt by concatenating:
```
[SOUL.md operating principles]

[learnings.md — full content]

[USER.md — voice fingerprint + approval patterns]

[brand voice profile JSON as readable text]

CRITICAL INSTRUCTIONS FROM LEARNINGS:
For Twitter: [extract Twitter-specific approval patterns from learnings.md]
For Instagram: [extract Instagram-specific patterns]
[...per platform]

Your goal is to generate repurposed content that will be approved WITHOUT edits.
Study the approval patterns above carefully — they represent real observations of what this
creator approves and what they change. Optimize for zero-edit approval.
```

### Step 3 — Fire content repurpose webhook
- POST to N8N_CONTENT_REPURPOSE_WEBHOOK_URL with enriched payload
- Include the full system prompt in the payload so n8n passes it directly to Claude
- Set all platform statuses to "generating_text" via Sheet webhook

### Step 4 — Wait for callback + poll
- Poll GET_POST_BY_ID every 3 seconds
- Timeout after 5 minutes with error log

### Step 5 — Fire image repurpose webhook
- Call generateImagePrompts (Claude direct) using learnings context
- Include any visual style observations from learnings.md in image prompts
- POST to N8N_IMAGE_REPURPOSE_WEBHOOK_URL

### Step 6 — Post-generation learning capture
After variants are written to Sheet:
- Append to MEMORY.md: "[timestamp] Repurpose complete for [postId]. Platforms: [list]. Awaiting approval."
- Note any generation anomalies (timeouts, retries, unusual outputs)

### Step 7 — Approval monitoring (async)
The skill registers a watch on the post. When the user approves or edits a variant:
- If approved without edits: append observation to learnings.md — "[date] [platform]: [brief description of what was approved as-is]. Confidence+1."
- If edited before approval: append observation to learnings.md — "[date] [platform]: user changed [what]. AI had [what]. Learning: [inferred pattern]."
- If rejected: append — "[date] [platform]: rejected. Reason if visible: [reason]."
- Update USER.md approval patterns section

### Step 8 — Update Heartbeat.md
Append post to "Content pipeline status" section.

## Error handling
- n8n webhook timeout: log to MEMORY.md open flags, surface in Heartbeat.md
- Claude API error: retry once with simplified prompt (drop learnings context if too long)
- Image generation failure: log to daily memory, proceed without blocking text approval

## Success criteria
A repurpose run is successful when:
- All 5 platform text variants are written to the Sheet
- At least 3/5 image variants are generated
- MEMORY.md is updated
- Heartbeat.md reflects the new pipeline status
```

---

### skills/cron.md — Cron skill

The cron skill is the app's autonomous heartbeat. It runs on a schedule and performs all automated operations. It is triggered by a Next.js cron route (`/api/cron`) which is called by an external scheduler (Vercel Cron, system cron, or n8n Schedule trigger).

```markdown
# Skill: Cron

## Purpose
Run all scheduled operations for Pulse Repurpose. Maintain system health, trigger repurposing
for new posts, update memory, surface gaps, and keep Heartbeat.md current.

## Schedule
Default: daily at 07:00 local time.
Configurable via CRON_SCHEDULE env var (cron expression).

## Pre-flight checklist
Before doing anything else:
1. Read Heartbeat.md — check last run timestamp. If last run was less than 1 hour ago, abort (duplicate run guard).
2. Verify all 4 n8n webhook URLs are reachable (fire OPTIONS or HEAD requests).
3. Log run start to today's daily memory file: memory/daily/[today].md

## Operations (run in this order)

### Operation 1 — Ingest new LinkedIn posts
1. Call GET_ALL_POSTS via Sheet webhook with filter: postedAt > lastCronRunTimestamp
2. For each new post found:
   a. Check if all platform statuses are "pending"
   b. If yes: execute Repurpose skill (Step 1-6) for this post
   c. Log to daily memory: "New post [postId] found and repurpose triggered"
3. Update Heartbeat.md: "New LinkedIn posts since last run: [N]"

### Operation 2 — Performance scraping
1. Trigger the existing n8n Apify scraper (call its webhook or the existing n8n workflow) to pull LinkedIn engagement data for posts from the last 48 hours
2. For each post with engagement data:
   a. Compare engagement (likes, comments, shares) against previous posts on same topic
   b. If a post is in the top 25% for engagement: flag it in MEMORY.md as "high performer"
   c. Append to learnings.md: "[date] Content performance: [postId] — [topic summary] performed [X]% above average on LinkedIn. Prioritize repurposing similar content."
3. Update USER.md "best performing topics" section with any new patterns

### Operation 3 — Learning system update
1. Call GET_ALL_POSTS with filter: status changes in last 24 hours (approved, edited, rejected)
2. For each post with recent status changes:
   a. Compare current variant text against the last AI-generated text (detect if user edited)
   b. If edited: extract the diff, infer the pattern, append to learnings.md
   c. If approved without edits: increment confidence on matching learnings.md entry
   d. If multiple posts show same edit pattern: promote to high-confidence learning
3. Trim learnings.md if over 2000 lines: summarize oldest low-confidence entries into a paragraph, replace them

### Operation 4 — Gap detection
1. For each platform, find the most recent published post date (GET_ALL_POSTS, filter status=published, sort by publishedAt desc)
2. Calculate days since last publish per platform
3. For any platform with gap > 3 days:
   a. Check if there are approved+unscheduled posts that could fill the gap
   b. If yes: generate a calendar fill suggestion and append to Heartbeat.md flags
   c. If no: append to Heartbeat.md flags — "No approved content ready for [platform] — consider repurposing a post"
4. Run topic pillar gap detection:
   a. Scan last 10 published posts per platform for topic pillar keywords
   b. If any pillar missing from last 10 posts: flag in Heartbeat.md

### Operation 5 — Calendar fill suggestions
1. Find all approved+unscheduled variants across all posts (GET_ALL_POSTS filter: status=approved, scheduledAt=null)
2. Find gaps in the next 7 days calendar (slots with no scheduled posts per platform)
3. For each gap:
   a. Match an approved unscheduled variant to the gap (prioritize high-performing content topics)
   b. Generate a suggested schedule time (optimal posting times per platform: Twitter 9am/3pm, Instagram 11am/7pm, Facebook 1pm, Threads 10am, Skool 8am)
   c. Write suggestion to MEMORY.md — not auto-scheduled, user must confirm
4. Surface suggestions in Heartbeat.md "Flags requiring attention" section

### Operation 6 — Daily memory snapshot
1. Compile the daily memory file for today (memory/daily/[date].md) with:
   - All operations performed and their outcomes
   - New posts found and processed
   - Learning updates made
   - Gaps and suggestions surfaced
   - Any errors or flags
2. Summarize MEMORY.md — move events older than 7 days into the corresponding daily file, keep MEMORY.md focused on the last 7 days

### Operation 7 — Heartbeat.md update (final)
Rewrite Heartbeat.md with fresh data from all operations above:
- Update "Last cron run" timestamp
- Update all content pipeline counts
- Update platform health section
- Update active learning signals (top 3 most recent high-confidence learnings)
- Update flags requiring attention
- Update memory pointers

### Operation 8 — Completion log
- Append final summary to today's daily memory file
- Log to MEMORY.md: "[timestamp] Cron run completed. Duration: [N]s. Posts processed: [N]. Learnings updated: [N]."

## Error handling
- If any single operation fails, log the error and continue to next operation. Never abort the full cron run for a single failure.
- If Sheet webhook is unreachable: skip Operations 1, 2, 3, 4, 5. Update Heartbeat.md with "Sheet webhook unreachable — data operations skipped."
- All errors are written to today's daily memory file and flagged in Heartbeat.md.

## Success criteria
A cron run is successful when:
- Heartbeat.md has been updated with current timestamp
- Daily memory file exists for today
- MEMORY.md is within rolling window (not over 500 lines)
- No critical flags are silently dropped
```

---

### API routes for AOS

Add these routes to the app:

**GET /api/heartbeat**
- Read and return Heartbeat.md as JSON (parse the markdown sections into a structured object)
- Used by the dashboard to show system status

**POST /api/cron**
- Protected by `CRON_SECRET` env var (check `Authorization: Bearer [CRON_SECRET]` header)
- Reads `skills/cron.md` and executes each operation in sequence
- Returns a run summary JSON
- Can also be triggered manually from the dashboard with a "Run cron now" button (admin section)

**POST /api/skills/repurpose**
- Reads `skills/repurpose.md` and executes the repurpose skill for a given postId
- Replaces the simpler `POST /api/trigger/repurpose` — this version is memory-aware and learning-injected
- Request body: `{ postId: string, platforms?: Platform[] }`

**GET /api/memory**
- Returns current MEMORY.md and learnings.md contents as JSON
- Used by the settings page to show a "System memory" panel

**POST /api/memory/update**
- Append a manual note to MEMORY.md
- Used for the "Add context" feature in the UI

---

### Dashboard additions for AOS

Add a **System** section to the dashboard (collapsible panel at the top):

- **Heartbeat status bar**: Shows last cron run time, pipeline counts, and any active flags as dismissible chips
- **Active learnings panel**: Shows the 5 most recent high-confidence entries from learnings.md — gives the user visibility into what the app has learned
- **Memory panel**: Collapsible — shows MEMORY.md current open flags and recent events
- **"Run cron now" button**: Triggers `POST /api/cron` manually with confirmation dialog
- **Platform gap warnings**: Surfaced from Heartbeat.md, each with a "Repurpose a post" CTA

---

### Environment variables — AOS additions

Add to `.env.local`:

```env
# AOS — Cron
CRON_SECRET=                       # Bearer token to protect /api/cron from unauthorized calls
CRON_SCHEDULE=0 7 * * *            # Default: daily at 07:00 (standard cron expression)
```

---

### Implementation order additions

Add these steps after step 14 (Calendar page) and before step 15 (Polish):

```
14b. AOS file generation — create SOUL.md, Heartbeat.md, memory/USER.md, memory/MEMORY.md,
     memory/learnings.md, skills/repurpose.md, skills/cron.md at project init with correct
     starter content as specified above. These files must exist before any agent operation runs.

14c. Memory-aware repurpose skill — upgrade POST /api/skills/repurpose to read and inject
     learnings.md + USER.md into the content repurpose webhook payload

14d. Learning capture — add approval/edit event listeners that append to learnings.md
     when a user approves, edits, or rejects a platform variant

14e. Cron skill implementation — POST /api/cron executing skills/cron.md step by step

14f. Heartbeat API + dashboard system panel

14g. AOS memory panel in settings page (view/edit MEMORY.md and learnings.md)
```


---

## Implementation order

Build in this sequence to get a working app fastest:

1. Project setup, types, and env configuration
2. n8n Sheet webhook integration (`lib/n8n-sheet.ts` + GET /api/posts + PATCH /api/posts/[id])
   — This is step 2 because every other feature depends on data loading. Verify the Sheet workflow is live in n8n before proceeding.
2b. Content store setup (`lib/content-store.ts` + `content/` directory + install `gray-matter`) — set up early since callbacks and the repurpose skill both write files
2c. Auto-documentation system (`lib/docs-sync.ts` + `CHANGELOG.md` + `POST /api/docs/sync` + `GET /api/docs/status`) — set up before any further features so every subsequent step auto-documents itself
3. Brand voice config system (`lib/brand-voice.ts` + Settings page — Brand Voice tab)
4. Platform rules (`lib/platform-rules.ts`)
5. n8n async webhook layer (`lib/n8n.ts` — content repurpose, image repurpose, publish fire functions)
6. Trigger routes (`POST /api/trigger/repurpose` + `POST /api/trigger/images`)
7. Callback routes (`POST /api/callback/repurpose` + `POST /api/callback/images`) — both write content files via `lib/content-store.ts`
8. Dashboard page (table + filters + slide-over)
9. Repurpose page — skeleton + polling + platform cards (no chat yet)
10. Publish flow (`POST /api/publish` + approve buttons)
11. Anthropic direct calls (`lib/anthropic.ts` — chat + image prompts + hashtags)
12. AI chat sidebar on repurpose page
13. Hashtag bank system + Settings Hashtag Bank tab + `/api/hashtags`
14. Calendar page (FullCalendar + gap detection)
14b. AOS file generation — create SOUL.md, Heartbeat.md, memory/USER.md, memory/MEMORY.md, memory/learnings.md, skills/repurpose.md, skills/cron.md at project init with correct starter content
14c. Platform skill files — generate all 10 skill files (5 content + 5 image) in skills/platforms/ with correct starter templates as specified in the platform skills section
14c-i. POST /api/skills/platform-prompt route — executes any platform skill and returns structured ContentPromptOutput or ImagePromptOutput. Test each skill file end-to-end.
14c-ii. Memory-aware repurpose skill — upgrade POST /api/skills/repurpose to call all platform skills in parallel before firing n8n webhooks. Replace old brandVoice/imagePrompts payloads with contentPrompts/imagePayloads maps.
14c-iii. Update n8n Workflow 1 to receive contentPrompts and pass systemPrompt+userPrompt directly to Claude per platform. Update n8n Workflow 2 to receive full imagePayloads and use all fields for fal.ai call.
14d. Learning capture — approval/edit event listeners that append to learnings.md when a user approves, edits, or rejects a platform variant
14e. Cron skill implementation — POST /api/cron executing all 8 operations from skills/cron.md
14f. Heartbeat API (GET /api/heartbeat) + dashboard system panel
14g. AOS memory panel in settings page (view/edit MEMORY.md and learnings.md)
15. Polish: auto-trigger safeguard, webhook URL validation banner, keyboard shortcuts, error states, first-run experience

---

---

## Gap Features — Phase 2 Additions

These features were identified via industry gap analysis (March 2026) against leading tools (Buffer, Taplio, Lately.ai, Repurpose.io). They are prioritised by impact and added as new build sessions.

---

### Analytics Integration

**Goal**: Pull real engagement data from published platforms via n8n and store in Google Sheet + local analytics store. Feed this into the learning system so the AOS improves from actual performance, not just approval patterns.

#### Google Sheet schema additions

Add these columns to the Sheet (one set per platform, appended after existing columns):

```
[platform]_impressions     integer — post reach/impressions
[platform]_likes           integer
[platform]_comments        integer
[platform]_shares          integer
[platform]_engagement_rate float — (likes+comments+shares) / impressions * 100
[platform]_fetched_at      ISO date string — when metrics were last pulled
```

#### n8n Workflow 4 — Analytics Fetch

**Trigger**: Scheduled (cron) — daily at 6am, or called via `POST /api/trigger/analytics`

For each published post (status = `published`):
1. Platform-specific API calls to fetch engagement metrics (Twitter API v2, Instagram Graph API, Facebook Graph API, etc.)
2. Write metrics to the Sheet via Workflow 0 (`UPDATE_ANALYTICS` action)
3. Call app callback `POST /api/callback/analytics` with `{ postId, platform, metrics }`

**New Sheet action**: `UPDATE_ANALYTICS`
```typescript
{
  postId: string
  platform: Platform
  metrics: {
    impressions: number
    likes: number
    comments: number
    shares: number
    engagementRate: number
  }
}
```

#### App-side analytics

**`lib/analytics.ts`** — helpers:
- `getPostAnalytics(postId: string)` — reads analytics columns from Sheet via n8n
- `getTopPerformingPosts(platform: Platform, limit: number)` — sorted by engagement rate
- `getBestPostingTimes(platform: Platform)` — derives from `published_at` timestamps of top posts
- `getPlatformSummary(platform: Platform)` — avg engagement rate, total impressions, total posts

**`/analytics` page** (new route):
- Per-platform stats bar: total posts, avg engagement rate, total impressions, best performing post
- Top posts table: sorted by engagement rate, shows post preview + metrics
- Best time to post: derived from historical data, shown as a simple hour recommendation
- Empty state: "Publish some posts first — analytics will appear here once platform metrics are fetched"

**Dashboard stats bar additions**: Add "Avg engagement rate this week" and "Top platform" stats.

**Cron skill integration** (Operation 9 — new):
After fetching analytics, for each post with new metrics:
1. Compare engagement rate to historical average for that platform
2. If engagement rate > 2× average: append to `learnings.md` under `## Content performance` with the post snippet and what made it different (topic, format, hook style)
3. If engagement rate < 0.5× average: flag patterns to avoid in `learnings.md`

This closes the performance → learning feedback loop: actual platform data drives future AI generation quality.

---

### First Comment Scheduling

**Goal**: Schedule the first comment alongside a post (critical for LinkedIn — hashtags and links in first comment don't suppress reach).

#### Type additions

```typescript
export interface PlatformVariant {
  // ... existing fields ...
  firstComment: string | null        // Text for the first comment (links, hashtags)
  firstCommentScheduledAt: string | null  // When to post the comment (= post scheduledAt)
}
```

#### Sheet schema additions

Add per-platform:
```
[platform]_first_comment        string — first comment text
[platform]_first_comment_status pending | published | failed
```

#### n8n Workflow 3 update (Publish)

After posting the main content, if `payload.firstComment` is present:
1. Wait 30 seconds (gives the post time to propagate)
2. Call platform API to post as a comment on the published post
3. Update Sheet `[platform]_first_comment_status` to `published` or `failed`

#### UI additions

In each platform card on the repurpose page:
- **First comment textarea** — below main text, collapsible ("+ Add first comment")
- Pre-filled suggestion for LinkedIn: top 3 relevant hashtags from hashtag bank + any links from the post
- Character limit indicator
- On approve: first comment text is saved to Sheet alongside main variant

Platform-specific defaults:
- **LinkedIn**: suggested first comment = hashtags (from hashtag bank) + any links mentioned in post text
- **Twitter/X**: not shown (replies work differently)
- **Instagram**: not shown (first comment is less impactful)
- **Facebook/Skool**: shown but optional

---

### Bulk Repurpose

**Goal**: Select multiple posts from the dashboard and repurpose all at once.

#### Dashboard additions

- **Checkbox column** on each row in PostsTable
- **"Select all" checkbox** in header
- **Bulk action bar** (appears when ≥1 post selected):
  - "Repurpose selected (N)" — fires `POST /api/trigger/repurpose` for each selected post sequentially (not parallel — avoids rate limits)
  - "Clear selection" button
  - Count: "5 posts selected"

#### API additions

**`POST /api/trigger/repurpose/bulk`**
```typescript
// Request body:
{
  postIds: string[]
  platforms?: Platform[]   // default: all 5
}
// Processes posts sequentially with 2s delay between each
// Returns: { queued: number; results: Array<{ postId: string; success: boolean; error?: string }> }
```

Sequential processing with delay prevents n8n from being overwhelmed. Each post fires its own trigger, same as single repurpose.

**Bulk filter**: Only repurpose posts where ALL platforms are `pending`. Skip posts already in progress.

---

### Evergreen Content Recycling Queue

**Goal**: Re-queue top-performing posts for re-publication after a configurable interval.

#### Settings additions — "Evergreen" tab on `/settings`

- **Enable evergreen recycling** toggle (off by default)
- **Minimum engagement threshold**: only recycle posts with engagement rate ≥ X% (default: 2%)
- **Recycle interval**: minimum days between republications (default: 90 days)
- **Platforms to recycle**: checkboxes per platform
- Save to `config/evergreen.json`

#### Cron skill additions (Operation 10 — new)

**Operation 10 — Evergreen queue check**:
1. Load `config/evergreen.json` — if disabled, skip
2. Get all published posts from Sheet where `published_at` < (today − recycle_interval)
3. For each: check `[platform]_engagement_rate` ≥ threshold
4. For qualifying posts: set status back to `approved` in Sheet (ready to be scheduled again)
5. Log to `memory/learnings.md`: "Evergreen: recycled [N] posts for [platform]"
6. These posts appear in dashboard with `approved` status and a subtle "♻ Recycled" badge

#### UI additions

- **"♻" badge** on post rows in dashboard where a variant has been recycled
- **Evergreen tab** in settings with the configuration above

---

### Hook Variant Generation

**Goal**: Generate 2–3 hook options per platform so the user can pick the best opening before approving.

#### Platform skill update

All content skill files: add a `hookVariants` field to the output contract.

Updated `ContentPromptOutput`:
```typescript
interface ContentPromptOutput {
  systemPrompt: string
  userPrompt: string
  hookVariants: string[]   // 2-3 alternative opening lines — user picks one or uses AI default
  context: { ... }
}
```

The system prompt in each skill file instructs the model to additionally return 2–3 hook alternatives at the top of the output.

#### UI additions

In each platform card, after text generation:
- **Hook picker panel** (collapsible, shown above the main textarea): "Try a different hook"
- Shows 2–3 hook options as clickable chips
- Clicking a hook replaces the first line of the generated text in the textarea
- Marked with "✎ edited" indicator since it's a user modification
- If `hookVariants` is empty or missing (model didn't return them): panel is hidden

---

### LinkedIn Carousel / PDF Posts

**Goal**: Generate carousel-format content (multi-slide posts uploaded as PDF) as an additional output format — LinkedIn's highest-reach format.

#### New platform skill variant

Add `linkedin-carousel-content.md` to `skills/platforms/`:
- Input: `linkedinText` (source post)
- Output: structured slide deck content

New `CarouselPromptOutput`:
```typescript
interface CarouselPromptOutput {
  postId: string
  coverSlide: {
    headline: string      // Bold hook — max 8 words
    subheadline: string   // Supporting line — max 15 words
  }
  slides: Array<{
    slideNumber: number
    title: string         // Max 8 words
    body: string          // 2–3 bullet points or 1 short paragraph
  }>                      // 5–8 content slides
  closingSlide: {
    callToAction: string  // "Save this for later" / "Share if this resonated"
    authorLine: string    // "@handle — topic pillar"
  }
  caption: string         // LinkedIn post caption that accompanies the PDF upload
  hashtags: string[]      // 3–5 hashtags for the caption
}
```

#### Carousel skill rules

- Cover slide: hook must stop the scroll — use the most provocative insight from the post
- Each slide: one idea only — no cramming
- Font-friendly: no special characters, emojis, or markdown
- Closing slide: always include a save/share CTA + author attribution
- Caption: short teaser (first 2–3 sentences of the LinkedIn post) + "Full breakdown in the carousel 👇"
- Aim for 6–7 slides total (cover + 4–5 content + closing)

#### UI additions

In the repurpose page, add a **"LinkedIn Carousel"** toggle in the source panel:
- Generates carousel content via the new skill (separate from the 5-platform text skills)
- Shows a **Carousel Preview** component: vertically stacked slide cards with cover → content slides → closing
- Each slide is editable inline
- **Export options**:
  - "Copy as JSON" — for paste into Canva / design tool via API
  - "Copy slide texts" — plain text block per slide for manual design
  - Future: direct Canva API integration

This adds LinkedIn as an additional output target (not just a source), closing the loop.

---

### Image Brand Kit

**Goal**: Define visual brand constraints (color palette, style, mood board) that are fed consistently into every image generation prompt — ensuring visual coherence across all platforms.

#### Settings additions — "Image Brand Kit" section in Brand Voice tab

Form fields:
- **Primary brand color**: hex picker
- **Secondary brand color**: hex picker
- **Visual style**: pill selection — Minimal / Bold / Warm / Monochrome / Vibrant / Dark
- **Photography style**: pill selection — Photorealistic / Illustrated / Abstract / Data-viz / Flat
- **Mood keywords**: tag input — "calm", "energetic", "professional", "playful" (max 5)
- **Avoid in images**: tag input — "stock photo clichés", "handshakes", "lightbulbs"

Saved to `config/brand-voice.json` under a new `imageBrandKit` field:
```typescript
export interface BrandVoiceProfile {
  // ... existing fields ...
  imageBrandKit: {
    primaryColor: string      // hex e.g. "#7C3AED"
    secondaryColor: string    // hex
    visualStyle: string       // "minimal" | "bold" | "warm" | "monochrome" | "vibrant" | "dark"
    photographyStyle: string  // "photorealistic" | "illustrated" | "abstract" | "flat"
    moodKeywords: string[]
    avoidInImages: string[]
  }
}
```

#### Image skill update

All image skill files: inject `imageBrandKit` into the prompt template.

Updated prompt template suffix (added to every image skill's prompt construction):
```
BRAND VISUAL IDENTITY:
Primary color: {imageBrandKit.primaryColor} — use as accent or dominant tone
Style: {imageBrandKit.visualStyle} — {imageBrandKit.photographyStyle}
Mood: {imageBrandKit.moodKeywords}
Avoid: {imageBrandKit.avoidInImages}
All images for this brand must feel visually consistent with each other.
```

Updated `negativePrompt` suffix:
```
{imageBrandKit.avoidInImages joined by ", "}, inconsistent style, clashing colors
```

This ensures every fal.ai generation reflects the user's visual identity, not just the post topic.

---

## Final notes for Claude Code

- **MANDATORY AFTER EVERY FEATURE CHANGE**: (1) Write a CHANGELOG.md entry (date, type, files changed, summary, docs affected). (2) Call `POST /api/docs/sync` with the entry, changed files list, and change type. (3) Verify all affected docs returned `"updated"` — retry any that returned `"failed"`. (4) If the sync route doesn't exist yet, write the CHANGELOG entry manually and the route will catch up when built. A task is NOT complete until this step is done.
- Use `async/await` throughout. No `.then()` chains.
- All API routes must handle errors and return appropriate HTTP status codes (400 for bad input, 500 for server errors, with `{ error: string }` body).
- Never expose API keys to the client. All Anthropic calls (chat, hashtags, image prompts) go through Next.js API routes. The app does NOT need a fal.ai key or Google service account credentials — both are handled exclusively by n8n.
- Do NOT install `googleapis` — it is not needed.
- Install `gray-matter` (`npm install gray-matter`) for reading/writing frontmatter in content `.md` files.
- Install `minimatch` (`npm install minimatch`) for glob pattern matching in the doc impact map.
- Platform skill files in `skills/platforms/` must exist before the repurpose skill can run. Generate all 10 files at project init. The auto-documentation system will keep them updated as learnings accumulate. The only data client is `lib/n8n-sheet.ts` which uses plain HTTP via Axios.
- The `config/` directory should be gitignored since it contains the user's personal brand voice data.
- Add `config/brand-voice.json` and `config/hashtag-bank.json` to `.gitignore`.
- Do NOT gitignore the `memory/` or `skills/` directories — these are the app's intelligence layer and should be committed. The `memory/daily/` folder may be gitignored if the user prefers to keep daily logs local-only.
- SOUL.md, Heartbeat.md, skills/repurpose.md, and skills/cron.md should be committed as they are part of the app's core identity. memory/learnings.md and memory/USER.md are personal data — give the user the option to gitignore them.
- Use Zod schemas to validate all API request bodies AND all incoming callback payloads from n8n.
- All user-facing strings should be consistent and professional. No placeholder text like "TODO" or "coming soon" in the final UI.
- The app is single-user, no auth needed.
- Add a `POST /api/test-webhooks` dev-only route that fires test payloads to all four n8n webhook URLs (`sheet`, `repurpose`, `images`, `publish`) and reports which responded with 2xx — the Sheet webhook test should send a `GET_ALL_POSTS` action with a limit of 1 row to verify the full read path works.
