# Pulse Repurpose — Build Plan

## Context
Building a personal content operations tool (Pulse Repurpose) from scratch. The repo currently contains only the spec file, README, .gitignore, and .env.local with pre-filled n8n webhook URLs. No application code exists yet.

The app is a Next.js 14 (App Router) thin orchestrator UI + webhook trigger that fires to n8n, polls Google Sheets for results, and lets the user review/edit/approve/publish content variants.

## Decisions Made
1. **n8n workflows**: Already built and active at `n8n.devengoratela.in` — skip n8n MCP workflow creation session.
2. **Claude model**: Use `claude-sonnet-4-5` for all direct API calls (chat sidebar + hashtag suggestions).
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

### Session 7 — Anthropic Direct Calls (Chat + Hashtags)
- `lib/anthropic.ts` — chat (streaming) + hashtag suggestions, model: `claude-sonnet-4-5`
- `app/api/chat/route.ts` — streaming response for AI sidebar
- `app/api/hashtags/route.ts` — returns suggested hashtags
- `components/repurpose/AIChatSidebar.tsx` — message history, quick action chips, diff highlighting
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
- Auto-trigger safeguard: only fires if pending + post < 7 days + status idle
- Webhook URL validation banner on startup (any missing N8N_* URLs)
- First-run redirect to /settings if no brand voice configured
- Error state refinement for all 10 error scenarios from spec
- Character limit warning (warn but allow approve)
- Duplicate publish prevention (warn if already scheduled/published)
- Schedule time validation (minimum 15 minutes in future)
- fal.ai URL expiry note in image preview

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
