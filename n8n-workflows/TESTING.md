# Pulse n8n Workflows — Testing Guide

Replace `localhost:5678` with your n8n instance URL throughout.

**Recommended test order:** Workflow 0 → 1 → 2 → 3 (activate Workflow 0 first — workflows 1–3 call it as a sub-webhook).

---

## Workflow 0 — Sheet Operations (`pulse-sheet-ops`)

Test this first. All other workflows depend on it.

**GET_ALL_POSTS**
```bash
curl -X POST http://localhost:5678/webhook/pulse-sheet-ops \
  -H "Content-Type: application/json" \
  -d '{
    "action": "GET_ALL_POSTS",
    "payload": {}
  }'
```

**GET_POST_BY_ID**
```bash
curl -X POST http://localhost:5678/webhook/pulse-sheet-ops \
  -H "Content-Type: application/json" \
  -d '{
    "action": "GET_POST_BY_ID",
    "payload": { "postId": "POST_001" }
  }'
```

**UPDATE_PLATFORM_VARIANT** (most-used write action)
```bash
curl -X POST http://localhost:5678/webhook/pulse-sheet-ops \
  -H "Content-Type: application/json" \
  -d '{
    "action": "UPDATE_PLATFORM_VARIANT",
    "payload": {
      "postId": "POST_001",
      "platform": "twitter",
      "variant": {
        "text": "Test tweet content here",
        "hashtags": ["ai", "buildinpublic"],
        "status": "pending",
        "generatedAt": "2026-03-22T10:00:00.000Z"
      }
    }
  }'
```

**UPDATE_STATUS**
```bash
curl -X POST http://localhost:5678/webhook/pulse-sheet-ops \
  -H "Content-Type: application/json" \
  -d '{
    "action": "UPDATE_STATUS",
    "payload": {
      "postId": "POST_001",
      "platform": "twitter",
      "status": "published",
      "publishedAt": "2026-03-22T10:30:00.000Z"
    }
  }'
```

---

## Workflow 1 — Content Repurpose (`pulse-content-repurpose`)

Sends pre-built prompts per platform. The AI Agent generates text and writes results back via Workflow 0.

