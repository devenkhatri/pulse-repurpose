# Pulse n8n Workflows

Four workflows that form the backend of the Pulse Repurpose system. Import them into your n8n instance in the order listed.

---

## Import Order

1. `workflow-0-sheet-operations.json` — Sheet Operations (imported first, used by all others)
2. `workflow-1-content-repurpose.json` — Content Repurpose (AI text generation)
3. `workflow-2-image-repurpose.json` — Image Repurpose (AI image generation)
4. `workflow-3-publish.json` — Publish (cross-platform publishing + first comments)

---

## Post-Import Configuration

After importing each workflow, you must update the following placeholders.

### 1. Google Sheets (all 4 workflows)

In every `GSheets` node, replace:

| Placeholder | Replace with |
|---|---|
| `YOUR_SPREADSHEET_ID` | Your Google Sheet ID (from the URL: `docs.google.com/spreadsheets/d/YOUR_ID/`) |
| `YOUR_GOOGLE_CREDENTIAL_ID` | The n8n credential ID for your Google Sheets OAuth2 account |
| `Sheet1` | Your actual sheet/tab name |

> The Google Sheet must have Row 1 as a header row with all 94 column names exactly as listed below.

### 2. Credentials to create in n8n

Go to **Settings → Credentials → New** and create:

| Credential Name | Type | Used in |
|---|---|---|
| `Google Sheets account` | Google Sheets OAuth2 API | WF0, WF1, WF2, WF3 |
| `OpenRouter API Key` | Header Auth (Name: `Authorization`, Value: `Bearer YOUR_KEY`) | WF1 |
| `ImageRouter API Key` | Header Auth (Name: `Authorization`, Value: `Bearer YOUR_KEY`) | WF2 |
| `Twitter OAuth 1.0a` | OAuth1 API (Twitter App v1.1) | WF3 |
| `Meta Access Token` | Header Auth (Name: `Authorization`, Value: `Bearer YOUR_META_TOKEN`) | WF3 |
| `Skool Session Cookie` | Header Auth (Name: `Cookie`, Value: `session=YOUR_COOKIE`) | WF3 |

After creating each credential, open the workflow and update the `YOUR_*_CREDENTIAL_ID` references in each node's credential section.

### 3. n8n Variables (Workflow 3 — Publish)

Go to **Settings → Variables** and create:

| Variable | Description |
|---|---|
| `THREADS_USER_ID` | Your Threads/Meta user ID |
| `INSTAGRAM_USER_ID` | Your Instagram user ID |
| `FACEBOOK_PAGE_ID` | Your Facebook Page ID |
| `SKOOL_COMMUNITY_ID` | Your Skool community ID |

### 4. Webhook URLs → `.env` in Pulse app

After activating each workflow, copy the webhook URL from n8n and set in your `.env.local`:

```
N8N_SHEET_WEBHOOK_URL=https://n8n.devengoratela.in/webhook/pulse-sheet-ops
N8N_CONTENT_REPURPOSE_WEBHOOK_URL=https://n8n.devengoratela.in/webhook/pulse-content-repurpose
N8N_IMAGE_REPURPOSE_WEBHOOK_URL=https://n8n.devengoratela.in/webhook/pulse-image-repurpose
N8N_PUBLISH_WEBHOOK_URL=https://n8n.devengoratela.in/webhook/pulse-publish
```

---

## Google Sheet Column Structure (94 columns)

Row 1 must contain these exact header names in this order:

