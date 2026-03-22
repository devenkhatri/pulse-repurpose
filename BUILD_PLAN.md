# Pulse Repurpose — Build Plan

## Context
Building a personal content operations tool (Pulse Repurpose) from scratch. The repo currently contains only the spec file, README, .gitignore, and .env.local with pre-filled n8n webhook URLs. No application code exists yet.

The app is a Next.js 14 (App Router) thin orchestrator UI + webhook trigger that fires to n8n, polls Google Sheets for results, and lets the user review/edit/approve/publish content variants.

## Decisions Made
1. **n8n workflows**: Already built and active at `n8n.devengoratela.in` — skip n8n MCP workflow creation session.
2. **LLM provider**: Use **OpenRouter** for all direct LLM calls (chat sidebar, hashtag suggestions, image prompt generation). Model: `openrouter/auto` by default — override with `OPENROUTER_MODEL` env var (e.g. `meta-llama/llama-3.1-8b-instruct:free` for a specific free model). No Anthropic SDK used.
3. **content/ directory**: Track in git (not gitignored) — personal post history is versioned.
4. **Publish scope**: Build full publish flow for all 5 platforms — credentials will be in n8n.

---

## Build Sessions

### Session 1 — Project Setup, Types, Configuration
Scaffold the entire project shell. Everything needed to `npm run dev` successfully.
- `create-next-app` with TypeScript + Tailwind + App Router
- All dependencies installed
- Design system (CSS variables, dark theme)
- All TypeScript types
- Sidebar + TopBar layout
- Platform rules lib
- Zustand store shells
- All page stubs (dashboard, repurpose, calendar, settings)

### Session 2 — Google Sheets Layer (n8n-sheet.ts + Posts API)
All Sheet I/O through `n8n-sheet.ts`. Posts API routes. Content store foundation.
- `lib/n8n-sheet.ts` — 7 actions via N8N_SHEET_WEBHOOK_URL
- `lib/content-store.ts` — read/write content .md files with gray-matter
- `app/api/posts/route.ts` — GET all posts (filter by status, platform, date)
- `app/api/posts/[id]/route.ts` — GET/PATCH single post
- `app/api/content/route.ts` + `app/api/content/[postId]/route.ts` + `app/api/content/[postId]/[platform]/route.ts`
- Zod schemas for all route request/response bodies

### Session 3 — Brand Voice + Hashtag Bank + Settings Page
- `lib/brand-voice.ts` — getBrandVoice, saveBrandVoice, buildBrandVoiceSystemPrompt
- `lib/hashtag-bank.ts` — CRUD + getRelevantHashtags
- `config/brand-voice.json` (default), `config/hashtag-bank.json` (empty)
- `app/api/brand-voice/route.ts` — GET/POST
- `app/api/hashtag-bank/route.ts` — GET/POST/DELETE
- Full `/settings` page: Brand Voice tab (tone tags, writing style, pillars, avoid list, example posts) + Hashtag Bank tab (add form, sortable table, bulk import)

### Session 4 — n8n Webhook Layer + Trigger/Callback Routes
- `lib/n8n.ts` — fireContentRepurposeWebhook, fireImageRepurposeWebhook, firePublishWebhook
- `app/api/trigger/repurpose/route.ts`
- `app/api/trigger/images/route.ts` — generates image prompts via Claude, then fires webhook
- `app/api/callback/repurpose/route.ts` — n8n calls when text done; writes content files
- `app/api/callback/images/route.ts` — n8n calls when images done; updates content file meta
- `app/api/publish/route.ts`
- `app/api/test-webhooks/route.ts` — dev-only, fires test payloads to all 4 URLs

### Session 5 — Dashboard Page
Full dashboard with table, filters, stats bar, slide-over.
- `components/dashboard/PostsTable.tsx`, `PostRow.tsx`, `StatusBadge.tsx`, `PlatformStatusGrid.tsx`
- Filter pills (All/Twitter/Threads/Instagram/Facebook/Skool) + status filter + date range picker
- Stats bar: total posts, repurposed, published this week, pending approval
- Row click → slide-over with full post text, per-platform preview, approve/reject, "Edit in Repurpose" button
- Connect to `postsStore` with real Sheet data

