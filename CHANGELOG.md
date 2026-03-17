# Changelog

All changes are recorded here in append-only order after every session.

---

## Session 10 — AOS + Auto-Documentation System
**Date:** 2026-03-17

### Type: feature-added
### Files changed: SOUL.md, Heartbeat.md, memory/USER.md, memory/MEMORY.md, memory/learnings.md, skills/repurpose.md, skills/cron.md, lib/docs-sync.ts, app/api/docs/sync/route.ts, app/api/docs/status/route.ts, app/api/heartbeat/route.ts, app/api/cron/route.ts, app/api/memory/route.ts, app/api/memory/update/route.ts, components/dashboard/SystemPanel.tsx, app/dashboard/page.tsx, app/api/posts/[id]/route.ts
### Summary: Implemented the full AOS (Agentic Operating System) layer. Created all six memory files (SOUL.md, Heartbeat.md, USER.md, MEMORY.md, learnings.md, and skill runbooks). Added auto-documentation system (lib/docs-sync.ts + docs API routes). Added cron route executing 8 operations. Added heartbeat API + dashboard SystemPanel. Added learning capture on approval/edit events.
### Docs affected: README.md, SOUL.md, skills/repurpose.md, skills/cron.md, Heartbeat.md

---

## Session 5 — Dashboard Page
**Date:** 2026-03-17

### Added
- `components/dashboard/PostsTable.tsx` — full table with client-side filters: platform pill toggles (All / Twitter / Threads / Instagram / Facebook / Skool), status dropdown, date range picker; clear filter button; empty states for no posts and no filter matches
- `components/dashboard/PostRow.tsx` — table row with formatted date, 80-char LinkedIn preview, per-platform StatusBadge, Repurpose and View action buttons
- `components/dashboard/StatusBadge.tsx` — color-coded badges: pending (gray), approved (blue), scheduled (amber), published (green), failed (red)
- `components/dashboard/PlatformStatusGrid.tsx` — compact and full-detail platform grid used in slide-over
- `components/dashboard/PostSlideOver.tsx` — fixed right-side panel with full LinkedIn post text, image preview, per-platform generated text + hashtags + image + schedule time, per-platform quick approve/reject buttons, Escape key close, "Edit in Repurpose" navigation

### Modified
- `app/dashboard/page.tsx` — full dashboard page: StatsBar (total posts, repurposed, published this week, pending approval), PostsTable integration, approve/reject handlers with Sheet PATCH + Zustand update + toast notification
- `stores/postsStore.ts` — implemented fetchPosts with optional filters (status, platform, from/to), implemented updateVariantStatus optimistic updater

---

## Session 4 — n8n Webhook Layer + Trigger/Callback Routes
**Date:** 2026-03-17

### Added
- `lib/anthropic.ts` — generateImagePrompts (Claude direct, pre-webhook), chatWithAI (interactive edits), generateHashtagSuggestions; model: claude-sonnet-4-5-20251101
- `lib/n8n.ts` — fireContentRepurposeWebhook (5s timeout), fireImageRepurposeWebhook (5s), firePublishWebhook (10s)
- `app/api/trigger/repurpose/route.ts` — POST: fetches post + brand voice + hashtag bank, writes _source.md, fires content repurpose webhook
- `app/api/trigger/images/route.ts` — POST: fetches post + brand voice, calls generateImagePrompts (Claude), writes prompts to Sheet, fires image repurpose webhook
- `app/api/callback/repurpose/route.ts` — POST: n8n calls here when text generation done; re-fetches post from Sheet, writes platform .md files
- `app/api/callback/images/route.ts` — POST: n8n calls here when images done; updates image_url/image_prompt frontmatter in content files
- `app/api/publish/route.ts` — POST: validates approved status, fires publish webhook, updates Sheet + content file status
- `app/api/test-webhooks/route.ts` — GET (config status) / POST (ping all 4 URLs); dev-only, blocked in production

---

## Session 3 — Brand Voice + Hashtag Bank + Settings Page
**Date:** 2026-03-17

