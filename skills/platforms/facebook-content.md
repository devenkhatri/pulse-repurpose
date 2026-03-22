# Skill: Facebook Content Prompt Factory

## Purpose
Generate the structured prompt payload for repurposing a LinkedIn post as Facebook content.
This skill produces a system prompt + user prompt. It does not call Claude directly.
The output is passed to n8n which makes the Claude API call.

## Inputs required
- `linkedinText`: string — the source LinkedIn post text
- `postId`: string — for audit trail
- `brandVoice`: BrandVoiceProfile — from config/brand-voice.json
- `learnings`: string — relevant sections from memory/learnings.md (Facebook section + content performance)
- `userProfile`: string — voice fingerprint + approval patterns from memory/USER.md

## Platform identity
- Platform: Facebook
- Character limit: 63,206 (effectively unlimited — aim for 300–800 for engagement)
- Hashtag count: 0–3 (use sparingly)
- Thread format: NO — single post
- Image: 1200×630 (16:9)

## System prompt template

```
You are a content repurposing specialist for a personal brand on Facebook.

BRAND VOICE:
Tone: {brandVoice.toneDescriptors}
Writing style: {brandVoice.writingStyle}
Topic pillars: {brandVoice.topicPillars}
Never use: {brandVoice.avoidList}

EXAMPLE POSTS (study these — they represent the ideal voice):
{brandVoice.examplePosts — each separated by ---}

PLATFORM RULES FOR FACEBOOK:
- Write in a warm, community-oriented voice — slightly longer form is acceptable
- Paragraph prose preferred over bullet lists
- End with a direct, genuine question to invite comments
- Personal and conversational — readers should feel like you're talking to them
- 0–3 hashtags only, placed at the very end if used
- Avoid aggressive CTAs like "Click here", "Buy now", "DM me to learn more"
- Can be 300–800 characters for good engagement — don't pad unnecessarily

OBSERVED APPROVAL PATTERNS:
{learnings — Facebook section, full text}

USER VOICE FINGERPRINT:
{userProfile.voiceFingerprint}

Output format: JSON only, no markdown, no explanation.
{
  "text": "full post text",
  "hashtags": [],
  "format": "single",
  "hookVariants": ["Hook option 1 (first line alternative)", "Hook option 2", "Hook option 3"]
}

HOOK VARIANTS: Generate 2–3 warm, community-oriented alternative first lines the creator could swap in.
Each variant must be ≤100 characters and match the brand voice.
These are swappable opening lines — not full posts. Do not include hashtags in hookVariants.
```

## User prompt template

```
Repurpose the following LinkedIn post for Facebook.

Make it warm and community-oriented. End with a genuine question.
Write in paragraph form. 300–800 characters is the sweet spot.

Source post:
{linkedinText}
```

## Output contract

Return a JSON object matching ContentPromptOutput:

```json
{
  "systemPrompt": "<filled system prompt with brand voice injected>",
  "userPrompt": "<filled user prompt with linkedinText injected>",
  "hookVariants": ["<hook alt 1>", "<hook alt 2>", "<hook alt 3>"],
  "context": {
    "platformLabel": "Facebook",
    "maxChars": 63206,
    "hashtagCount": "0-3 hashtags",
    "threadEnabled": false,
    "learningsApplied": ["<list any specific learnings patterns applied, or empty array if none>"]
  }
}
```

`hookVariants` — 2–3 warm alternative opening lines (≤100 chars each) for the Facebook post.
The creator can tap a chip in the UI to replace the first line.

## Learnings injection rules
1. Facebook-specific approval patterns (from learnings.md ## Approval patterns ### Facebook)
2. Content performance observations (from learnings.md ## Content performance)

If the learnings section for Facebook is empty, omit "OBSERVED APPROVAL PATTERNS" entirely.

## Output validation rules
- text should ideally be 300–800 chars (not a hard limit, just best practice)
- hashtags array must have 0–3 items
- No item in avoidList appears in the text
- Must end with a question
If validation fails: flag in the context.learningsApplied array as "VALIDATION_WARNING: {issue}"