### Session 6 — Repurpose Page
Three-column layout: source panel → platform cards → AI chat sidebar (chat sidebar stubbed, filled in Session 7).
- `components/repurpose/SourcePostPanel.tsx`
- `components/repurpose/PlatformCard.tsx` — editable textarea, char count (red > limit), image section (skeleton → preview), hashtag chips, approve toggle, schedule picker, publish button
- `components/repurpose/GenerationStatusPanel.tsx` — live status indicators, polling loop (3s, 5-min timeout)
- `components/repurpose/ApproveButton.tsx`
- `components/repurpose/ImagePreview.tsx`
- Connect to `repurposeStore`, wire trigger + callback polling

### Session 7 — OpenRouter Direct Calls (Chat + Hashtags)
- `lib/anthropic.ts` — OpenRouter-backed: `chatWithAI`, `generateHashtagSuggestions`, `generateImagePrompts`. Uses `fetch` (no extra SDK). Model: `OPENROUTER_MODEL` env var (default `openrouter/free`).
- `app/api/chat/route.ts` — POST, calls `chatWithAI`, returns `{ updatedText, explanation }`
- `app/api/hashtags/route.ts` — POST, calls `generateHashtagSuggestions`, returns `{ suggestions }`
- `components/repurpose/AIChatSidebar.tsx` — message history, quick action chips, word-level diff highlighting
- `components/repurpose/HashtagSuggestions.tsx` — chips with click-to-add

### Session 8 — Platform Skills
- `skills/platforms/twitter-content.md`, `twitter-image.md`
- `skills/platforms/threads-content.md`, `threads-image.md`
- `skills/platforms/instagram-content.md`, `instagram-image.md`
- `skills/platforms/facebook-content.md`, `facebook-image.md`
- `skills/platforms/skool-content.md`, `skool-image.md`
- `app/api/skills/platform-prompt/route.ts` — Claude reads skill file, returns ContentPromptOutput or ImagePromptOutput
- `app/api/skills/repurpose/route.ts` — memory-aware master repurpose skill executor (8-step runbook)
- Update trigger routes to call platform skills in parallel before firing n8n, persist prompts to Sheet

### Session 9 — Calendar Page
- Install FullCalendar React packages
- `components/calendar/CalendarView.tsx` — month/week views, platform-colored events
- `components/calendar/EventPopover.tsx` — full preview, reschedule picker, cancel button
- `components/calendar/GapWarningBanner.tsx` — per-platform gap detection
- Full `/calendar` page with gap warning logic

### Session 10 — AOS + Auto-Documentation System
- `SOUL.md`, `Heartbeat.md` (project root)
- `memory/USER.md`, `memory/MEMORY.md`, `memory/learnings.md`
- `skills/repurpose.md`, `skills/cron.md`
- `lib/docs-sync.ts` — DOC_IMPACT_MAP, CHANGELOG writer, doc generators (Claude + template)
- `app/api/docs/sync/route.ts` — POST to trigger doc regeneration
- `app/api/docs/status/route.ts` — GET freshness of all docs
- `app/api/heartbeat/route.ts` — GET Heartbeat.md as JSON
- `app/api/cron/route.ts` — POST protected by CRON_SECRET, executes cron skill
- `app/api/memory/route.ts` + `app/api/memory/update/route.ts`
- Dashboard AOS panel (Heartbeat status, learnings, memory, "Run cron now", gap warnings, docs status)
- Learning capture: approval/edit event listeners → append to learnings.md

