# Skill: LinkedIn Carousel Content Factory

## Purpose
Generate a structured slide deck from a LinkedIn post for use as a LinkedIn document/carousel.
This skill produces a `CarouselPromptOutput` — the full slide content ready for export.
It does not call Claude directly and is not passed to n8n.
The output is returned directly to the app via `POST /api/skills/carousel`.

## Inputs required
- `linkedinText`: string — the source LinkedIn post text
- `postId`: string — for audit trail
- `brandVoice`: BrandVoiceProfile — from config/brand-voice.json
- `learnings`: string — relevant sections from memory/learnings.md
- `userProfile`: string — voice fingerprint from memory/USER.md

## Platform identity
- Platform: LinkedIn Carousel (Document Post)
- Slide count: 5–10 content slides + 1 cover + 1 closing = 7–12 slides total
- Cover slide: Bold visual headline + short subheadline
- Content slides: Each has a punchy headline + 1–3 sentence body
- Closing slide: CTA headline + specific action for reader
- Caption: LinkedIn post text to accompany the carousel upload (≤3000 chars)
- Hashtags: 3–5 (placed at the end of caption)

## System prompt template

```
You are a LinkedIn carousel content specialist for a personal brand.

BRAND VOICE:
Tone: {brandVoice.toneDescriptors}
Writing style: {brandVoice.writingStyle}
Topic pillars: {brandVoice.topicPillars}
Never use: {brandVoice.avoidList}

EXAMPLE POSTS (study the voice — carousels should feel like this creator):
{brandVoice.examplePosts — each separated by ---}

LINKEDIN CAROUSEL RULES:
- Carousels get 3x more reach than regular posts on LinkedIn — treat the hook slide like a headline ad
- Cover slide: Bold, single-idea headline (≤8 words). Subheadline frames the value (≤15 words)
- Content slides: Each slide = one idea. Headline is the insight (≤8 words). Body expands in 1–3 sentences
- Slide flow: Problem → Insight → Evidence → Framework → Action
- Closing slide: Punchy CTA headline + specific, low-friction next step
- Caption: Short intro to the carousel, written to stop the scroll. End with 3–5 hashtags
- NO bullet points on slides — prose only (one idea, fully expressed)
- NO "swipe →" prompts — LinkedIn audiences know carousels now
- Each slide must be self-contained — readable without context from other slides

OBSERVED APPROVAL PATTERNS:
{learnings — LinkedIn section and content performance section, full text}

USER VOICE FINGERPRINT:
{userProfile.voiceFingerprint}

Your goal: generate a carousel that turns the LinkedIn post into a visually structured,
high-reach document post. Optimize for saves and shares — carousel content that teaches
or reveals a framework performs best.

Output format: JSON only, no markdown, no explanation.
{
  "coverSlide": {
    "headline": "Bold 1–8 word hook headline",
    "subheadline": "Framing sentence — what the reader will learn (≤15 words)"
  },
  "slides": [
    {
      "headline": "Slide headline — the single insight (≤8 words)",
      "body": "1–3 sentences expanding the insight. Concrete, specific, no padding."
    }
  ],
  "closingSlide": {
    "headline": "Action-oriented closing headline (≤8 words)",
    "cta": "Specific low-friction action for the reader to take (1 sentence)"
  },
  "caption": "LinkedIn caption to accompany the carousel. Hook first. 200–500 chars before hashtags.",
  "hashtags": ["hashtag1", "hashtag2", "hashtag3"]
}
```

## User prompt template

```
Turn the following LinkedIn post into a LinkedIn carousel (document post).

Extract the core framework, steps, or insights from the post and turn them into slides.
5–8 content slides is the sweet spot — not too short to feel thin, not too long to lose readers.

Source post:
{linkedinText}

Produce a CarouselPromptOutput JSON object as specified.
```

## Output contract

Return a JSON object matching CarouselPromptOutput:

```json
{
  "coverSlide": {
    "headline": "<bold hook headline ≤8 words>",
    "subheadline": "<value-framing sentence ≤15 words>"
  },
  "slides": [
    {
      "headline": "<slide insight headline ≤8 words>",
      "body": "<1–3 sentence expansion, specific and concrete>"
    }
  ],
  "closingSlide": {
    "headline": "<action-oriented closing headline ≤8 words>",
    "cta": "<specific low-friction next step for reader>"
  },
  "caption": "<LinkedIn caption to accompany upload, 200–500 chars before hashtags>",
  "hashtags": ["<tag1>", "<tag2>", "<tag3>"]
}
```

## Learnings injection rules
1. LinkedIn-specific approval patterns (from learnings.md ## Approval patterns ### LinkedIn)
2. Content performance observations (from learnings.md ## Content performance)
3. Platform-specific tone adjustments for LinkedIn

If the learnings section for LinkedIn is empty, omit "OBSERVED APPROVAL PATTERNS" entirely.

## Output validation rules
- slides array must have 5–8 items
- Each slide headline must be ≤8 words
- caption must be ≤3000 chars when combined with hashtag strings
- hashtags array must have 3–5 items
- No item in avoidList appears in any field
If validation fails: generate the best output possible and note the issue in a comment
(do NOT refuse — always return valid JSON)
