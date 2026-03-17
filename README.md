# Pulse Repurpose

A personal content operations tool that repurposes LinkedIn posts across Twitter/X, Threads, Instagram, Facebook, and Skool Community.

## Overview

Pulse Repurpose is a thin orchestrator UI — it fires webhooks to n8n workflows which handle all AI calls (Claude for text, fal.ai for images) and all publishing. The app is responsible for triggering workflows, polling Google Sheets for results, reviewing/editing variants, and approving/scheduling posts.

## Tech Stack

| Layer | Tech |
|-------|------|
| Framework | Next.js 14 (App Router) |
| Language | TypeScript (strict) |
| Styling | Tailwind CSS + shadcn/ui |
| State | Zustand |
| Forms | React Hook Form + Zod |
| AI (direct) | Anthropic Claude API (chat sidebar + hashtags) |
| Calendar | FullCalendar |
| HTTP | Axios |
| Dates | date-fns |
| Notifications | Sonner |

## Environment Variables

| Variable | Description |
|----------|-------------|
| `N8N_SHEET_WEBHOOK_URL` | Webhook 0: all Google Sheet read/write operations |
| `N8N_CONTENT_REPURPOSE_WEBHOOK_URL` | Webhook 1: triggers Claude text generation via n8n |
| `N8N_IMAGE_REPURPOSE_WEBHOOK_URL` | Webhook 2: triggers fal.ai image generation via n8n |
| `N8N_PUBLISH_WEBHOOK_URL` | Webhook 3: publishes to social platforms via n8n |
| `ANTHROPIC_API_KEY` | Used only for chat sidebar and hashtag suggestions |
| `NEXT_PUBLIC_APP_URL` | App URL for n8n callbacks (default: http://localhost:3000) |
| `CRON_SECRET` | Secret for cron job endpoint authentication |
| `CRON_SCHEDULE` | Cron schedule expression (default: `0 7 * * *`) |

## Running Locally

```bash
# Install dependencies
npm install

# Start dev server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) — redirects to Dashboard.

## n8n Workflows

All AI and publishing logic lives in n8n (at `n8n.devengoratela.in`):

1. **Sheet webhook** — handles all Google Sheets read/write operations
2. **Content repurpose webhook** — calls Claude API for all 5 platforms in parallel
3. **Image repurpose webhook** — calls fal.ai for all 5 platforms in parallel
4. **Publish webhook** — routes by platform and publishes content

Google Sheets is the master data tracker. The app has zero Google credentials.