### Session 11 — Polish + Edge Cases
- Keyboard shortcuts: Cmd+Enter (approve), Cmd+R (re-generate), Cmd+S (save settings), Escape (close)
- Webhook URL validation banner on startup (any missing N8N_* URLs)
- First-run redirect to /settings if no brand voice configured
- Error state refinement for all 10 error scenarios from spec
- Character limit warning (warn but allow approve)
- Duplicate publish prevention (warn if already scheduled/published)
- Schedule time validation (minimum 15 minutes in future)
- fal.ai URL expiry note in image preview

---

## Phase 2 — Gap Features (Industry Parity)

Identified via gap analysis against Buffer, Taplio, Lately.ai, Repurpose.io (March 2026).
Each session is self-contained and can be built independently after Session 11.

---

### Session 12 — Analytics Integration
Pull real engagement metrics from published platforms via n8n and feed them back into the learning system.

**App changes:**
- **Google Sheet schema**: Add `[platform]_platform_post_id` + analytics columns (`_impressions`, `_likes`, `_comments`, `_shares`, `_engagement_rate`, `_fetched_at`) per platform — 37 new columns total (AX–CA range)
- **`PlatformVariant` type**: Add `platformPostId: string | null` field
- **New Sheet actions**: `UPDATE_ANALYTICS` + `updateAnalytics()` helper in `lib/n8n-sheet.ts`
- **`lib/analytics.ts`**: `getTopPerformingPosts`, `getBestPostingTimes`, `getPlatformSummary`
- **`/analytics` page**: Per-platform stats bar, top posts table sorted by engagement rate, best time to post, empty state
- **Dashboard stats bar**: Add "Avg engagement rate" + "Top platform" stats
- **`POST /api/trigger/analytics`**: Manual trigger → fires Workflow 4 webhook
- **`POST /api/callback/analytics`**: n8n calls after metrics written → triggers cron learning update
- **Cron Operation 9**: High-performing posts → `learnings.md` content performance section; low performers → patterns to avoid. Closes the performance → learning feedback loop.

**n8n Workflow 0 changes (15 steps — perform before app work):**

*PART 1 — Google Sheet*
- **Step 1**: Add 40 new column headers to the "Posts" sheet after column AW:
  - Analytics (30 cols, AX–CA): `twitter_impressions`, `twitter_likes`, `twitter_comments`, `twitter_shares`, `twitter_engagement_rate`, `twitter_fetched_at` … same pattern for threads (BD–BI), instagram (BJ–BO), facebook (BP–BU), skool (BV–CA)
  - First comment (10 cols, CB–CK): `twitter_first_comment`, `twitter_first_comment_status` … same pattern for threads (CD–CE), instagram (CF–CG), facebook (CH–CI), skool (CJ–CK)

*PART 2 — Define Column Map node*
- **Step 2**: Open "Define Column Map" Code node. Replace the COLUMN_MAP constant entirely with the expanded version from master plan — adds `impressions`, `likes`, `comments`, `shares`, `engagementRate`, `fetchedAt`, `firstComment`, `firstCommentStatus` per platform. The `body` and `return` lines stay the same.

*PART 3 — Route Action Switch node*
- **Step 3**: Open "Route Action" Switch node. Add two new rules (existing rules 0–6 unchanged):
  - Output 7 → `UPDATE_ANALYTICS` (`{{ $json.action }}` equals `UPDATE_ANALYTICS`)
  - Output 8 → `UPDATE_FIRST_COMMENT` (`{{ $json.action }}` equals `UPDATE_FIRST_COMMENT`)

*PART 4 — New Branch 7: UPDATE_ANALYTICS*
- **Step 4**: Add Code node "Build Analytics Update" (Run Once for All Items) — code from master plan: reads `{ postId, platform, metrics }` from payload, maps to column letters via COLUMN_MAP, always writes `fetchedAt` timestamp
- **Step 5**: Add Google Sheets node "GS Update Analytics" — Operation: Update, Sheet: Posts, Matching Column: `post_id`
- **Step 6**: Add Respond to Webhook node "Respond: UPDATE_ANALYTICS" — Response Body: `{"success":true}`
- **Step 7**: Connect: Switch output 7 → Build Analytics Update → GS Update Analytics → Respond: UPDATE_ANALYTICS

