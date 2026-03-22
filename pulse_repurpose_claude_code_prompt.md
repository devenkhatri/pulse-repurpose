# Claude Code Prompt — Pulse Repurpose (Full Build Spec)

> This is the complete, authoritative spec for rebuilding **Pulse Repurpose** from scratch.
> Every feature, route, component, type, config file, memory file, and architectural decision is documented here.
> Follow this spec exactly — no guessing, no adding things not listed, no simplifying things that are specified.

---

## 1. Project Identity

**Name:** Pulse Repurpose
**Purpose:** A personal content operating system (AOS) for a single creator. It takes LinkedIn posts and repurposes them into platform-native variants for Twitter/X, Threads, Instagram, Facebook, and Skool. It is not a scheduler. It is not a formatter. It is a learning creative partner — voice-first, not template-first.

**SOUL.md** (create this file at root):
```
# SOUL.md — Pulse Repurpose

## Identity
I am Pulse Repurpose — a personal content operating system built for a single creator.
My purpose is to amplify one voice across every platform without diluting it.
I am not a scheduler. I am not a formatter. I am a learning creative partner.

## Core values
- Voice fidelity: Every repurposed piece must sound like the creator, not like AI.
- Platform intelligence: Each platform has its own culture. I adapt, never copy-paste.
- Learning over rules: I improve from every approval, rejection, and edit. Rules are defaults, patterns are truth.
- Minimal friction: The creator should spend time creating, not managing. I automate what is repetitive, surface what needs judgment.
- Honest memory: I only remember what I have actually observed. I do not invent patterns.

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

## 2. Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 14 (App Router) |
| Language | TypeScript (strict — no `any`) |
| Styling | Tailwind CSS + shadcn/ui |
| State management | Zustand v5 |
| Forms | React Hook Form + Zod |
| AI (direct calls) | OpenRouter API (openai-compatible) — NOT the Anthropic SDK directly |
| Calendar | FullCalendar (React, daygrid + timegrid + interaction) |
| Drag & drop | @dnd-kit/core + @dnd-kit/sortable + @dnd-kit/utilities |
| HTTP client | Axios |
| Dates | date-fns |
| Notifications | Sonner |
| Icons | Lucide React |
| Fonts | Geist (next/font) |
| Markdown metadata | gray-matter |
| Pattern matching | minimatch |
| Backend services | n8n (workflow automation) |
| Data storage | Google Sheets (source of truth) + local file system (content/ directory) |
| Config storage | Local JSON files in config/ |

**package.json dependencies (exact versions):**
```json
{
  "next": "14.2.29",
  "react": "^18",
  "react-dom": "^18",
  "zustand": "^5.0.3",
  "react-hook-form": "^7.54.2",
  "@hookform/resolvers": "^3.10.0",
  "zod": "^3.24.2",
  "axios": "^1.7.9",
  "date-fns": "^4.1.0",
  "sonner": "^1.7.4",
  "lucide-react": "^0.474.0",
  "@anthropic-ai/sdk": "^0.36.3",
  "gray-matter": "^4.0.3",
  "minimatch": "^10.0.1",
  "@dnd-kit/core": "^6.3.1",
  "@dnd-kit/sortable": "^8.0.0",
  "@dnd-kit/utilities": "^3.2.2",
  "@fullcalendar/react": "^6.1.15",
  "@fullcalendar/daygrid": "^6.1.15",
  "@fullcalendar/timegrid": "^6.1.15",
  "@fullcalendar/interaction": "^6.1.15",
  "clsx": "^2.1.1",
  "tailwind-merge": "^2.6.0",
  "class-variance-authority": "^0.7.1",
  "@radix-ui/react-alert-dialog": "^1.1.6",
  "@radix-ui/react-dialog": "^1.1.6",
  "@radix-ui/react-label": "^2.1.2",
  "@radix-ui/react-popover": "^1.1.6",
  "@radix-ui/react-scroll-area": "^1.2.3",
  "@radix-ui/react-select": "^2.1.6",
  "@radix-ui/react-separator": "^1.1.2",
  "@radix-ui/react-slot": "^1.1.2",
  "@radix-ui/react-tabs": "^1.1.3",
  "geist": "^1.3.1"
}
```

**devDependencies:**
```json
{
  "typescript": "^5",
  "@types/node": "^20",
  "@types/react": "^18",
  "@types/react-dom": "^18",
  "tailwindcss": "^3.4.1",
  "postcss": "^8",
  "autoprefixer": "^10.0.1",
  "eslint": "^8",
  "eslint-config-next": "14.2.29",
  "tailwindcss-animate": "^1.0.7"
}
```

> **Note about AI SDK:** The `@anthropic-ai/sdk` package is installed but the app uses **OpenRouter's OpenAI-compatible API** (`https://openrouter.ai/api/v1/chat/completions`) for all direct LLM calls. Do not import `@anthropic-ai/sdk` — use `fetch` directly against OpenRouter.

---

## 3. Architecture Overview

```
Pulse App (Next.js)  ←→  n8n Workflows  ←→  Google Sheets (master data)
        ↓                      ↓
  OpenRouter API          ImageRouter API (image generation)
  (chat sidebar,          Twitter API v2, Meta Graph API,
   hashtag suggestions,   Skool placeholder
   skill execution)
```

### Data flow
1. Creator adds LinkedIn posts to Google Sheet manually (or via future automation)
2. App fetches posts from Sheet via n8n WF0 (Sheet Operations webhook)
3. Creator selects a post → triggers repurpose
4. App runs platform skills locally (OpenRouter direct) to build structured prompts
5. App fires n8n WF1 (Content Repurpose) with pre-built prompts — n8n calls OpenRouter for actual generation
6. n8n writes generated text + hashtags to Sheet, calls back to app
7. App polls Sheet every 3s, picks up generated content
8. Creator reviews, edits, approves variants
9. App fires n8n WF2 (Image Repurpose) for image generation
10. Creator schedules and publishes via n8n WF3 (Publish)
11. n8n publishes to platforms, writes published status back to Sheet

### Key architectural decisions
- **App never calls OpenRouter for repurposing directly** — it only fires webhooks to n8n with pre-built prompts. n8n does the actual LLM call.
- **App calls OpenRouter directly** for: chat sidebar, hashtag suggestions, image prompt generation, and skill execution (building the prompts).
- **Google Sheet is source of truth** for all post state. Local content/ files are for auditing/debugging.
- **No user authentication** — this is a single-creator personal tool.
- **File system** stores generated content as markdown in `content/{postId}/{platform}.md` with gray-matter frontmatter.

---

## 4. Environment Variables

Create `.env.local` with these variables:

```bash
# n8n webhook URLs — required for app to function
N8N_SHEET_WEBHOOK_URL=https://n8n.yourdomain.com/webhook/pulse-sheet-ops
N8N_CONTENT_REPURPOSE_WEBHOOK_URL=https://n8n.yourdomain.com/webhook/pulse-content-repurpose
N8N_IMAGE_REPURPOSE_WEBHOOK_URL=https://n8n.yourdomain.com/webhook/pulse-image-repurpose
N8N_PUBLISH_WEBHOOK_URL=https://n8n.yourdomain.com/webhook/pulse-publish

# Optional analytics webhook
N8N_ANALYTICS_WEBHOOK_URL=https://n8n.yourdomain.com/webhook/pulse-analytics

# OpenRouter — required for skill execution, chat sidebar, hashtag suggestions
OPENROUTER_API_KEY=sk-or-v1-...
OPENROUTER_MODEL=openrouter/auto   # or e.g. "anthropic/claude-3-5-sonnet"

# App public URL — used for n8n callbacks
NEXT_PUBLIC_APP_URL=http://localhost:3000

# Cron protection
CRON_SECRET=your-secret-here

# Optional cron schedule (default: 7am daily)
CRON_SCHEDULE=0 7 * * *
```

Create `lib/env.ts` that validates required env vars and throws clear errors if missing. Warn (not throw) if `OPENROUTER_API_KEY` is missing so non-AI features still work.

---

## 5. TypeScript Types (types/index.ts)

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
  contentPrompt: string | null      // JSON string of { systemPrompt, userPrompt } from content skill
  imagePrompt: string | null        // fal.ai/ImageRouter prompt string from image skill
  imageUrl: string | null
  hashtags: string[]
  status: PostStatus
  generatedAt: string | null
  scheduledAt: string | null
  publishedAt: string | null
  approvedAt: string | null
  isEdited: boolean
  error: string | null
  // Analytics fields — written by n8n after publishing
  platformPostId: string | null     // Native post ID on the platform
  impressions: number | null
  likes: number | null
  comments: number | null
  shares: number | null
  engagementRate: number | null     // (likes+comments+shares) / impressions * 100
  fetchedAt: string | null          // When analytics were last fetched
  // First comment fields
  firstComment: string | null       // Comment to post ~30s after publish
  firstCommentStatus: string | null // 'pending' | 'published' | 'failed' | null
}