> For `callbackUrl`, use [webhook.site](https://webhook.site) if you don't have a local server running.

```bash
curl -X POST http://localhost:5678/webhook/pulse-content-repurpose \
  -H "Content-Type: application/json" \
  -d '{
    "postId": "POST_001",
    "callbackUrl": "https://webhook.site/YOUR_UNIQUE_ID",
    "contentPrompts": {
      "twitter": {
        "systemPrompt": "You are a social media expert. Write concise, engaging tweets under 280 characters.",
        "userPrompt": "Repurpose this content for Twitter: I just launched a new AI-powered content repurposing tool called Pulse. It takes your long-form content and adapts it for every social platform automatically.",
        "context": { "tone": "casual", "audience": "developers" }
      },
      "instagram": {
        "systemPrompt": "You are a social media expert. Write engaging Instagram captions with relevant hashtags.",
        "userPrompt": "Repurpose this content for Instagram: I just launched a new AI-powered content repurposing tool called Pulse. It takes your long-form content and adapts it for every social platform automatically.",
        "context": { "tone": "inspirational", "audience": "creators" }
      }
    }
  }'
```

Expected callback payload: `{ "postId": "POST_001", "status": "done" }`

---

## Workflow 2 — Image Repurpose (`pulse-image-repurpose`)

Sends image generation prompts per platform. The AI Agent generates images and writes URLs back via Workflow 0.

```bash
curl -X POST http://localhost:5678/webhook/pulse-image-repurpose \
  -H "Content-Type: application/json" \
  -d '{
    "postId": "POST_001",
    "callbackUrl": "https://webhook.site/YOUR_UNIQUE_ID",
    "imagePayloads": {
      "twitter": {
        "prompt": "A modern, clean dashboard UI showing social media analytics graphs, dark theme, professional",
        "negativePrompt": "text, watermark, blurry, low quality",
        "sourceImageUrl": null,
        "styleDirectives": {
          "aspectRatio": "16:9",
          "width": 1200,
          "height": 675,
          "mood": "professional",
          "colorTone": "dark"
        }
      },
      "instagram": {
        "prompt": "A vibrant, eye-catching social media tool interface with colorful data visualizations, square format",
        "negativePrompt": "text, watermark, blurry",
        "sourceImageUrl": null,
        "styleDirectives": {
          "aspectRatio": "1:1",
          "width": 1080,
          "height": 1080,
          "mood": "vibrant",
          "colorTone": "bright"
        }
      }
    }
  }'
```

Expected callback payload: `{ "postId": "POST_001", "status": "done" }`

---

## Workflow 3 — Publish (`pulse-publish`)

One request per platform. Test each platform branch independently.

**Twitter — text only**
```bash
curl -X POST http://localhost:5678/webhook/pulse-publish \
  -H "Content-Type: application/json" \
  -d '{
    "platform": "twitter",
    "postId": "POST_001",
    "sheetRowId": "2",
    "text": "Just launched Pulse — an AI tool that repurposes your content for every social platform automatically.",
    "hashtags": ["ai", "buildinpublic", "saas"],
    "imageUrl": null,
    "scheduledAt": null,
    "firstComment": "Check out the full thread below 👇",
    "callbackUrl": "https://webhook.site/YOUR_UNIQUE_ID"
  }'
```

**Threads — with image**
```bash
curl -X POST http://localhost:5678/webhook/pulse-publish \
  -H "Content-Type: application/json" \
  -d '{
    "platform": "threads",
    "postId": "POST_001",
    "sheetRowId": "2",
    "text": "Just launched Pulse — AI-powered content repurposing for every social platform.",
    "hashtags": ["ai", "creators"],
    "imageUrl": "https://picsum.photos/1080/1080",
    "scheduledAt": null,
    "firstComment": null,
    "callbackUrl": "https://webhook.site/YOUR_UNIQUE_ID"
  }'
```

**Instagram — with image (required)**
```bash
curl -X POST http://localhost:5678/webhook/pulse-publish \
  -H "Content-Type: application/json" \
  -d '{
    "platform": "instagram",
    "postId": "POST_001",
    "sheetRowId": "2",
    "text": "Launching Pulse today. AI repurposes your content for every platform in seconds.",
    "hashtags": ["ai", "contentcreator", "saas"],
    "imageUrl": "https://picsum.photos/1080/1080",
    "scheduledAt": null,
    "firstComment": null,
    "callbackUrl": "https://webhook.site/YOUR_UNIQUE_ID"
  }'
```

**Facebook — text only**
```bash
curl -X POST http://localhost:5678/webhook/pulse-publish \
  -H "Content-Type: application/json" \
  -d '{
    "platform": "facebook",
    "postId": "POST_001",
    "sheetRowId": "2",
    "text": "Excited to announce Pulse — AI-powered content repurposing that adapts your posts for every social platform automatically.",
    "hashtags": ["AI", "ContentMarketing"],
    "imageUrl": null,
    "scheduledAt": null,
    "firstComment": null,
    "callbackUrl": "https://webhook.site/YOUR_UNIQUE_ID"
  }'
```

**Skool — text only**
```bash
curl -X POST http://localhost:5678/webhook/pulse-publish \
  -H "Content-Type: application/json" \
  -d '{
    "platform": "skool",
    "postId": "POST_001",
    "sheetRowId": "2",
    "text": "Hey community! Just launched Pulse — AI that repurposes your content for every social platform. Would love your feedback.",
    "hashtags": [],
    "imageUrl": null,
    "scheduledAt": null,
    "firstComment": null,
    "callbackUrl": "https://webhook.site/YOUR_UNIQUE_ID"
  }'
```

Expected callback payload: `{ "postId": "POST_001", "platform": "twitter", "status": "published" }`

---

## Testing without live credentials

| Situation | Workaround |
|---|---|
| No OpenRouter / ImageRouter key | In n8n UI, open the AI Agent node → use **Pin Data** on the upstream Code node to feed dummy output directly into the parse step |
| No Google Sheet set up | Use **Pin Data** on Workflow 0's GSheets nodes to return dummy row data |
| No real callback server | Use [webhook.site](https://webhook.site) as `callbackUrl` — you'll see the callback payload arrive in your browser |
| No Twitter / Meta credentials | In n8n UI, click the publish node → **Execute Node** with test data, then inspect the error to confirm the request shape is correct |
| Test a single node in isolation | Click any node in the n8n canvas → **Execute Node** — manually enter JSON input without running the full workflow |

---

## n8n Variables required

Set these in **n8n Admin → Variables** before activating the workflows:

| Variable | Example value | Used by |
|---|---|---|
| `N8N_BASE_URL` | `http://localhost:5678` | Workflows 1, 2, 3 (Sheet Ops calls) |
| `THREADS_USER_ID` | `1234567890` | Workflow 3 — Threads branch |
| `INSTAGRAM_USER_ID` | `9876543210` | Workflow 3 — Instagram branch |
| `FACEBOOK_PAGE_ID` | `1122334455` | Workflow 3 — Facebook branch |
| `SKOOL_COMMUNITY_ID` | `my-community` | Workflow 3 — Skool branch |