*PART 5 — New Branch 8: UPDATE_FIRST_COMMENT*
- **Step 8**: Add Code node "Build First Comment Update" (Run Once for All Items) — code from master plan: reads `{ postId, platform, firstComment, firstCommentStatus }` from payload, maps to column letters via COLUMN_MAP
- **Step 9**: Add Google Sheets node "GS Update First Comment" — Operation: Update, Sheet: Posts, Matching Column: `post_id`
- **Step 10**: Add Respond to Webhook node "Respond: UPDATE_FIRST_COMMENT" — Response Body: `{"success":true}`
- **Step 11**: Connect: Switch output 8 → Build First Comment Update → GS Update First Comment → Respond: UPDATE_FIRST_COMMENT

*PART 6 — Sticky notes*
- **Step 12**: Update overview sticky: `SUPPORTED ACTIONS (7 total)` → `(9 total)`, add `UPDATE_ANALYTICS` and `UPDATE_FIRST_COMMENT` to action list
- **Step 13**: Update Switch sticky: add `7 → UPDATE_ANALYTICS`, `8 → UPDATE_FIRST_COMMENT` to OUTPUT MAPPING

*PART 7 — Save & Verify*
- **Step 14**: Save workflow (already active, no need to re-activate)
- **Step 15**: Smoke test with curl — see master plan for exact payloads. Expected response: `{"success":true}` for both actions.

**n8n Workflow 3 changes (run before Session 12 analytics work):**
- After each platform publish API call succeeds: extract platform-native post ID from response
- Write `platformPostId` back to Sheet via `UPDATE_PLATFORM_VARIANT` action
- This is required by Workflow 4 to call platform metrics APIs

**New n8n Workflow 4 — Analytics Fetch:**
- Dual trigger: Schedule node (daily 06:00) + Webhook node (manual, `POST /api/trigger/analytics`)
- Step 1: Get all `published` posts from Sheet → filter last 30 days
- Step 2: Split by platform, skip Skool (no public API)
- Step 3: Switch by platform → Twitter v2 API / Instagram Insights / Facebook Page Insights / Threads Insights
- Step 4: Parse metrics, calculate `engagementRate = (likes+comments+shares) / impressions * 100`
- Step 5: Write via `UPDATE_ANALYTICS` per post/platform
- Step 6: Callback to `/api/callback/analytics` with `{ fetched, failed, timestamp }`
- New credentials: "Twitter - Pulse" (Bearer Token), "Meta - Pulse" (Facebook App), "Threads - Pulse"
- New env var: `N8N_ANALYTICS_WEBHOOK_URL` → add to `.env.local`

### Session 13 — First Comment Scheduling
Schedule the first comment alongside a post (critical for LinkedIn hashtag/link strategy).

**App changes:**
- **Type update**: Add `firstComment: string | null` and `firstCommentStatus: string | null` to `PlatformVariant`
- **Sheet schema**: Add `[platform]_first_comment` and `[platform]_first_comment_status` columns (CB–CK, 10 columns)
- **`updateFirstComment()` helper** in `lib/n8n-sheet.ts` (calls `UPDATE_FIRST_COMMENT` action)
- **Repurpose page**: First comment textarea per platform card (collapsible "+ Add first comment"), pre-filled for LinkedIn with hashtag bank tags + any links from post
- Platform defaults: LinkedIn (show + pre-fill), Twitter/Instagram (hidden), Facebook/Skool (shown, optional)
- **Publish API update**: Include `firstComment` field in `PublishWebhookPayload`

**n8n Workflow 0 changes:**
- Steps 8–11 from the Session 12 Workflow 0 guide (Branch 8: UPDATE_FIRST_COMMENT) apply here if not already done
- COLUMN_MAP already updated in Session 12 (firstComment + firstCommentStatus columns added)

