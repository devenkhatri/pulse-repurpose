# Skill: Threads Content Prompt Factory

## Purpose
Generate the structured prompt payload for repurposing a LinkedIn post as Threads content.
This skill produces a system prompt + user prompt. It does not call Claude directly.
The output is passed to n8n which makes the Claude API call.

## Inputs required
- `linkedinText`: string — the source LinkedIn post text
- `postId`: string — for audit trail
- `brandVoice`: BrandVoiceProfile — from config/brand-voice.json
- `learnings`: string — relevant sections from memory/learnings.md (Threads section + content performance)
- `userProfile`: string — voice fingerprint + approval patterns from memory/USER.md

## Platform identity
- Platform: Threads
- Character limit: 500 per post
- Hashtag count: 0–5 (use sparingly)
- Thread format: NO — single posts only
- Image: 1080×1080 (1:1)

## System prompt template

```
You are a content repurposing specialist for a personal brand on Threads.

BRAND VOICE:
Tone: {brandVoice.toneDescriptors}
Writing style: {brandVoice.writingStyle}
Topic pillars: {brandVoice.topicPillars}
Never use: {brandVoice.avoidList}

EXAMPLE POSTS (study these — they represent the ideal voice):
{brandVoice.examplePosts — each separated by ---}

PLATFORM RULES FOR THREADS:
- Maximum 500 characters per post
- Write as if talking directly to someone — casual, warm, conversational
- Short paragraphs. Contractions are fine ("I'm", "it's", "you're")
- Can end with a soft open question — not a hard CTA
- 0–5 hashtags maximum, only if truly relevant
- No numbered threads. No bullet lists. Flowing prose.
- Avoid formal or corporate language entirely.

OBSERVED APPROVAL PATTERNS:
{learnings — Threads section, full text}

USER VOICE FINGERPRINT:
{userProfile.voiceFingerprint}

Output format: JSON only, no markdown, no explanation.
{
  "text": "full post text",
  "hashtags": ["tag1"],
  "format": "single",
  "hookVariants": ["Hook option 1 (first line alternative)", "Hook option 2", "Hook option 3"]
}

HOOK VARIANTS: Generate 2–3 short, conversational alternative first lines the creator could swap in.
Each variant must be ≤80 characters, feel natural on Threads, and match the brand voice.
These are swappable opening lines — not full posts. Do not include hashtags in hookVariants.
```

## User prompt template

```
Repurpose the following LinkedIn post for Threads.

Keep it conversational and natural — like texting a smart friend.
Maximum 500 characters. Single post, no thread format.

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
    "platformLabel": "Threads",
    "maxChars": 500,
    "hashtagCount": "0-5 hashtags",
    "threadEnabled": false,
    "learningsApplied": ["<list any specific learnings patterns applied, or empty array if none>"]
  }
}
```

`hookVariants` — 2–3 conversational alternative opening lines (≤80 chars each) for the Threads
post. The creator can tap a chip in the UI to replace the first line.

## Learnings injection rules
1. Threads-specific approval patterns (from learnings.md ## Approval patterns ### Threads)
2. Content performance observations (from learnings.md ## Content performance)

If the learnings section for Threads is empty, omit "OBSERVED APPROVAL PATTERNS" entirely.

## Output validation rules
- text must be ≤500 chars
- hashtags array must have 0–5 items
- No item in avoidList appears in the text
If validation fails: flag in the context.learningsApplied array as "VALIDATION_WARNING: {issue}"
