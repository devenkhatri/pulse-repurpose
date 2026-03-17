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
Before generating any content, load and inject the following into the system prompt:
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
Construct the system prompt by concatenating:
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
- Include the full system prompt in the payload so n8n passes it directly to the LLM
- Set all platform statuses to "generating_text" via Sheet webhook

### Step 4 — Wait for callback + poll
- Poll GET_POST_BY_ID every 3 seconds
- Timeout after 5 minutes with error log

### Step 5 — Fire image repurpose webhook
- Call generateImagePrompts (OpenRouter direct) using learnings context
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
- LLM API error: retry once with simplified prompt (drop learnings context if too long)
- Image generation failure: log to daily memory, proceed without blocking text approval

## Success criteria
A repurpose run is successful when:
- All 5 platform text variants are written to the Sheet
- At least 3/5 image variants are generated
- MEMORY.md is updated
- Heartbeat.md reflects the new pipeline status