**n8n Workflow 3 changes:**
- After publish success: IF node "Has First Comment" checks `payload.firstComment`
- True branch: Wait 30s → "Post First Comment" HTTP Request per platform (Twitter reply, Instagram/Facebook comment, Threads reply)
- Write `firstCommentStatus: published | failed` to Sheet via `UPDATE_FIRST_COMMENT` action
- Comment failure must NOT affect main post status — handle independently with Continue on Fail
- Update Workflow 3 sticky notes to document first comment flow

### Session 14 — Bulk Repurpose
Select multiple dashboard rows and repurpose all in one action.

- **Dashboard**: Checkbox column on PostsTable rows, "Select all" header checkbox, bulk action bar ("Repurpose selected (N)" + count)
- **`POST /api/trigger/repurpose/bulk`**: Accepts `{ postIds: string[], platforms?: Platform[] }`, processes sequentially with 2s delay to avoid n8n rate limits, returns per-post results
- **Filter**: Only queue posts where ALL platforms are `pending`; skip in-progress posts
- **UI feedback**: Per-post status in a bulk progress panel shown during processing

### Session 15 — Evergreen Content Recycling Queue
Re-queue top-performing posts for republication after a configurable interval.

- **`config/evergreen.json`**: `{ enabled, engagementThreshold, recycleIntervalDays, platforms }`
- **Settings — Evergreen tab**: Enable toggle, threshold slider, interval picker, platform checkboxes
- **`GET/POST /api/evergreen`**: Read/write evergreen config
- **Cron Operation 10**: Check posts where `published_at` > recycle interval + engagement ≥ threshold → reset status to `approved` → log to learnings.md
- **Dashboard**: "♻" badge on recycled post rows; filter option "Show recycled"

### Session 16 — Hook Variants + LinkedIn Carousel
Two high-impact content features: A/B hook options and LinkedIn's highest-reach format.

**Hook Variants:**
- **Platform skill update**: All 5 content skills return `hookVariants: string[]` (2–3 opening alternatives)
- **`ContentPromptOutput` type update**: Add `hookVariants: string[]`
- **Repurpose page**: Hook picker panel per platform card — 2–3 clickable chips above textarea; clicking replaces first line of text, marks as "edited"

**LinkedIn Carousel:**
- **`skills/platforms/linkedin-carousel-content.md`**: New skill — generates structured slide deck from LinkedIn post
- **New type `CarouselPromptOutput`**: `{ coverSlide, slides[], closingSlide, caption, hashtags }`
- **`POST /api/skills/carousel`**: Executes carousel skill, returns `CarouselPromptOutput`
- **Repurpose page**: "LinkedIn Carousel" toggle in source panel; Carousel Preview component (stacked slide cards, each editable); "Copy as JSON" + "Copy slide texts" export buttons

### Session 17 — Image Brand Kit + Visual Post Preview
Ensure visual consistency across all generated images and let users preview posts before publishing.

**Image Brand Kit:**
- **`BrandVoiceProfile` type update**: Add `imageBrandKit: { primaryColor, secondaryColor, visualStyle, photographyStyle, moodKeywords, avoidInImages }`
- **Settings — Brand Voice tab**: Add "Image Brand Kit" section with hex color pickers, visual style pills, photography style pills, mood keywords tag input, avoid tag input
- **All image skill files**: Inject `imageBrandKit` into prompt template and negative prompt suffix
- **`lib/brand-voice.ts`**: Update `getBrandVoice` and `saveBrandVoice` for new field

**Visual Post Preview:**
- **`components/repurpose/PostPreview.tsx`**: Platform-accurate mock rendering of how the post will look — Twitter card, Instagram grid tile, Facebook post, LinkedIn post, Threads bubble
- **Repurpose page**: "Preview" toggle on each platform card — switches between edit mode and preview mode
- Preview is read-only, shows hashtags inline in platform-native position, image at correct aspect ratio

---

## Session 1 — Complete File List

