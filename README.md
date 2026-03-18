# Pulse Repurpose

A personal content operations tool that repurposes LinkedIn posts across Twitter/X, Threads, Instagram, Facebook, and Skool Community. Built with Next.js 14, it orchestrates AI-powered content generation and scheduling via n8n workflows.

## Features

### Core Functionality
- **Multi-Platform Repurposing** - Transform LinkedIn posts into content for Twitter/X, Threads, Instagram, Facebook, and Skool
- **AI-Powered Content Generation** - Uses Claude (via OpenRouter) to generate platform-specific content
- **Image Generation** - Creates platform-optimized images using fal.ai through n8n
- **Content Calendar** - Visual calendar with scheduling and gap warnings
- **Approval Workflow** - Review and approve AI-generated content before publishing

### Content Intelligence
- **Brand Voice Configuration** - Define tone, writing style, topic pillars, and example posts
- **Learning System** - Learns from approval patterns and content performance over time
- **Hashtag Bank** - Curated collection of hashtags organized by platform and topic pillar
- **AI Chat Assistant** - Edit and refine generated content with AI assistance

### Scheduling & Publishing
- **Calendar View** - Schedule posts across all platforms
- **Gap Warnings** - Alerts when platforms haven't been posted to recently
- **n8n Integration** - All publishing handled through n8n workflows
- **Automated Triggers** - Auto-generate content for posts within 7 days

### Data Management
- **Google Sheets Integration** - All data stored in Google Sheets (master data tracker)
- **Memory System** - Stores learnings and user profiles for personalization
- **Platform Skills** - Markdown-based skill files for customizable content generation

## Tech Stack

| Layer | Tech |
|-------|------|
| Framework | Next.js 14 (App Router) |
| Language | TypeScript (strict) |
| Styling | Tailwind CSS + shadcn/ui |
| State | Zustand |
| Forms | React Hook Form + Zod |
| AI | OpenRouter (Claude) for direct calls |
| Calendar | FullCalendar |
| HTTP | Axios |
| Dates | date-fns |
| Notifications | Sonner |

## Architecture

```
┌─────────────────┐     Webhooks      ┌─────────────────┐
│   Pulse App     │ ─────────────────► │      n8n        │
│   (Next.js)     │ ◄───────────────── │   (Workflows)   │
└────────┬────────┘                    └────────┬────────┘
         │                                      │
         │ API                                   │
         │                                      │
         ▼                                      ▼
┌─────────────────┐                    ┌─────────────────┐
│  Google Sheets  │                    │   Claude API    │
│  (Master Data)  │                    │   fal.ai API    │
└─────────────────┘                    └─────────────────┘
```

### Key Components

1. **Dashboard** - Overview of all posts with stats (total, repurposed, published, pending approval)
2. **Repurpose Page** - Select a LinkedIn post, generate variants, edit, and approve
3. **Calendar** - Schedule posts, view by platform, detect content gaps
4. **Settings** - Configure brand voice and manage hashtag bank
5. **Memory System** - `memory/learnings.md` and `memory/USER.md` for personalization

## Prerequisites

1. **Node.js** - v18+
2. **Google Sheets** - A configured sheet with post data
3. **n8n Instance** - Running at your endpoint with configured webhooks
4. **OpenRouter API Key** - For AI content generation

## Setup

### 1. Clone and Install

```bash
git clone <repository-url>
cd pulse-repurpose
npm install
```

### 2. Environment Variables

Create a `.env.local` file with the following variables:

```env
# OpenRouter AI (required for content generation)
OPENROUTER_API_KEY=your_openrouter_api_key
OPENROUTER_MODEL=openrouter/auto  # optional, auto-selects best model

# n8n Webhooks (all required)
N8N_SHEET_WEBHOOK_URL=https://your-n8n-instance.com/webhook/sheet
N8N_CONTENT_REPURPOSE_WEBHOOK_URL=https://your-n8n-instance.com/webhook/content
N8N_IMAGE_REPURPOSE_WEBHOOK_URL=https://your-n8n-instance.com/webhook/image
N8N_PUBLISH_WEBHOOK_URL=https://your-n8n-instance.com/webhook/publish

# App Configuration
NEXT_PUBLIC_APP_URL=http://localhost:3000

# Cron Settings (optional)
CRON_SECRET=your_cron_secret
CRON_SCHEDULE=0 7 * * *
```

### 3. n8n Workflow Setup

Create four n8n workflows with the following webhook triggers:

| Webhook | Purpose |
|---------|---------|
| Sheet | All Google Sheets read/write operations |
| Content | Claude API calls for text generation (all 5 platforms in parallel) |
| Image | fal.ai image generation (all 5 platforms in parallel) |
| Publish | Route by platform and publish content |

### 4. Google Sheets Structure