### Added
- `lib/brand-voice.ts` — getBrandVoice, saveBrandVoice, buildBrandVoiceSystemPrompt; reads/writes config/brand-voice.json
- `lib/hashtag-bank.ts` — getHashtagBank, addHashtag, removeHashtag, incrementUsage, getRelevantHashtags; reads/writes config/hashtag-bank.json
- `app/api/brand-voice/route.ts` — GET (read profile) / POST (save profile) with Zod validation
- `app/api/hashtag-bank/route.ts` — GET / POST (add) / DELETE with Zod validation
- `components/settings/BrandVoiceForm.tsx` — full form: tone tags (8 max, suggestions), writing style textarea, topic pillars, avoid list, example posts, save with toast
- `components/settings/ExamplePostsInput.tsx` — up to 5 textarea slots, add/remove, char count
- `components/settings/AvoidListInput.tsx` — tag input with pre-suggestions pill buttons
- `components/settings/TopicPillarsInput.tsx` — tag input with 6-pillar cap
- `components/settings/HashtagBankManager.tsx` — add form with platform checkboxes + pillar selector, sortable/filterable table, bulk import
- Full `/settings` page — tabbed (Brand Voice / Hashtag Bank), loads from API on mount

### Modified
- `stores/settingsStore.ts` — implemented fetchBrandVoice and fetchHashtagBank with real API calls; added setBrandVoice and setHashtagBank setters
- `app/settings/page.tsx` — replaced stub with full tabbed Settings UI

---

## Session 2 — Google Sheets Layer + Posts API + Content Store
**Date:** 2026-03-17

### Added
- `lib/n8n-sheet.ts` — typed Sheet webhook helper: getAllPosts, getPostById, updatePlatformVariant, updateMultiplePlatforms, writeContentPrompts, writeImagePrompts, updateStatus (7 actions, 15s read / 10s write timeouts)
- `lib/content-store.ts` — file system helper for content/ directory: writeSourceFile, writePlatformFile, readPlatformFile, readAllPlatformFiles, updatePlatformFileMeta, listContentPostIds (uses gray-matter for frontmatter)
- `app/api/posts/route.ts` — GET all posts with query filters (status, platform, from, to) via n8n Sheet webhook
- `app/api/posts/[id]/route.ts` — GET single post + PATCH single/multi platform variants; syncs content files on patch
- `app/api/content/route.ts` — GET lists all post IDs with content folders
- `app/api/content/[postId]/route.ts` — GET all platform files for a post as structured JSON
- `app/api/content/[postId]/[platform]/route.ts` — GET single platform content file

### Modified
- `lib/platform-rules.ts` — expanded PlatformRule with full spec: color, maxThreadTweets, tone, formatRules, avoidPatterns
- `types/index.ts` — removed PlatformRule interface (now defined in lib/platform-rules.ts)

---

## Session 1 — Project Setup, Types, Configuration
**Date:** 2026-03-17

### Added
- Next.js 14 App Router project scaffold (TypeScript, Tailwind, dark theme)
- All dependencies: zustand, react-hook-form, @hookform/resolvers, zod, axios, date-fns, sonner, lucide-react, @anthropic-ai/sdk, gray-matter, minimatch, @dnd-kit/*, @fullcalendar/*
- `tailwind.config.ts` — dark mode class, CSS var color extensions, Geist font
- `app/globals.css` — design system CSS variables (bg-primary #0A0A0A, accent #7C3AED, etc.)
- `app/layout.tsx` — root layout with Geist font, Sidebar, Toaster
- `app/page.tsx` — redirects to /dashboard
- Page stubs: `/dashboard`, `/repurpose`, `/calendar`, `/settings`
- `components/layout/Sidebar.tsx` — fixed 240px nav with active state
- `components/layout/TopBar.tsx` — page title header
- `components/shared/PlatformIcon.tsx` — platform badge component
- `components/shared/LoadingSpinner.tsx` — animated spinner
- `components/shared/ConfirmDialog.tsx` — AlertDialog wrapper
- shadcn/ui components: button, input, textarea, badge, card, label, separator, tabs, select, dialog, alert-dialog, popover, scroll-area
- `types/index.ts` — all TypeScript interfaces (Platform, PostStatus, LinkedInPost, etc.)
- `lib/env.ts` — env var validation with console.warn
- `lib/utils.ts` — cn, formatDate, truncate, platformColor, sleep
- `lib/platform-rules.ts` — PLATFORM_RULES for all 5 platforms
- `stores/postsStore.ts` — Zustand store shell
- `stores/repurposeStore.ts` — Zustand store shell
- `stores/settingsStore.ts` — Zustand store shell
- `config/brand-voice.json` — default brand voice profile
- `config/hashtag-bank.json` — empty hashtag bank
- `content/.gitkeep` — content directory tracked in git