### Bootstrap
- Run `npx create-next-app@latest` with TypeScript, Tailwind, App Router, no src/ dir, `@/*` path alias
- Run `npx shadcn@latest init` (dark theme, CSS variables)
- Install all dependencies:
  ```
  zustand react-hook-form @hookform/resolvers zod axios date-fns sonner lucide-react
  @anthropic-ai/sdk gray-matter minimatch
  @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities
  @fullcalendar/react @fullcalendar/daygrid @fullcalendar/timegrid @fullcalendar/interaction
  ```
- Add shadcn components: button, input, textarea, badge, card, dialog, alert-dialog, tabs, popover, separator, scroll-area, select, label, toast

### Config Files (generated/modified by scaffold)
- `package.json` — all dependencies above
- `tsconfig.json` — strict: true, paths: `@/*`
- `tailwind.config.ts` — dark mode `class`, extend colors from CSS vars, Geist font
- `postcss.config.js`
- `next.config.ts`
- `components.json` — shadcn config

### Styling
- `app/globals.css` — Tailwind directives + CSS custom properties:
  - `--bg-primary: #0A0A0A`
  - `--bg-secondary: #111111`
  - `--bg-card: #161616`
  - `--accent: #7C3AED`
  - `--success: #10B981`
  - `--warning: #F59E0B`
  - `--error: #EF4444`
  - Geist + Geist Mono font variables

### App Shell
- `app/layout.tsx` — root layout: Geist font, dark `<html>`, `<Sidebar>` + main content area + `<Toaster>`
- `app/page.tsx` — `redirect('/dashboard')`

### Page Stubs
- `app/dashboard/page.tsx` — renders `<h1>Dashboard</h1>` placeholder
- `app/repurpose/page.tsx` — renders `<h1>Repurpose</h1>` placeholder
- `app/calendar/page.tsx` — renders `<h1>Calendar</h1>` placeholder
- `app/settings/page.tsx` — renders `<h1>Settings</h1>` placeholder

### Layout Components
- `components/layout/Sidebar.tsx` — fixed left nav (240px), logo at top, nav items with active state via `usePathname`: Dashboard (LayoutDashboard icon), Repurpose (RefreshCw icon), Calendar (Calendar icon), Settings (Settings icon)
- `components/layout/TopBar.tsx` — top bar with current page title, right side empty for now

### Shared Components
- `components/shared/PlatformIcon.tsx` — maps Platform type → colored badge or icon (Twitter/X: blue, Threads: gray, Instagram: pink, Facebook: blue, Skool: green)
- `components/shared/LoadingSpinner.tsx` — animated Tailwind spinner, accepts `size` prop
- `components/shared/ConfirmDialog.tsx` — wraps shadcn AlertDialog, accepts title/description/onConfirm/onCancel props

### Types
- `types/index.ts` — all types, no `any`:
  ```typescript
  Platform = 'twitter' | 'threads' | 'instagram' | 'facebook' | 'skool' | 'linkedin'
  PostStatus = 'pending' | 'approved' | 'scheduled' | 'published' | 'failed'
  GenerationStatus = 'idle' | 'generating_text' | 'generating_images' | 'done' | 'failed'
  PlatformVariant { text, contentPrompt, imagePrompt, imageUrl, hashtags, status, generatedAt, scheduledAt, publishedAt, approvedAt, isEdited, error }
  LinkedInPost { id, linkedinText, linkedinImageUrl, postedAt, platforms: Record<Platform, PlatformVariant>, sheetRowId }
  BrandVoiceProfile { toneDescriptors, writingStyle, topicPillars, avoidList, examplePosts, lastUpdated }
  HashtagBankEntry { id, hashtag, platforms, topicPillar, usageCount, lastUsed }
  ContentRepurposeWebhookPayload { postId, linkedinText, brandVoice, contentPrompts: Record<Platform, ContentPromptOutput>, callbackUrl }
  ImageRepurposeWebhookPayload { postId, imagePayloads: Record<Platform, ImagePromptOutput>, callbackUrl }
  PublishWebhookPayload { platform, text, imageUrl, hashtags, scheduledAt, sheetRowId, postId }
  N8nCallbackPayload { postId, status: 'done' | 'failed', error? }
  CalendarEvent { id, postId, platform, text, imageUrl, scheduledAt, status }
  GapWarning { platform, daysSinceLastPost, suggestedDate }
  ContentPromptOutput { systemPrompt, userPrompt, context: { platformLabel, maxChars, hashtagCount, threadEnabled, learningsApplied } }
  ImagePromptOutput { prompt, sourceImageUrl, styleDirectives: { aspectRatio, width, height, mood, colorTone, composition, textOverlay: false }, negativePrompt }
  SheetAction = 'GET_ALL_POSTS' | 'GET_POST_BY_ID' | 'UPDATE_PLATFORM_VARIANT' | 'UPDATE_MULTIPLE_PLATFORMS' | 'WRITE_CONTENT_PROMPTS' | 'WRITE_IMAGE_PROMPTS' | 'UPDATE_STATUS'
  ```