Your sheet should have columns for:
- LinkedIn post ID, text, image URL, posted date
- Per-platform: text, image, hashtags, status, scheduled/published dates

### 5. Run the Application

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) — redirects to Dashboard.

## Project Structure

```
pulse-repurpose/
├── app/                    # Next.js App Router pages
│   ├── api/               # API routes
│   │   ├── trigger/       # Content/image generation triggers
│   │   ├── callback/      # n8n callbacks
│   │   ├── posts/         # Post CRUD
│   │   ├── chat/          # AI chat endpoint
│   │   ├── hashtags/      # Hashtag generation
│   │   ├── brand-voice/   # Brand voice management
│   │   └── ...
│   ├── dashboard/         # Main dashboard page
│   ├── repurpose/         # Content repurposing page
│   ├── calendar/          # Calendar view
│   └── settings/          # Settings page
├── components/            # React components
│   ├── dashboard/         # Dashboard-specific components
│   ├── repurpose/         # Repurpose page components
│   ├── calendar/         # Calendar components
│   ├── settings/          # Settings components
│   ├── layout/            # Layout components (TopBar, etc.)
│   ├── ui/                # shadcn/ui components
│   └── shared/            # Shared components
├── lib/                   # Core utilities
│   ├── anthropic.ts       # OpenRouter/Claude API calls
│   ├── platform-skills.ts # Skill file executor
│   ├── platform-rules.ts  # Platform-specific rules
│   ├── brand-voice.ts     # Brand voice utilities
│   ├── n8n.ts            # n8n webhook helpers
│   ├── n8n-sheet.ts      # Sheet operations via n8n
│   └── content-store.ts  # File-based content storage
├── stores/                # Zustand stores
│   ├── postsStore.ts     # Posts state management
│   ├── repurposeStore.ts # Repurpose session state
│   └── settingsStore.ts  # Settings state
├── types/                 # TypeScript types
│   └── index.ts          # All type definitions
├── skills/               # Platform skill files
│   └── platforms/         # {platform}-{content|image}.md
├── memory/               # Learning system
│   ├── learnings.md       # Approval patterns & performance
│   └── USER.md          # User voice fingerprint
└── public/               # Static assets
```

## API Routes

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/posts` | GET | Fetch all posts |
| `/api/posts/[id]` | GET/PATCH | Get/update single post |
| `/api/trigger/repurpose` | POST | Trigger content generation |
| `/api/trigger/images` | POST | Trigger image generation |
| `/api/publish` | POST | Publish content to platform |
| `/api/chat` | POST | AI chat for content editing |
| `/api/hashtags` | POST | Generate hashtag suggestions |
| `/api/brand-voice` | GET/PUT | Get/update brand voice |
| `/api/hashtag-bank` | GET/POST | Manage hashtag bank |
| `/api/memory` | GET | Get learnings and user profile |
| `/api/callback/repurpose` | POST | n8n callback after content generation |
| `/api/callback/images` | POST | n8n callback after image generation |
| `/api/cron` | POST | Scheduled job trigger |

## Platform Rules

Each platform has specific rules defined in `lib/platform-rules.ts`:

| Platform | Max Chars | Thread Support | Image Sizes |
|----------|-----------|----------------|-------------|
| Twitter/X | 280 | Yes (up to 10) | 1200×675, 1080×1080 |
| Threads | 500 | No | 1080×1080, 1080×1350 |
| Instagram | 2200 | Yes | 1080×1080, 1080×1350 |
| Facebook | 63206 | Yes | 1200×630 |
| Skool | 1000 | No | 800×400 |

## Platform Skills

Platform content is generated using skill files in `skills/platforms/`. Each platform has:
- `{platform}-content.md` - Text generation skill
- `{platform}-image.md` - Image prompt skill

Skills define:
- System prompt template with brand voice injection
- User prompt template
- Output format (JSON contract)
- Learning injection rules

## Memory System

The app learns from your editing patterns:

- `memory/learnings.md` - Contains approval patterns, content performance, platform-specific tone adjustments
- `memory/USER.md` - Contains voice fingerprint and approval patterns

These are automatically injected into prompts to improve content quality over time.

## Troubleshooting

### Common Issues

**502 Bad Gateway**
- Check if n8n workflows are running
- Verify webhook URLs in `.env.local` are correct
- Check n8n workflow execution logs

**Empty Content Responses**
- Verify OpenRouter API key is valid
- Check skill files in `skills/platforms/` are properly formatted

**JSON Parse Errors**
- The app now includes robust error handling for malformed LLM responses
- Check console logs for the response preview

**Image Generation Fails**
- Verify fal.ai integration in n8n
- Check image prompt outputs are valid

### Debug Mode

Add verbose logging by checking console output from:
- `/api/trigger/repurpose` - Content generation logs
- `/api/trigger/images` - Image generation logs
- n8n workflow execution history

## License

Private - All rights reserved
