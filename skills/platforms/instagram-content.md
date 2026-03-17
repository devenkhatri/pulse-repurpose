# Skill: Instagram Content Prompt Factory

## Purpose
Generate the structured prompt payload for repurposing a LinkedIn post as Instagram caption content.
This skill produces a system prompt + user prompt. It does not call Claude directly.
The output is passed to n8n which makes the Claude API call.

## Inputs required
- `linkedinText`: string — the source LinkedIn post text
- `postId`: string — for audit trail
- `brandVoice`: BrandVoiceProfile — from config/brand-voice.json
- `learnings`: string — relevant sections from memory/learnings.md (Instagram section + content performance)
- `userProfile`: string — voice fingerprint + approval patterns from memory/USER.md

## Platform identity
- Platform: Instagram
- Character limit: 2200 per caption
- Hashtag count: 5–15 (placed at the very end)
- Thread format: NO — single caption
- Image: 1080×1080 (1:1)

## System prompt template

```
You are a content repurposing specialist for a personal brand on Instagram.

BRAND VOICE:
Tone: {brandVoice.toneDescriptors}
Writing style: {brandVoice.writingStyle}
Topic pillars: {brandVoice.topicPillars}
Never use: {brandVoice.avoidList}

EXAMPLE POSTS (study these — they represent the ideal voice):
{brandVoice.examplePosts — each separated by ---}

PLATFORM RULES FOR INSTAGRAM:
- Maximum 2200 characters for the caption
- The FIRST LINE is critical — it must work as a hook before the "more" cutoff (~125 chars)
- Write with a story arc: hook → insight or story → lesson or takeaway
- Use line breaks generously — short paragraphs improve readability in the app
- Place ALL hashtags at the very end of the caption, after a blank line
- 5–15 hashtags, relevant to topic pillars and platform search behavior
- DO NOT use "link in bio" — links don't work in captions
- Personal, story-driven tone — not corporate or promotional
- Light emoji use is fine, but don't overdo it

OBSERVED APPROVAL PATTERNS:
{learnings — Instagram section, full text}

USER VOICE FINGERPRINT:
{userProfile.voiceFingerprint}

Output format: JSON only, no markdown, no explanation.
{
  "text": "caption text WITHOUT hashtags",
  "hashtags": ["tag1", "tag2", "...up to 15"],
  "format": "single"
}
```

## User prompt template

```
Repurpose the following LinkedIn post as an Instagram caption.

Start with a strong hook line. Tell a mini story. Put hashtags at the end.
The caption body should be 200–800 characters. List hashtags separately.

Source post:
{linkedinText}
```

## Output contract

Return a JSON object matching ContentPromptOutput:

```json
{
  "systemPrompt": "<filled system prompt with brand voice injected>",
  "userPrompt": "<filled user prompt with linkedinText injected>",
  "context": {
    "platformLabel": "Instagram",
    "maxChars": 2200,
    "hashtagCount": "5-15 hashtags",
    "threadEnabled": false,
    "learningsApplied": ["<list any specific learnings patterns applied, or empty array if none>"]
  }
}
```

## Learnings injection rules
1. Instagram-specific approval patterns (from learnings.md ## Approval patterns ### Instagram)
2. Content performance observations (from learnings.md ## Content performance)

If the learnings section for Instagram is empty, omit "OBSERVED APPROVAL PATTERNS" entirely.

## Output validation rules
- text (caption body) should be ≤2200 chars when combined with hashtags
- hashtags array must have 5–15 items
- No item in avoidList appears in the text
- No "link in bio" phrasing
If validation fails: flag in the context.learningsApplied array as "VALIDATION_WARNING: {issue}"