```
post_id, linkedin_text, linkedin_image_url, posted_at,
twitter_text, twitter_content_prompt, twitter_image_prompt, twitter_image_url, twitter_hashtags, twitter_status, twitter_generated_at, twitter_scheduled_at, twitter_published_at,
threads_text, threads_content_prompt, threads_image_prompt, threads_image_url, threads_hashtags, threads_status, threads_generated_at, threads_scheduled_at, threads_published_at,
instagram_text, instagram_content_prompt, instagram_image_prompt, instagram_image_url, instagram_hashtags, instagram_status, instagram_generated_at, instagram_scheduled_at, instagram_published_at,
facebook_text, facebook_content_prompt, facebook_image_prompt, facebook_image_url, facebook_hashtags, facebook_status, facebook_generated_at, facebook_scheduled_at, facebook_published_at,
skool_text, skool_content_prompt, skool_image_prompt, skool_image_url, skool_hashtags, skool_status, skool_generated_at, skool_scheduled_at, skool_published_at,
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

---

## Workflow Details

### WF0 — Sheet Operations

**Webhook path:** `pulse-sheet-ops`

Handles all Google Sheets CRUD via a single webhook. Routes `action` field to either:
- **Read path** (`GET_ALL_POSTS`, `GET_POST_BY_ID`): reads all rows and filters/finds in JavaScript
- **Write path** (all `UPDATE_*` / `WRITE_*` actions): builds the column update and calls `appendOrUpdate` matching on `post_id`

Supported actions:
- `GET_ALL_POSTS` — supports `statusFilter`, `platformFilter`, `fromDate`, `toDate`
- `GET_POST_BY_ID` — returns single post by `postId`
- `UPDATE_PLATFORM_VARIANT` — updates any fields of a single platform
- `UPDATE_MULTIPLE_PLATFORMS` — batch update multiple platforms at once
- `WRITE_CONTENT_PROMPTS` — writes `{platform}_content_prompt` columns
- `WRITE_IMAGE_PROMPTS` — writes `{platform}_image_prompt` columns
- `UPDATE_STATUS` — writes `{platform}_status` (+ `published_at` if provided)
- `UPDATE_ANALYTICS` — writes all analytics columns for one platform
- `UPDATE_FIRST_COMMENT` — writes `{platform}_first_comment` + status

### WF1 — Content Repurpose

**Webhook path:** `pulse-content-repurpose`

Receives pre-built per-platform prompts from the Pulse app (`contentPrompts` object). Splits into one item per platform, calls OpenRouter with the system+user prompt pair, extracts generated text and hashtags, writes to Google Sheets, then calls back to `callbackUrl`.

**OpenRouter credential:** Configure `Header Auth` with `Authorization: Bearer YOUR_OPENROUTER_API_KEY`.

The `model` defaults to `openrouter/auto`. Change in the `HTTP - OpenRouter AI` node to use a specific model (e.g. `anthropic/claude-3-5-sonnet`).

### WF2 — Image Repurpose

**Webhook path:** `pulse-image-repurpose`

Receives pre-built `imagePayloads` per platform. Calls ImageRouter (OpenAI-compatible image API) for each platform, extracts the generated image URL, writes to Google Sheets, then calls back.

**ImageRouter credential:** Configure `Header Auth` with `Authorization: Bearer YOUR_IMAGEROUTER_API_KEY`.

The `model` defaults to `gpt-image-1`. Change in the `HTTP - ImageRouter Generate` node body if using a different model.

Image size is derived from `styleDirectives.width` × `styleDirectives.height` passed in the payload.

### WF3 — Publish

**Webhook path:** `pulse-publish`

Routes by `platform` and publishes to the appropriate API:

| Platform | API | Notes |
|---|---|---|
| Twitter/X | Twitter API v2 | OAuth 1.0a required. Images uploaded via `upload.twitter.com` first |
| Threads | Meta Graph API (threads.net) | Two-step: create container → publish |
| Instagram | Meta Graph API | Two-step: create container → publish. Requires image for feed posts |
| Facebook | Meta Graph API | Text-only or photo post. Photo uploaded separately first |
| Skool | Skool API (placeholder) | No public API — update URL/body to match your integration |

**First Comment flow:** If `firstComment` is present in the payload, waits 30 seconds after publishing, posts the comment to the same post, and updates `{platform}_first_comment_status` in the Sheet.

---

## Notes

- **Skool:** Skool has no public API. The `HTTP - Skool Post` node is a placeholder. Replace it with your actual integration (e.g. browser automation, Make/Zapier webhook, or Skool's internal endpoints if available).
- **Twitter media upload:** The chunked media upload is not used. Images must be < 5 MB for the simple upload to succeed.
- **Scheduled posts:** `scheduledAt` is handled by the app (sets status to `scheduled`). n8n does not implement time-delayed publishing — that would require a separate cron workflow.
- All `YOUR_*` placeholders must be replaced before activating workflows.