### Lib — Env Validation
- `lib/env.ts` — reads env vars with `process.env`, validates all 4 `N8N_*` URLs are present, exports typed `env` object, console.warns on missing keys (does not throw — allows partial local dev)

### Lib — Utils
- `lib/utils.ts` — `cn()` (clsx + tailwind-merge), `formatDate(date: Date): string`, `truncate(text: string, maxLen: number): string`, `platformColor(platform: Platform): string`, `sleep(ms: number): Promise<void>`

### Lib — Platform Rules
- `lib/platform-rules.ts` — `PLATFORM_RULES: Record<Platform, PlatformRule>` with full config for all 5 platforms:
  - Twitter: maxChars 280, threadEnabled true, hashtags 1-3, imageSize 1200×675
  - Threads: maxChars 500, threadEnabled false, hashtags 0-5, imageSize 1080×1080
  - Instagram: maxChars 2200, hashtags 5-15, imageSize 1080×1080
  - Facebook: maxChars 63206, hashtags 0-3, imageSize 1200×630
  - Skool: maxChars 10000, hashtags 0, imageSize 1200×675

### Zustand Stores (shells with types, no data fetching yet)
- `stores/postsStore.ts` — `{ posts: LinkedInPost[], loading: boolean, error: string | null, fetchPosts: () => Promise<void> }` — fetchPosts is a no-op stub
- `stores/repurposeStore.ts` — `{ activePost: LinkedInPost | null, generationStatus: GenerationStatus, setActivePost, setGenerationStatus }` — stubs
- `stores/settingsStore.ts` — `{ brandVoice: BrandVoiceProfile | null, hashtagBank: HashtagBankEntry[], fetchBrandVoice, fetchHashtagBank }` — stubs

### Config Files
- `config/brand-voice.json` — default BrandVoiceProfile: `{ toneDescriptors: ["clear", "practical", "direct"], writingStyle: "Short punchy paragraphs. Lead with the insight.", topicPillars: ["productivity", "leadership", "engineering"], avoidList: ["synergy", "leverage", "game-changer", "thought leader"], examplePosts: [], lastUpdated: "" }`
- `config/hashtag-bank.json` — `[]`

### Content Directory
- `content/.gitkeep` — so the directory is tracked; post subdirectories created at runtime

### Documentation
- `CHANGELOG.md` — header comment + Session 1 entry
- `README.md` — replace current 1-liner with: project overview, tech stack, env var table, `npm run dev` instructions, n8n workflow summary

---

## Session 1 Verification
1. `npm run dev` starts at `localhost:3000` with no errors
2. Browser shows Sidebar + "Dashboard" content area
3. `/repurpose`, `/calendar`, `/settings` all render stubs without 404
4. `npm run build` passes TypeScript type check with zero errors (strict mode)
5. `lib/env.ts` logs a console.warn for `ANTHROPIC_API_KEY=your_key_here` placeholder
