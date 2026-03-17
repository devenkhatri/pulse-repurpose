# Skill: Twitter/X Image Prompt Factory

## Purpose
Generate the structured image prompt payload for repurposing a LinkedIn post image for Twitter/X.
This skill produces a fal.ai prompt + style directives + negative prompt.
n8n receives this payload and calls fal.ai directly.

## Inputs required
- `linkedinText`: string — source post text (used to understand visual subject matter)
- `sourceImageUrl`: string | null — original LinkedIn image URL
- `postId`: string
- `brandVoice`: BrandVoiceProfile — for visual tone alignment
- `learnings`: string — visual/image learnings from memory/learnings.md if any

## Platform image identity
- Platform: Twitter / X
- Dimensions: 1200 × 675 (16:9 landscape)
- Aspect ratio: 16:9
- Optimal visual style: clean, bold, designed to stop scroll in a fast-moving feed
- Text overlay: NEVER — no text, words, or captions in the image

## Prompt construction rules
The image prompt must:
1. Capture the core visual concept of the LinkedIn post in one scene
2. Be optimized for 16:9 landscape — horizontal compositions, nothing portrait-oriented
3. Feel professional but not corporate — real, not stock-photo
4. Have strong visual contrast for small-screen legibility
5. Align with brand tone descriptors (if tone is "direct, no-fluff" — image should be minimal, not cluttered)

## Prompt template

```
A [visual concept derived from post topic] — [composition style] — [mood/atmosphere].
[Lighting description]. [Color palette]. Professional quality, photorealistic/illustrated (choose based on post topic).
No text, no words, no captions, no overlays. 16:9 landscape composition. [Any brand-specific visual notes from brandVoice].
```

## Style directives (always fixed for this platform)

```json
{
  "aspectRatio": "16:9",
  "width": 1200,
  "height": 675,
  "mood": "bold, clean, high contrast, scroll-stopping",
  "colorTone": "strong contrast, vivid but not garish, aligned with post emotional tone",
  "composition": "landscape-first, strong focal point, generous negative space",
  "textOverlay": false
}
```

## Negative prompt template

```
text, words, letters, captions, watermarks, logos, blurry, low quality, distorted,
portrait orientation, stock photo clichés (handshake, lightbulb, magnifying glass),
oversaturated, pixelated, ugly, deformed
```

## Output contract

Return a JSON object matching ImagePromptOutput:

```json
{
  "platform": "twitter",
  "postId": "<postId>",
  "sourceImageUrl": "<sourceImageUrl or null>",
  "prompt": "<constructed fal.ai prompt>",
  "styleDirectives": {
    "aspectRatio": "16:9",
    "width": 1200,
    "height": 675,
    "mood": "bold, clean, high contrast, scroll-stopping",
    "colorTone": "<derived from post topic and brand tone>",
    "composition": "landscape-first, strong focal point, generous negative space",
    "textOverlay": false
  },
  "negativePrompt": "text, words, letters, captions, watermarks, logos, blurry, low quality, distorted, portrait orientation, handshake, lightbulb, magnifying glass, oversaturated, pixelated"
}
```