export interface ImageBrandKit {
  primaryColor: string              // Hex e.g. "#7C3AED"
  secondaryColor: string            // Hex e.g. "#A78BFA"
  visualStyle: string[]             // e.g. ["minimalist", "bold", "editorial"]
  photographyStyle: string[]        // e.g. ["product", "lifestyle", "abstract"]
  moodKeywords: string[]            // e.g. ["confident", "modern", "clean"]
  avoidInImages: string[]           // e.g. ["people", "text overlays", "stock handshakes"]
}

export interface BrandVoiceProfile {
  toneDescriptors: string[]         // e.g. ["direct", "practical", "no fluff"]
  writingStyle: string              // Free text paragraph
  topicPillars: string[]            // e.g. ["solopreneurship", "AI tools", "productivity"]
  avoidList: string[]               // Words/phrases/patterns to never use
  examplePosts: string[]            // 3–5 raw LinkedIn post texts the creator loves
  imageBrandKit: ImageBrandKit      // Visual identity for AI image generation
  lastUpdated: string               // ISO date string
}

export interface HashtagBankEntry {
  id: string
  hashtag: string                   // Without # prefix
  platforms: Platform[]
  topicPillar: string | null
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
  imagePrompt: string | null
  hashtags: string[]
  suggestedHashtags: string[]       // From AI, not yet added
  isApproved: boolean
  isEdited: boolean                 // True if user manually edited AI output
}

export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
  timestamp: string
}

export interface ContentPromptOutput {
  systemPrompt: string
  userPrompt: string
  hookVariants: string[]            // 2–3 alternative opening lines (≤60 chars each)
  context: {
    platformLabel: string
    maxChars: number
    hashtagCount: string            // e.g. "1-3 hashtags"
    threadEnabled: boolean
    learningsApplied: string[]
  }
}

export interface CarouselSlide {
  headline: string
  body: string
}

export interface CarouselPromptOutput {
  coverSlide: { headline: string; subheadline: string }
  slides: CarouselSlide[]
  closingSlide: { headline: string; cta: string }
  caption: string
  hashtags: string[]
}

export interface ImagePromptOutput {
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
}

// Webhook payloads
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
}

export interface ImageRepurposeWebhookPayload {
  postId: string
  imagePayloads: Partial<Record<Platform, ImagePromptOutput>>
  callbackUrl: string
}

export interface PublishWebhookPayload {
  platform: Platform
  text: string
  imageUrl: string | null
  hashtags: string[]
  scheduledAt: string | null
  sheetRowId: string
  postId: string
  callbackUrl: string
  firstComment: string | null
}

export interface N8nCallbackPayload {
  postId: string
  status: 'done' | 'failed'
  error?: string
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

export type SheetAction =
  | 'GET_ALL_POSTS'
  | 'GET_POST_BY_ID'
  | 'UPDATE_PLATFORM_VARIANT'
  | 'UPDATE_MULTIPLE_PLATFORMS'
  | 'WRITE_CONTENT_PROMPTS'
  | 'WRITE_IMAGE_PROMPTS'
  | 'UPDATE_STATUS'
  | 'UPDATE_ANALYTICS'
  | 'UPDATE_FIRST_COMMENT'

export interface SheetWebhookRequest<A extends SheetAction = SheetAction> {
  action: A
  payload: SheetActionPayload[A]
}

export interface SheetActionPayload {
  GET_ALL_POSTS: {
    statusFilter?: PostStatus
    platformFilter?: Platform
    fromDate?: string
    toDate?: string
  }
  GET_POST_BY_ID: { postId: string }
  UPDATE_PLATFORM_VARIANT: {
    postId: string
    platform: Platform
    variant: Partial<PlatformVariant>
  }
  UPDATE_MULTIPLE_PLATFORMS: {
    postId: string
    variants: Partial<Record<Platform, Partial<PlatformVariant>>>
  }
  WRITE_CONTENT_PROMPTS: {
    postId: string
    prompts: Partial<Record<Platform, string>>
  }
  WRITE_IMAGE_PROMPTS: {
    postId: string
    prompts: Partial<Record<Platform, string>>
  }
  UPDATE_STATUS: {
    postId: string
    platform: Platform
    status: PostStatus
  }
  UPDATE_ANALYTICS: {
    postId: string
    platform: Platform
    metrics: {
      impressions: number
      likes: number
      comments: number
      shares: number
      engagementRate: number
      fetchedAt: string
    }
  }
  UPDATE_FIRST_COMMENT: {
    postId: string
    platform: Platform
    firstComment: string | null
    firstCommentStatus?: string | null
  }
}

export interface EvergreenConfig {
  enabled: boolean
  engagementThreshold: number       // Min engagement rate % to qualify (e.g. 3 = 3%)
  recycleIntervalDays: number       // Days since publishedAt before eligible to recycle
  platforms: Platform[]             // Which platforms to reset to approved on recycle
}
```

---

## 6. Platform Rules (lib/platform-rules.ts)

```typescript
import type { Platform } from "@/types"

export interface PlatformRule {
  label: string
  color: string
  maxChars: number
  threadEnabled: boolean
  maxThreadTweets: number | null
  imageAspectRatio: string
  imageWidth: number
  imageHeight: number
  hashtagCount: { min: number; max: number }
  tone: string
  formatRules: string
  avoidPatterns: string[]
}

export const PLATFORM_RULES: Record<Platform, PlatformRule> = {
  twitter: {
    label: "Twitter / X",
    color: "#000000",
    maxChars: 280,
    threadEnabled: true,
    maxThreadTweets: 10,
    imageAspectRatio: "16:9",
    imageWidth: 1200,
    imageHeight: 675,
    hashtagCount: { min: 1, max: 3 },
    tone: "punchy, hook-first, no filler words, each tweet self-contained",
    formatRules: "Start with a bold hook. Use short punchy sentences. If thread, number tweets 1/ 2/ etc. No corporate language.",
    avoidPatterns: ["Let me know your thoughts", "Comment below", "long sentences over 20 words"],
  },
  threads: {
    label: "Threads",
    color: "#000000",
    maxChars: 500,
    threadEnabled: false,
    maxThreadTweets: null,
    imageAspectRatio: "1:1",
    imageWidth: 1080,
    imageHeight: 1080,
    hashtagCount: { min: 0, max: 5 },
    tone: "conversational, casual, like texting a smart friend",
    formatRules: "Write as if talking to someone directly. Short paragraphs. Casual contractions ok. Can end with a soft question.",
    avoidPatterns: ["hashtag spam", "overly formal language"],
  },
  instagram: {
    label: "Instagram",
    color: "#E1306C",
    maxChars: 2200,
    threadEnabled: false,
    maxThreadTweets: null,
    imageAspectRatio: "1:1",
    imageWidth: 1080,
    imageHeight: 1080,
    hashtagCount: { min: 5, max: 15 },
    tone: "story-driven, personal, visual-first mindset",
    formatRules: "Lead with a strong first line (visible before \"more\"). Tell a mini story. Put hashtags at the very end, separated by line breaks. Use line breaks generously.",
    avoidPatterns: ["link in bio (no links work)", "excessive emojis"],
  },
  facebook: {
    label: "Facebook",
    color: "#1877F2",
    maxChars: 63206,
    threadEnabled: false,
    maxThreadTweets: null,
    imageAspectRatio: "16:9",
    imageWidth: 1200,
    imageHeight: 630,
    hashtagCount: { min: 0, max: 3 },
    tone: "warm, community-oriented, slightly longer form ok",
    formatRules: "Can be longer than other platforms. End with a direct question to drive comments. Paragraphs over bullet points. Personal tone.",
    avoidPatterns: ["aggressive CTAs", "spammy hashtags"],
  },
  skool: {
    label: "Skool Community",
    color: "#00A693",
    maxChars: 10000,
    threadEnabled: false,
    maxThreadTweets: null,
    imageAspectRatio: "16:9",
    imageWidth: 1200,
    imageHeight: 675,
    hashtagCount: { min: 0, max: 0 },
    tone: "community discussion starter, teaching mindset, inviting participation",
    formatRules: "Reframe as a discussion prompt or lesson for the community. Start with \"I want to share...\" or a direct insight. End with a question that invites replies. No hashtags.",
    avoidPatterns: ["sales language", "hashtags", "external links without context"],
  },
  linkedin: {
    label: "LinkedIn",
    color: "#0A66C2",
    maxChars: 3000,
    threadEnabled: false,
    maxThreadTweets: null,
    imageAspectRatio: "1.91:1",
    imageWidth: 1200,
    imageHeight: 627,
    hashtagCount: { min: 0, max: 5 },
    tone: "professional but personal, insight-driven",
    formatRules: "Lead with the key insight. Use short paragraphs. End with a question or call-to-action.",
    avoidPatterns: ["corporate jargon", "humble bragging"],
  },
}
```

---

## 7. Google Sheet Schema (94 columns)

Row 1 must contain these exact headers in this exact order:

```
post_id, linkedin_text, linkedin_image_url, posted_at,
twitter_text, twitter_content_prompt, twitter_image_prompt, twitter_image_url, twitter_hashtags, twitter_status, twitter_generated_at, twitter_scheduled_at, twitter_published_at,
threads_text, threads_content_prompt, threads_image_prompt, threads_image_url, threads_hashtags, threads_status, threads_generated_at, threads_scheduled_at, threads_published_at,
instagram_text, instagram_content_prompt, instagram_image_prompt, instagram_image_url, instagram_hashtags, instagram_status, instagram_generated_at, instagram_scheduled_at, instagram_published_at,
facebook_text, facebook_content_prompt, facebook_image_prompt, facebook_image_url, facebook_hashtags, facebook_status, facebook_generated_at, facebook_scheduled_at, facebook_published_at,
skool_text, skool_content_prompt, skool_image_prompt, skool_image_url, skool_hashtags, skool_status, skool_generated_at, skool_scheduled_at, skool_published_at,
twitter_approved_at, twitter_is_edited,
threads_approved_at, threads_is_edited,
instagram_approved_at, instagram_is_edited,
facebook_approved_at, facebook_is_edited,
skool_approved_at, skool_is_edited,
twitter_platform_post_id, twitter_impressions, twitter_likes, twitter_comments, twitter_shares, twitter_engagement_rate, twitter_fetched_at,
threads_platform_post_id, threads_impressions, threads_likes, threads_comments, threads_shares, threads_engagement_rate, threads_fetched_at,
instagram_platform_post_id, instagram_impressions, instagram_likes, instagram_comments, instagram_shares, instagram_engagement_rate, instagram_fetched_at,
facebook_platform_post_id, facebook_impressions, facebook_likes, facebook_comments, facebook_shares, facebook_engagement_rate, facebook_fetched_at,
skool_platform_post_id, skool_impressions, skool_likes, skool_comments, skool_shares, skool_engagement_rate, skool_fetched_at,
twitter_first_comment, twitter_first_comment_status,
threads_first_comment, threads_first_comment_status,
instagram_first_comment, instagram_first_comment_status,
facebook_first_comment, facebook_first_comment_status,
skool_first_comment, skool_first_comment_status
```

### Column naming convention
- App uses **camelCase** internally; Sheet uses **snake_case**
- `lib/n8n-sheet.ts` handles all conversion on read (snake→camel) and write (camel→snake)
- `{platform}_hashtags` column stores hashtags as a comma-separated string
- `{platform}_status` column stores one of: `pending | approved | scheduled | published | failed`

---

## 8. Project File Structure

```
pulse-repurpose/
├── app/
│   ├── layout.tsx                        # Root layout, sidebar nav, Sonner Toaster
│   ├── page.tsx                          # Redirect to /dashboard
│   ├── dashboard/
│   │   └── page.tsx
│   ├── repurpose/
│   │   └── page.tsx
│   ├── calendar/
│   │   └── page.tsx
│   ├── analytics/
│   │   └── page.tsx
│   ├── settings/
│   │   └── page.tsx
│   └── api/
│       ├── posts/
│       │   ├── route.ts                  # GET all posts
│       │   └── [id]/
│       │       └── route.ts              # GET/PATCH single post
│       ├── trigger/
│       │   ├── repurpose/
│       │   │   └── route.ts              # POST — run skills + fire n8n WF1
│       │   ├── repurpose/bulk/
│       │   │   └── route.ts              # POST — bulk repurpose multiple posts
│       │   └── images/
│       │       └── route.ts              # POST — fire n8n WF2
│       ├── callback/
│       │   ├── repurpose/
│       │   │   └── route.ts              # POST — n8n calls back when WF1 done
│       │   ├── images/
│       │   │   └── route.ts              # POST — n8n calls back when WF2 done
│       │   ├── publish/
│       │   │   └── route.ts              # POST — n8n calls back when WF3 done
│       │   └── analytics/
│       │       └── route.ts              # POST — n8n writes analytics back
│       ├── chat/
│       │   └── route.ts                  # POST — AI chat sidebar (OpenRouter direct)
│       ├── hashtags/
│       │   └── route.ts                  # POST — hashtag suggestions
│       ├── publish/
│       │   └── route.ts                  # POST — fire n8n WF3
│       ├── brand-voice/
│       │   └── route.ts                  # GET/PUT brand voice config
│       ├── hashtag-bank/
│       │   ├── route.ts                  # GET/POST hashtag bank
│       │   └── [id]/
│       │       └── route.ts              # DELETE single hashtag
│       ├── evergreen/
│       │   └── route.ts                  # GET/POST evergreen config
│       ├── memory/
│       │   ├── route.ts                  # GET learnings + user profile
│       │   └── update/
│       │       └── route.ts              # POST — update memory from cron
│       ├── heartbeat/
│       │   └── route.ts                  # GET system health
│       ├── cron/
│       │   └── route.ts                  # POST — 8 cron operations (requires CRON_SECRET)
│       ├── skills/
│       │   ├── repurpose/
│       │   │   └── route.ts              # POST — run content skill for one platform
│       │   ├── carousel/
│       │   │   └── route.ts              # POST — LinkedIn carousel skill
│       │   └── platform-prompt/
│       │       └── route.ts              # POST — build platform prompt payload
│       ├── content/
│       │   ├── route.ts                  # GET — list all content folders
│       │   ├── [postId]/
│       │   │   └── route.ts              # GET — all platform files for a post
│       │   └── [postId]/[platform]/
│       │       └── route.ts              # GET — single platform content file
│       ├── env-check/
│       │   └── route.ts                  # GET — check env vars status
│       ├── test-webhooks/
│       │   └── route.ts                  # POST — test all 4 n8n webhook URLs
│       └── docs/
│           ├── status/
│           │   └── route.ts              # GET — check stale docs
│           └── sync/
│               └── route.ts             # POST — regenerate stale docs
├── components/
│   ├── layout/
│   │   ├── Sidebar.tsx
│   │   └── TopBar.tsx
│   ├── dashboard/
│   │   ├── PostsTable.tsx                # Sortable, filterable table
│   │   ├── PostRow.tsx
│   │   ├── StatusBadge.tsx
│   │   ├── PlatformStatusGrid.tsx
│   │   ├── PostSlideOver.tsx             # Full post details drawer
│   │   └── SystemPanel.tsx              # Workflow health + cron status
│   ├── repurpose/
│   │   ├── SourcePostPanel.tsx
│   │   ├── PlatformCard.tsx             # Text editor, hashtags, image preview
│   │   ├── GenerationStatusPanel.tsx
│   │   ├── AIChatSidebar.tsx
│   │   ├── CarouselPreview.tsx          # LinkedIn carousel slide preview
│   │   └── KeyboardShortcutsDialog.tsx
│   ├── settings/
│   │   ├── BrandVoiceForm.tsx
│   │   ├── ExamplePostsInput.tsx
│   │   ├── AvoidListInput.tsx
│   │   ├── TopicPillarsInput.tsx
│   │   ├── ImageBrandKitForm.tsx        # Visual identity config
│   │   ├── HashtagBankManager.tsx       # Add, search, filter, bulk import
│   │   └── EvergreenForm.tsx
│   ├── calendar/
│   │   ├── CalendarView.tsx
│   │   └── GapWarningBadge.tsx
│   ├── analytics/
│   │   ├── PlatformSummaryCard.tsx
│   │   ├── TopPostsChart.tsx
│   │   └── EngagementMetrics.tsx
│   └── ui/
│       ├── LoadingSpinner.tsx
│       ├── ConfirmDialog.tsx
│       ├── PlatformIcon.tsx
│       └── [shadcn components: button, input, textarea, badge, card, label, separator, tabs, select, dialog, alert-dialog, popover, scroll-area]
├── lib/
│   ├── env.ts                           # Env var validation
│   ├── platform-rules.ts                # PLATFORM_RULES constant
│   ├── anthropic.ts                     # OpenRouter calls (chat, hashtags, image prompts)
│   ├── platform-skills.ts               # Skill file reading + execution
│   ├── brand-voice.ts                   # Brand voice profile helpers
│   ├── n8n.ts                           # Webhook firing helpers
│   ├── n8n-sheet.ts                     # Sheet CRUD via WF0 webhook
│   ├── content-store.ts                 # File system content storage
│   ├── docs-sync.ts                     # Memory/learning file updates
│   └── utils.ts                         # cn(), format helpers
├── stores/
│   ├── postsStore.ts                    # Posts list state
│   ├── repurposeStore.ts                # Active repurpose session state
│   └── settingsStore.ts                 # Brand voice + hashtag bank state
├── types/
│   └── index.ts                         # All TypeScript types
├── config/
│   ├── brand-voice.json                 # Brand voice profile (auto-created if missing)
│   ├── hashtag-bank.json                # Hashtag collection
│   ├── evergreen.json                   # Evergreen recycling config
│   └── recycled-posts.json              # Track recycled post IDs
├── skills/
│   ├── repurpose.md                     # Master repurpose skill runbook
│   ├── cron.md                          # Cron operations documentation
│   └── platforms/
│       ├── twitter-content.md
│       ├── threads-content.md
│       ├── instagram-content.md
│       ├── facebook-content.md
│       ├── skool-content.md
│       ├── linkedin-carousel-content.md  # Special carousel skill
│       ├── twitter-image.md
│       ├── threads-image.md
│       ├── instagram-image.md
│       ├── facebook-image.md
│       └── skool-image.md
├── memory/
│   ├── USER.md                          # Creator profile (voice fingerprint, approval patterns)
│   ├── MEMORY.md                        # Rolling 7-day working memory
│   ├── learnings.md                     # Accumulated intelligence (append-only)
│   └── daily/
│       └── [YYYY-MM-DD].md             # Daily cron logs
├── content/
│   └── [postId]/
│       ├── twitter.md
│       ├── threads.md
│       ├── instagram.md
│       ├── facebook.md
│       └── skool.md
├── SOUL.md                              # System identity and principles
├── Heartbeat.md                         # System status (updated by cron)
├── .env.local
└── package.json
```

---

## 9. Zustand Stores

### postsStore (stores/postsStore.ts)
```typescript
interface PostsState {
  posts: LinkedInPost[]
  loading: boolean
  error: string | null
  fetchPosts: (filters?: { status?: PostStatus; platform?: Platform; fromDate?: string; toDate?: string }) => Promise<void>
  updateVariantStatus: (postId: string, platform: Platform, status: PostStatus) => void  // optimistic
}
```

### repurposeStore (stores/repurposeStore.ts)
```typescript
interface RepurposeState {
  activePost: LinkedInPost | null
  variants: Record<Platform, RepurposeVariantDraft>
  generationStatus: GenerationStatus
  imageGenerationStatus: GenerationStatus
  activePlatform: Platform | null
  chatHistories: Record<Platform, ChatMessage[]>
  dirtyPlatforms: Set<Platform>   // platforms user has manually edited — prevents overwrite during polling

  setActivePost: (post: LinkedInPost) => void
  initVariantsFromPost: (post: LinkedInPost) => void
  setGenerationStatus: (status: GenerationStatus) => void
  setImageGenerationStatus: (status: GenerationStatus) => void
  setActivePlatform: (platform: Platform) => void
  setVariantText: (platform: Platform, text: string) => void         // marks platform dirty
  setVariantTextFromAI: (platform: Platform, text: string) => void   // does NOT mark dirty
  setVariantApproved: (platform: Platform, approved: boolean) => void
  setVariantHashtags: (platform: Platform, hashtags: string[]) => void
  setVariantImageUrl: (platform: Platform, url: string) => void
  setVariantImagePrompt: (platform: Platform, prompt: string) => void
  setSuggestedHashtags: (platform: Platform, hashtags: string[]) => void
  addChatMessage: (platform: Platform, message: ChatMessage) => void
  clearDirtyPlatform: (platform: Platform) => void
}
```

**Key behavior:** `dirtyPlatforms` prevents polling from overwriting text the user is actively editing. When polling detects new generated text for a platform, only update if that platform is NOT in `dirtyPlatforms`.

### settingsStore (stores/settingsStore.ts)
```typescript
interface SettingsState {
  brandVoice: BrandVoiceProfile | null
  hashtagBank: HashtagBankEntry[]
  loadingBrandVoice: boolean
  loadingHashtagBank: boolean
  error: string | null
  fetchBrandVoice: () => Promise<void>
  fetchHashtagBank: () => Promise<void>
  setBrandVoice: (profile: BrandVoiceProfile) => void
  setHashtagBank: (entries: HashtagBankEntry[]) => void
}
```

---

## 10. API Routes (detailed)

### GET /api/posts
Calls n8n WF0 (GET_ALL_POSTS). Supports query params: `status`, `platform`, `fromDate`, `toDate`. Returns `LinkedInPost[]`.

### GET /api/posts/[id]
Calls n8n WF0 (GET_POST_BY_ID). Used for polling during generation.

### PATCH /api/posts/[id]
Updates a platform variant field in the Sheet via WF0 (UPDATE_PLATFORM_VARIANT). Also writes to local content file. Returns updated post.

### POST /api/trigger/repurpose
1. Read brand voice profile from config
2. Read learnings.md and USER.md
3. For each selected platform (500ms stagger to avoid rate limits), call `/api/skills/repurpose` to execute the platform skill via OpenRouter and get a structured `ContentPromptOutput`
4. Build `ContentRepurposeWebhookPayload` with all platform prompts
5. Write prompts to Sheet via WF0 (WRITE_CONTENT_PROMPTS)
6. Set all platform statuses to `generating_text` via WF0
7. POST to `N8N_CONTENT_REPURPOSE_WEBHOOK_URL`
8. Return 200 immediately — caller polls

Body: `{ postId: string; platforms: Platform[] }`

### POST /api/trigger/repurpose/bulk
Same as above but accepts multiple postIds. Processes them sequentially.
Body: `{ postIds: string[]; platforms: Platform[] }`

### POST /api/trigger/images
1. Read brand voice profile
2. Call `generateImagePrompts()` from `lib/anthropic.ts` (single OpenRouter call, all platforms at once)
3. Build platform-specific `ImagePromptOutput` objects using PLATFORM_RULES for dimensions
4. Write image prompts to Sheet via WF0 (WRITE_IMAGE_PROMPTS)
5. POST to `N8N_IMAGE_REPURPOSE_WEBHOOK_URL`

Body: `{ postId: string; platforms: Platform[] }`

### POST /api/callback/repurpose
Called by n8n WF1 when text generation is done. Body: `N8nCallbackPayload`. Simply returns 200 — the UI polls `/api/posts/[id]` to pick up changes.

### POST /api/callback/images
Called by n8n WF2 when image generation is done. Body: `N8nCallbackPayload`. Returns 200.

### POST /api/callback/publish
Called by n8n WF3 after publishing. Updates post status in stores. Body: `{ postId: string; platform: Platform; status: PostStatus; platformPostId?: string; publishedAt?: string }`.

### POST /api/callback/analytics
Called by n8n analytics workflow. Writes engagement metrics to Sheet via WF0 (UPDATE_ANALYTICS). Body: `{ postId: string; platform: Platform; metrics: { impressions, likes, comments, shares, engagementRate, fetchedAt } }`.

### POST /api/chat
Interactive chat for content editing. Calls `chatWithAI()` from `lib/anthropic.ts`.
Body: `{ messages: ChatMessage[]; currentVariantText: string; platform: Platform; instruction: string }`
Returns: `{ updatedText: string; explanation: string }`

### POST /api/hashtags
Generate hashtag suggestions via OpenRouter. Calls `generateHashtagSuggestions()`.
Body: `{ postText: string; platform: Platform; existingHashtags: string[]; count: number }`
Returns: `string[]`

### POST /api/publish
Fire n8n WF3. Sets platform status to `scheduled` (if scheduledAt provided) or `approved` before returning.
Body: `PublishWebhookPayload`

### GET /api/brand-voice
Read `config/brand-voice.json`. Return default profile if file doesn't exist.

### PUT /api/brand-voice
Write to `config/brand-voice.json`. Set `lastUpdated` to now.

### GET /api/hashtag-bank
Read `config/hashtag-bank.json`.

### POST /api/hashtag-bank
Add entry to `config/hashtag-bank.json`. Assign UUID as `id`.

### DELETE /api/hashtag-bank/[id]
Remove entry by id from `config/hashtag-bank.json`.

### GET /api/evergreen
Return `{ config: EvergreenConfig; recycledPostIds: string[] }` from `config/evergreen.json` and `config/recycled-posts.json`.

### POST /api/evergreen
Update `config/evergreen.json`.

### GET /api/memory
Return `{ learnings: string; userProfile: string; workingMemory: string }` — raw contents of the three memory files.

### POST /api/memory/update
Called by cron. Accepts partial updates to memory files. Appends to learnings.md (never overwrites), updates USER.md sections, updates MEMORY.md (rolling window).

### GET /api/heartbeat
Return parsed Heartbeat.md as JSON + basic health checks (can reach n8n Sheet webhook, env vars present).

### POST /api/cron
Requires `Authorization: Bearer {CRON_SECRET}` header. Body: `{ operation: CronOperation }`.

**8 cron operations:**
```typescript
type CronOperation =
  | 'fetch_linkedin_posts'          // Sync new LinkedIn posts to Sheet
  | 'identify_repurpose_eligible'   // Find posts within 7 days for auto-repurposing
  | 'generate_pending'              // Auto-generate content for eligible posts
  | 'evaluate_evergreen'            // Find high-engagement posts for recycling
  | 'trigger_recycling'             // Reset qualified posts to approved for re-publish
  | 'fetch_analytics'               // Pull latest engagement metrics
  | 'update_memory'                 // Update learnings.md + USER.md + MEMORY.md
  | 'rebuild_heartbeat'             // Regenerate Heartbeat.md from current state
```

Each operation runs independently. The full daily cron runs all 8 sequentially. Log each operation result to `memory/daily/[date].md`.

### POST /api/skills/repurpose
Execute a platform content skill via OpenRouter.
Body: `{ platform: Platform; linkedinText: string; postId: string }`
1. Read skill file from `skills/platforms/{platform}-content.md`
2. Read brand voice, learnings.md, USER.md
3. Build prompt from skill template
4. Call OpenRouter
5. Parse and return `ContentPromptOutput`

### POST /api/skills/carousel
Execute the LinkedIn carousel skill.
Body: `{ linkedinText: string; postId: string }`
Returns `CarouselPromptOutput`.

### POST /api/skills/platform-prompt
Build a complete platform prompt payload without executing it. Used for testing/previewing prompts.

### GET /api/content
List all post folders in `content/` directory.

### GET /api/content/[postId]
Return all platform content files for a post as an object keyed by platform.

### GET /api/content/[postId]/[platform]
Return a single platform content file (raw markdown with frontmatter).

### GET /api/env-check
Return status of all env vars (present/missing, never return values).

### POST /api/test-webhooks
Ping all 4 n8n webhook URLs with a test payload and return their response status.

### GET /api/docs/status
Check which skill files and docs are stale (based on modification time vs last sync).

### POST /api/docs/sync
Trigger regeneration of stale documentation.

---

## 11. Content File Storage (lib/content-store.ts)

Each generated platform variant is also written to a markdown file:

`content/{postId}/{platform}.md`

```markdown
---
postId: abc123
platform: twitter
status: approved
generatedAt: 2025-01-01T00:00:00Z
approvedAt: 2025-01-02T00:00:00Z
publishedAt: null
scheduledAt: null
isEdited: false
imageUrl: null
hashtags: ["solopreneurship", "productivity"]
---

Full tweet text or thread here...
```

Files are written on generation (via callback) and updated on status changes. The Sheet remains source of truth — these files are for auditing and debugging.

---

## 12. LLM Integration (lib/anthropic.ts)

All direct LLM calls use OpenRouter's OpenAI-compatible endpoint:
`https://openrouter.ai/api/v1/chat/completions`

Headers required:
- `Authorization: Bearer {OPENROUTER_API_KEY}`
- `Content-Type: application/json`
- `HTTP-Referer: {NEXT_PUBLIC_APP_URL}`
- `X-Title: Pulse Repurpose`

Default model: `openrouter/auto` (overrideable via `OPENROUTER_MODEL` env var)

**Four exported functions:**

#### `executePrompt({ system, user, maxTokens?, model? }): Promise<string>`
Generic single-turn prompt helper. Used by skill routes.

#### `generateImagePrompts({ linkedinText, brandVoice, platforms }): Promise<Partial<Record<Platform, string>>>`
Single call that returns all platform image prompts as JSON. Used by `/api/trigger/images`.

#### `chatWithAI({ messages, currentVariantText, platform, brandVoice, instruction }): Promise<{ updatedText: string; explanation: string }>`
Powers the AI chat sidebar. Returns structured JSON with updated text + explanation of change.

#### `generateHashtagSuggestions({ postText, platform, brandVoice, existingHashtags, count }): Promise<string[]>`
Returns array of hashtag strings (no # prefix).

**JSON parsing pattern** (use everywhere):
```typescript
const jsonMatch =
  text.match(/```(?:json)?\s*([\s\S]*?)```/) ?? text.match(/(\{[\s\S]*\})/)
const jsonStr = jsonMatch ? (jsonMatch[1] ?? jsonMatch[0]) : text
```

Remove control characters before parsing: `jsonStr.replace(/[\x00-\x1F\x7F]/g, ' ')`

**Error handling:** Log full response on empty content. Never throw unhandled errors — return safe fallbacks.

---

## 13. n8n Sheet Client (lib/n8n-sheet.ts)

All Sheet operations go through n8n WF0 webhook. Never call Google Sheets API directly from the app.

```typescript
// Generic typed call
async function callSheet<A extends SheetAction>(
  request: SheetWebhookRequest<A>
): Promise<unknown>

// Exported helper functions
export async function getAllPosts(filters?: {...}): Promise<LinkedInPost[]>
export async function getPostById(postId: string): Promise<LinkedInPost | null>
export async function updatePlatformVariant(postId: string, platform: Platform, variant: Partial<PlatformVariant>): Promise<void>
export async function updateMultiplePlatforms(postId: string, variants: Partial<Record<Platform, Partial<PlatformVariant>>>): Promise<void>
export async function writeContentPrompts(postId: string, prompts: Partial<Record<Platform, string>>): Promise<void>
export async function writeImagePrompts(postId: string, prompts: Partial<Record<Platform, string>>): Promise<void>
export async function updateStatus(postId: string, platform: Platform, status: PostStatus): Promise<void>
export async function updateAnalytics(postId: string, platform: Platform, metrics: {...}): Promise<void>
export async function updateFirstComment(postId: string, platform: Platform, firstComment: string | null, firstCommentStatus?: string | null): Promise<void>
```

**Conversion:** Sheet returns snake_case — convert to camelCase on read. App sends camelCase — convert to snake_case on write. Hashtags stored as comma-separated string in Sheet — parse to array on read, join on write.

---

## 14. n8n Webhook Firing (lib/n8n.ts)

```typescript
export async function fireContentRepurposeWebhook(payload: ContentRepurposeWebhookPayload): Promise<void>
export async function fireImageRepurposeWebhook(payload: ImageRepurposeWebhookPayload): Promise<void>
export async function firePublishWebhook(payload: PublishWebhookPayload): Promise<void>
```

Use `axios.post()` with a 30s timeout. Log errors but don't throw — let callers handle.

---

## 15. Skills System (lib/platform-skills.ts)

Skills are markdown files in `skills/platforms/`. They contain system prompt templates with `{placeholder}` syntax.

**Reading a skill:**
```typescript
export async function readSkillFile(platform: Platform, type: 'content' | 'image'): Promise<string>
```

**Executing a skill:**
```typescript
export async function executePlatformSkill(params: {
  platform: Platform
  linkedinText: string
  postId: string
  brandVoice: BrandVoiceProfile
  learnings: string
  userProfile: string
}): Promise<ContentPromptOutput>
```

Fills template placeholders with actual values, calls `executePrompt()`, parses JSON response as `ContentPromptOutput`.

**Staggered execution for bulk:** When running multiple platform skills in sequence, add a 500ms delay between each to avoid OpenRouter free-tier rate limits.

---

## 16. Memory System Files

### Heartbeat.md (root)
Updated by cron `rebuild_heartbeat` operation. Format:
```markdown
# Heartbeat — [timestamp]

## System status
- Last cron run: [timestamp]
- Sheet webhook: [reachable/unreachable]
- Content repurpose webhook: [reachable/unreachable]
- Image repurpose webhook: [reachable/unreachable]
- Publish webhook: [reachable/unreachable]

## Content pipeline status
- Total posts in Sheet: [n]
- Pending repurpose: [n]
- Approved and scheduled: [n]
- Published this week: [n]

## Open flags
[Any anomalies or errors from last cron run]
```

### memory/USER.md
Creator profile — updated by learning system when approval patterns are observed. Never auto-reset.
```markdown
# USER.md — Creator Profile

## Identity
- Name: [filled from settings or first use]
- Primary platform: LinkedIn
- Content creation style: [observed]
- Posting frequency: [observed]

## Voice fingerprint
- Sentence length: [observed]
- Opening style: [observed]
- Closing style: [observed]
- Recurring phrases: [observed]
- Emotional register: [observed]

## Platform behavior
- Platforms regularly approved: [observed]
- Platforms frequently edited: [observed]
- Platforms often skipped: [observed]

## Approval patterns
- Fast approvals: [observed]
- Frequently edited: [observed]
- Frequently rejected: [observed]

## Content preferences
- Best performing topics: [from analytics]
- Topics that underperform: [from analytics]
- Preferred hashtag style: [observed]
```

### memory/MEMORY.md
Rolling 7-day working memory. Entries older than 7 days are removed on each cron update.
```markdown
# Working Memory

[timestamp] Starting repurpose for [postId]
[timestamp] Repurpose complete for [postId]. Platforms: [list]. Awaiting approval.
[timestamp] [postId] twitter: approved without edits.
[timestamp] [postId] instagram: user shortened caption. Learning captured.
```

### memory/learnings.md
Append-only. Accumulated intelligence from all observations.
```markdown
# Learnings

## Approval patterns

### Twitter
[date] [postId]: thread format with 4 tweets approved without edits. Hook started with a question.

### Instagram
[date] [postId]: user shortened from 8 lines to 5. Always trims middle paragraphs.

## Content performance
[date] AI tools topic posts consistently outperform productivity posts on Twitter (avg 3.2% vs 1.8% ER).

## Platform-specific tone adjustments
### Threads
[date] Posts that start with "Hot take:" get high engagement.

## Hashtag intelligence
[date] #solopreneurship outperforms #entrepreneur on Instagram (2x ER).
```

### memory/daily/[YYYY-MM-DD].md
Auto-generated by cron at end of each run.

---

## 17. Config Files

### config/brand-voice.json (default)
```json
{
  "toneDescriptors": [],
  "writingStyle": "",
  "topicPillars": [],
  "avoidList": [],
  "examplePosts": [],
  "imageBrandKit": {
    "primaryColor": "#7C3AED",
    "secondaryColor": "#A78BFA",
    "visualStyle": [],
    "photographyStyle": [],
    "moodKeywords": [],
    "avoidInImages": []
  },
  "lastUpdated": ""
}
```

### config/hashtag-bank.json (default)
`[]`

### config/evergreen.json (default)
```json
{
  "enabled": false,
  "engagementThreshold": 3,
  "recycleIntervalDays": 90,
  "platforms": ["twitter", "threads"]
}
```

### config/recycled-posts.json (default)
`[]`

---

## 18. Skills Files

### skills/repurpose.md
The master repurpose skill runbook — documents the 8-step process (pre-flight, build prompt, fire webhook, poll, fire images, capture learnings, approval monitoring, update Heartbeat). Also documents: memory injection priority order (`learnings.md > USER.md > brand-voice.json > platform-rules.ts`), success criteria (all 5 text variants written, 3/5 images generated), and error handling (timeout → log, LLM error → retry once with simplified prompt, image failure → log and continue).

### skills/platforms/twitter-content.md
Contains:
- Platform identity (280 chars, thread up to 10, 1-3 hashtags)
- Full system prompt template with `{brandVoice.*}` and `{learnings}` and `{userProfile.*}` placeholders
- User prompt template
- Output contract: JSON matching `ContentPromptOutput`
- `hookVariants`: 2-3 alternative first lines (≤60 chars each), scroll-stopping, for the hook picker UI
- Learnings injection rules (which sections of learnings.md to inject)
- Output validation rules (char limit per tweet, thread separation by `\n\n`)

### skills/platforms/threads-content.md
Same structure. 500 chars, no thread, 0-5 hashtags, casual tone.

### skills/platforms/instagram-content.md
Same structure. 2200 chars, 5-15 hashtags, story-driven, hook-first, hashtags at very end.

### skills/platforms/facebook-content.md
Same structure. Longer form ok, end with question, personal tone.

### skills/platforms/skool-content.md
Same structure. Discussion prompt format, no hashtags, community teaching tone.

### skills/platforms/linkedin-carousel-content.md
Special skill for carousel format. Returns `CarouselPromptOutput` with:
- `coverSlide: { headline, subheadline }`
- `slides: CarouselSlide[]` (each with `headline` + `body`)
- `closingSlide: { headline, cta }`
- `caption: string`
- `hashtags: string[]`

### skills/platforms/[platform]-image.md (5 files)
Each image skill returns `ImagePromptOutput`. Includes:
- Platform image specs (dimensions, aspect ratio)
- Brand kit integration instructions
- Rules: no text overlays, match brand tone and color palette
- `negativePrompt` instructions

### skills/cron.md
Documents all 8 cron operations with inputs, outputs, and memory update rules.

---

## 19. Pages

### /dashboard
**Stats bar** (top row):
- Total posts in Sheet
- Posts with all 5 platforms repurposed
- Posts published this week
- Posts pending approval
- Average engagement rate (across all published posts)
- Top performing platform (highest avg ER)

**SystemPanel** (collapsible):
- n8n webhook health status (green/red dot per webhook)
- Last cron run timestamp + status
- Open flags from Heartbeat.md

**PostsTable**:
- Columns: Date, LinkedIn Preview (first 80 chars), Platform Status (5 badges), Actions
- Platform status badges: colored dot per platform, click to see variant status
- Inline approve/reject buttons on pending variants
- Sort by: date (default: newest first), status, engagement
- Filter by: platform, status, date range
- Click any row → PostSlideOver

**PostSlideOver** (right drawer):
- Full LinkedIn post text + image
- Per-platform variants with full text, hashtags, image, status
- Approve/reject/schedule actions
- Link to Repurpose page for that post

### /repurpose
**SourcePostPanel** (left, 1/3 width):
- LinkedIn post selector (search + recent posts list)
- Display selected post: full text, image, posted date
- "Repurpose" button → triggers generation for all 5 platforms

**Platform Cards** (right, 2/3 width, 2×3 grid — 5 platforms + LinkedIn carousel):
- Platform icon + name + char count indicator
- Text editor (textarea, character count, warns at limit)
- Hook variants (chip row under textarea): 2-3 alternative first-line options, click to swap into text
- Hashtag pills (add/remove, AI suggest button)
- Image preview (thumbnail, "Generate Image" button)
- First comment field (expandable)
- Status badge + Approve button + Reject button
- Visual post preview toggle (shows how post will look)

**GenerationStatusPanel**:
- Shows progress per platform during generation
- "Generating text..." → "Generating images..." → "Done"
- Per-platform spinner/check/error indicators

**AIChatSidebar** (right panel, slides in when "Chat" button clicked on a platform card):
- Context: current variant text for the active platform
- Message history
- Input: type instruction (e.g. "make it shorter", "add more punch to the hook")
- AI returns updated text + one-line explanation
- "Apply" button applies to the platform card text

**CarouselPreview** (appears when LinkedIn Carousel card is active):
- Slide-by-slide preview with cover, content slides, closing slide
- Shows headline, subheadline, body per slide

**KeyboardShortcutsDialog**:
- `Cmd+R` = trigger repurpose
- `Cmd+A` = approve all
- `Cmd+G` = generate images
- `?` = show shortcuts dialog

### /calendar
**CalendarView** (FullCalendar, month view default, can switch to week/day):
- Events colored by platform
- Click event → mini popover with post preview + quick actions (view, publish, reschedule)
- Drag-drop to reschedule (updates scheduledAt in Sheet)
- Filter by platform (toggle buttons)

**GapWarningBadge**:
- Appears in header when a platform hasn't been posted to in >7 days
- Shows: platform icon + "X days since last post"
- If a topic pillar is also missing: "No [pillar] content in X days"
- Clickable → filters to that platform

### /analytics
**Platform Summaries** (top row, one card per platform):
- Total posts published
- Total impressions / likes / comments / shares
- Average engagement rate
- Trend arrow (vs last 30 days)

**Top Performing Posts** (table):
- Ranked by engagement rate
- Columns: date, platform, preview, impressions, ER

**Best Posting Times**:
- Heatmap grid: hour of day (x) × day of week (y)
- Color intensity = average engagement rate

**Overall Trends** (line chart):
- Weekly engagement rate over time, per platform

### /settings
Three tabs: Brand Voice | Hashtag Bank | Evergreen

**Brand Voice tab:**
- Tone descriptors (tag input: add/remove chips)
- Writing style (textarea)
- Topic pillars (tag input)
- Avoid list (tag input)
- Example posts (add/remove textarea fields, min 3 recommended)
- Image Brand Kit section:
  - Primary color (hex input + color swatch)
  - Secondary color (hex input + color swatch)
  - Visual styles (tag input: e.g. "minimalist", "bold")
  - Photography styles (tag input: e.g. "product", "lifestyle")
  - Mood keywords (tag input: e.g. "confident", "modern")
  - Avoid in images (tag input: e.g. "people", "text overlays")
- Save button

**Hashtag Bank tab:**
- Search input
- Filter by platform / topic pillar
- Table: hashtag, platforms (badges), pillar, usage count, last used, delete button
- Add hashtag form (hashtag, platforms checkboxes, pillar select)
- Bulk import (paste comma-separated or newline-separated list)
- Usage tracking: each time a hashtag is approved in a variant, increment usage count

**Evergreen tab:**
- Toggle: Enable evergreen recycling
- Engagement threshold (number input, %)
- Recycle interval (number input, days)
- Platforms to recycle (multi-select checkboxes)
- Current evergreen queue (posts that qualify, with their ER)
- Save button

---

## 20. Layout

### Sidebar (fixed 240px, left)
Navigation links:
- Dashboard (grid icon)
- Repurpose (refresh icon)
- Calendar (calendar icon)
- Analytics (bar chart icon)
- Settings (settings icon)

Brand name "Pulse" at top. Active link highlighted. Footer: system status dot (green = all webhooks OK, red = issue).

### TopBar
Page title (matches current route). Breadcrumbs where needed. Right side: system status if issue detected.

### Root layout
```typescript
// Geist font, dark mode class on html, Toaster (Sonner) at root
// Fixed sidebar + main content area with overflow scroll
```

---

## 21. n8n Workflows

Four workflows to build/import. Create JSON files at `n8n-workflows/`:
- `workflow-0-sheet-operations.json`
- `workflow-1-content-repurpose.json`
- `workflow-2-image-repurpose.json`
- `workflow-3-publish.json`

### WF0 — Sheet Operations
**Webhook path:** `pulse-sheet-ops`

Handles all Google Sheets CRUD via a single webhook. Routes `action` field:
- **Read path** (`GET_ALL_POSTS`, `GET_POST_BY_ID`): reads all rows via GSheets node, filters in JavaScript
- **Write path** (all `UPDATE_*` / `WRITE_*`): finds row by `post_id`, updates specific columns

Each action maps to specific column patterns (`{platform}_text`, `{platform}_status`, etc.).

### WF1 — Content Repurpose
**Webhook path:** `pulse-content-repurpose`

1. Receive `ContentRepurposeWebhookPayload` (pre-built per-platform prompt pairs)
2. Split into one item per platform using SplitInBatches
3. For each: call OpenRouter API with the system+user prompt pair
4. Extract generated text and hashtags from LLM response
5. Write to Google Sheet (`{platform}_text`, `{platform}_hashtags`, `{platform}_status = pending`, `{platform}_generated_at`)
6. When all platforms done: POST to `callbackUrl` with `{ postId, status: 'done' }`

**OpenRouter model:** `openrouter/auto` by default. Configure as Header Auth credential.

### WF2 — Image Repurpose
**Webhook path:** `pulse-image-repurpose`

1. Receive `ImageRepurposeWebhookPayload` (per-platform `ImagePromptOutput` objects)
2. Split by platform
3. For each: call ImageRouter API (OpenAI-compatible image endpoint)
   - Model: `gpt-image-1` (configurable)
   - Image size from `styleDirectives.width × styleDirectives.height`
4. Extract image URL from response
5. Write to Sheet (`{platform}_image_url`)
6. When all done: POST to `callbackUrl`

**ImageRouter credential:** Header Auth with `Authorization: Bearer YOUR_KEY`.

### WF3 — Publish
**Webhook path:** `pulse-publish`

Route by `platform`:

| Platform | API | Notes |
|---|---|---|
| Twitter/X | Twitter API v2 (OAuth 1.0a) | Upload image via `upload.twitter.com` first if imageUrl present |
| Threads | Meta Graph API | Two-step: create container → publish |
| Instagram | Meta Graph API | Two-step: create container → publish. Requires image for feed posts |
| Facebook | Meta Graph API | Text-only or photo post |
| Skool | Placeholder | No public API — placeholder node, update manually |

After publishing:
1. Write `{platform}_status = published`, `{platform}_published_at`, `{platform}_platform_post_id` to Sheet
2. If `firstComment` present: wait 30 seconds, post comment to same post, update `{platform}_first_comment_status`
3. POST to `callbackUrl`

**n8n Variables needed (Settings → Variables):**
- `THREADS_USER_ID`
- `INSTAGRAM_USER_ID`
- `FACEBOOK_PAGE_ID`
- `SKOOL_COMMUNITY_ID`

**Credentials needed:**
- `Google Sheets OAuth2` (all 4 workflows)
- `OpenRouter API Key` — Header Auth (`Authorization: Bearer KEY`) — WF1
- `ImageRouter API Key` — Header Auth (`Authorization: Bearer KEY`) — WF2
- `Twitter OAuth 1.0a` — WF3
- `Meta Access Token` — Header Auth — WF3
- `Skool Session Cookie` — Header Auth (`Cookie: session=VALUE`) — WF3

**Google Sheets configuration (all workflows):**
Replace in every GSheets node:
- `YOUR_SPREADSHEET_ID` → actual Sheet ID from URL
- `YOUR_GOOGLE_CREDENTIAL_ID` → n8n credential ID
- `Sheet1` → actual tab name

---

## 22. Component Implementation Details

### StatusBadge
Map statuses to colors:
- `pending` → gray
- `approved` → blue
- `scheduled` → purple
- `published` → green
- `failed` → red

### PlatformCard (key behaviors)
- Character count updates live; turns amber at 80% of limit, red at 100%
- Hook variants display as clickable chips below the textarea; clicking replaces the first line of the text
- Hashtag pills: click to remove; "Suggest" button calls `/api/hashtags` and shows inline suggestions to add
- Image preview: 100px thumbnail; "Generate Image" button fires `/api/trigger/images` for just this platform
- First comment field: expandable textarea (hidden by default, "Add first comment" toggle)
- Visual preview button: renders platform-appropriate mockup of how the post will look
- Approve button: calls PATCH /api/posts/[id] with status=approved, plays subtle success animation
- Reject button: calls PATCH with status=failed, clears generated content

### PostsTable (sorting behavior)
- Default sort: `postedAt` descending (newest first)
- Click column header to sort; click again to reverse
- Sort arrows visible on active column only

### AIChatSidebar (state persistence)
- Chat history persists in `repurposeStore.chatHistories` keyed by platform
- Switching platforms shows that platform's history
- "Clear" button clears current platform history

---

## 23. Error Handling Patterns

1. **OpenRouter errors:** Catch + return safe fallback (empty array, empty string). Log with `console.error`. Never crash route.
2. **n8n webhook failures:** Log error, return 500 with descriptive message. UI shows toast with "Workflow trigger failed, check n8n".
3. **Sheet not found / wrong postId:** Return 404 from API route.
4. **Config files missing:** Auto-create with defaults on first read.
5. **LLM JSON parse failures:** Use the robust regex pattern (code fences → JSON object → raw text). Remove control characters before parse.
6. **Image generation failure:** Log and continue — do not block text approval. Show image card as "Not generated".
7. **Cron operation failure:** Log to daily memory file. Update Heartbeat.md open flags. Continue remaining operations (don't abort full cron run).

---

## 24. Polling Logic

During content/image generation, the UI polls `/api/posts/[id]` every **3 seconds**.

```typescript
// In repurpose page
useEffect(() => {
  if (generationStatus !== 'generating_text' && generationStatus !== 'generating_images') return
  const interval = setInterval(async () => {
    const updated = await fetch(`/api/posts/${activePost.id}`)
    const post = await updated.json()
    // For each platform, if NOT dirty and new text is available, update store
    for (const platform of PLATFORMS) {
      if (!dirtyPlatforms.has(platform) && post.platforms[platform].text) {
        setVariantTextFromAI(platform, post.platforms[platform].text)
      }
    }
    // Check if all platforms have text — if so, set status to done
    if (allPlatformsHaveText(post)) {
      setGenerationStatus('done')
      clearInterval(interval)
    }
  }, 3000)
  return () => clearInterval(interval)
}, [generationStatus, activePost])
```

Timeout: after 5 minutes with no completion, set status to `failed` and show error toast.

---

## 25. Brand Voice System (lib/brand-voice.ts)

```typescript
// Read brand voice profile — returns default if config file missing
export async function getBrandVoice(): Promise<BrandVoiceProfile>

// Save brand voice profile
export async function saveBrandVoice(profile: BrandVoiceProfile): Promise<void>

// Build a system prompt string from the brand voice profile
// Used by chatWithAI and skill execution
export function buildBrandVoiceSystemPrompt(profile: BrandVoiceProfile): string
```

`buildBrandVoiceSystemPrompt` format:
```
You are writing as a personal brand. Here is the creator's voice profile:

TONE: {toneDescriptors.join(", ")}
WRITING STYLE: {writingStyle}
TOPIC PILLARS: {topicPillars.join(", ")}
NEVER USE: {avoidList.join(", ")}

EXAMPLE POSTS (these represent the ideal voice — study them carefully):
---
{examplePosts[0]}
---
{examplePosts[1]}
---
[...]
```

---

## 26. Utility Functions (lib/utils.ts)

```typescript
import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Convert snake_case to camelCase (for Sheet → app)
export function snakeToCamel(str: string): string

// Convert camelCase to snake_case (for app → Sheet)
export function camelToSnake(str: string): string

// Convert all keys of an object from snake_case to camelCase (recursive)
export function deepSnakeToCamel<T>(obj: unknown): T

// Format date for display
export function formatDate(iso: string): string  // "Jan 15, 2025"

// Truncate text with ellipsis
export function truncate(text: string, maxLength: number): string
```

---

## 27. Key Implementation Notes

1. **No Prisma, no PostgreSQL.** All data is in Google Sheets via n8n.
2. **No user auth.** Single-creator personal tool, no login/session needed.
3. **`@anthropic-ai/sdk` is installed but not used.** All LLM calls use `fetch` against OpenRouter.
4. **The app builds prompts; n8n runs them.** For repurposing, app runs skills locally to build the structured prompt payload, then hands it to n8n. n8n does the actual OpenRouter call that generates the final post content.
5. **500ms stagger between platform skill executions.** Prevents rate limiting on free-tier OpenRouter.
6. **`dirtyPlatforms` in repurposeStore.** Prevents polling from overwriting user edits. Critical for UX.
7. **Hashtag bank usage tracking.** When a user approves a variant, increment usage count for each hashtag in that variant.
8. **Config files auto-create.** All `config/*.json` files are created with defaults if they don't exist on first read.
9. **All memory files use append-only for learnings.** Never overwrite `learnings.md`. For `MEMORY.md`, prune entries older than 7 days on each update.
10. **Skills priority order.** In prompt construction: `learnings.md > USER.md > brand-voice.json > platform-rules.ts`. Observed truth beats configured defaults.
11. **Image Brand Kit feeds into image skills.** When building image prompts, inject `imageBrandKit.primaryColor`, `visualStyle`, `moodKeywords`, and `avoidInImages` into the image skill prompt.
12. **Carousel is a separate skill.** LinkedIn Carousel is treated as a 6th variant (alongside the 5 platform variants). It has its own card in the repurpose UI and its own skill file.
13. **First comment flow.** Users can set a `firstComment` per platform variant. n8n WF3 posts it 30 seconds after the main post. Status tracked as `pending → published | failed`.
14. **Gap warnings compute from Sheet data.** When loading calendar, compute days since last published post per platform. If >7 days, show GapWarningBadge. If a topic pillar is missing from recent posts, surface that too.
15. **Evergreen recycling.** When `enabled`, cron operation `evaluate_evergreen` finds posts with `engagementRate >= threshold` and `publishedAt >= recycleIntervalDays ago`. Marks them eligible. `trigger_recycling` resets their platform statuses to `approved` so they appear in the publishing queue. Write their IDs to `config/recycled-posts.json` to prevent double-recycling.
16. **Hook variants UI.** Each generated platform variant includes 2-3 alternative opening lines. Show them as clickable chips below the textarea in PlatformCard. Clicking a chip replaces just the first line of the existing text.
17. **Visual post preview.** Each PlatformCard has a "Preview" toggle that shows a rough platform-native mockup (black card for Twitter, gradient for Instagram, etc.) with the current text rendered inside it.

---

## 28. shadcn/ui Components to Install

Run: `npx shadcn@latest init` then install these components:
```
button input textarea badge card label separator tabs select dialog alert-dialog popover scroll-area
```

Use the `zinc` color palette and `default` style.

---

## 29. Tailwind Config

Standard Next.js 14 + shadcn setup. Add `tailwindcss-animate` plugin.

Content paths:
```javascript
content: [
  "./pages/**/*.{ts,tsx}",
  "./components/**/*.{ts,tsx}",
  "./app/**/*.{ts,tsx}",
  "./src/**/*.{ts,tsx}",
],
```

---

## 30. Initial State / Defaults

On first run with no data:
- Dashboard shows empty state: "No posts yet. Add posts to your Google Sheet to get started."
- Settings has empty brand voice with instructional placeholder text
- Hashtag bank is empty
- Evergreen is disabled
- All memory files contain templates with `[filled by system]` placeholders
- Heartbeat.md shows "System not yet initialized — run first cron to populate"

---

## 31. Complete Feature Checklist

Check off every feature when implementing:

**Core:**
- [ ] Multi-platform repurposing (LinkedIn → Twitter, Threads, Instagram, Facebook, Skool)
- [ ] Skill-based AI prompt generation (platform-specific skill files)
- [ ] n8n webhook integration (4 workflows)
- [ ] Google Sheets as data source via n8n WF0
- [ ] Content file storage (content/{postId}/{platform}.md)
- [ ] Polling during generation (3s interval, 5min timeout)
- [ ] Dirty platform tracking (no overwrite on active edits)

**Generation:**
- [ ] Platform skills executed locally, prompts sent to n8n
- [ ] Hook variants (2-3 alternative first lines, clickable chips)
- [ ] Image generation via n8n WF2 + ImageRouter
- [ ] Carousel skill for LinkedIn
- [ ] Image Brand Kit feeds into image prompts
- [ ] First comment field per platform variant
- [ ] 500ms stagger between platform skill executions

**AI & Chat:**
- [ ] AI chat sidebar (per-platform, persists chat history)
- [ ] chatWithAI returns { updatedText, explanation }
- [ ] Hashtag suggestions via OpenRouter
- [ ] Robust JSON parsing (code fences → object regex → fallback)

**Memory & Learning:**
- [ ] SOUL.md (system identity)
- [ ] Heartbeat.md (updated by cron)
- [ ] memory/USER.md (creator profile)
- [ ] memory/MEMORY.md (7-day rolling window)
- [ ] memory/learnings.md (append-only)
- [ ] memory/daily/ (cron logs)
- [ ] Learnings injected into all generation prompts
- [ ] Priority order respected: learnings > USER > brand-voice > platform-rules

**Cron (8 operations):**
- [ ] fetch_linkedin_posts
- [ ] identify_repurpose_eligible
- [ ] generate_pending
- [ ] evaluate_evergreen
- [ ] trigger_recycling
- [ ] fetch_analytics
- [ ] update_memory
- [ ] rebuild_heartbeat
- [ ] CRON_SECRET protection
- [ ] Log to memory/daily/ on each run

**Dashboard:**
- [ ] Stats bar (6 metrics)
- [ ] SystemPanel with webhook health
- [ ] PostsTable with sorting (newest first default)
- [ ] PostsTable with filtering (platform, status, date range)
- [ ] PostSlideOver
- [ ] Inline approve/reject on pending variants

**Repurpose page:**
- [ ] Post selector
- [ ] 5 platform cards + carousel card
- [ ] Character count with limit warnings
- [ ] Hook variant chips
- [ ] Hashtag pills + AI suggest
- [ ] Image preview + generate button
- [ ] First comment field
- [ ] Visual post preview toggle
- [ ] AI chat sidebar
- [ ] GenerationStatusPanel
- [ ] Keyboard shortcuts

**Calendar:**
- [ ] FullCalendar (month/week/day views)
- [ ] Platform-colored events
- [ ] Drag-drop rescheduling
- [ ] Gap warnings

**Analytics:**
- [ ] Platform summary cards
- [ ] Top performing posts
- [ ] Best posting times heatmap
- [ ] Overall trends chart

**Settings:**
- [ ] Brand voice form (all fields)
- [ ] Image Brand Kit form
- [ ] Hashtag bank (add, delete, search, filter, bulk import)
- [ ] Hashtag usage tracking
- [ ] Evergreen configuration form
- [ ] Evergreen queue display

**Infrastructure:**
- [ ] env.ts validation
- [ ] All 4 config JSON files with defaults
- [ ] All memory files with templates
- [ ] All 13 skill files
- [ ] n8n workflow JSONs (4 files)
- [ ] n8n README with setup instructions
- [ ] /api/env-check endpoint
- [ ] /api/test-webhooks endpoint

---

## 32. Build Order

Recommended implementation order to avoid circular dependencies:

1. `types/index.ts` — all types
2. `lib/env.ts` — env validation
3. `lib/platform-rules.ts` — PLATFORM_RULES constant
4. `lib/utils.ts` — cn(), converters
5. `config/*.json` — default config files
6. `memory/*.md` + `SOUL.md` + `Heartbeat.md` — memory files
7. `skills/**/*.md` — all skill files
8. `lib/brand-voice.ts` — brand voice helpers
9. `lib/n8n-sheet.ts` — Sheet CRUD
10. `lib/n8n.ts` — webhook firing
11. `lib/anthropic.ts` — OpenRouter calls
12. `lib/platform-skills.ts` — skill execution
13. `lib/content-store.ts` — file storage
14. `lib/docs-sync.ts` — memory updates
15. `stores/*.ts` — Zustand stores
16. API routes (start with `/api/posts`, `/api/brand-voice`, then triggers, then callbacks)
17. shadcn/ui components
18. Shared components (StatusBadge, PlatformIcon, LoadingSpinner)
19. Layout (Sidebar, TopBar, root layout)
20. Dashboard page + components
21. Repurpose page + components
22. Calendar page + components
23. Analytics page + components
24. Settings page + components
25. n8n workflow JSON files
26. n8n README

---

> Build this exactly as specified. Do not simplify, do not add features not listed, do not substitute technologies. Every detail above is intentional.
