# Skill: Instagram Image Prompt Factory

## Purpose
Generate the structured image prompt payload for repurposing a LinkedIn post image for Instagram.
This skill produces a fal.ai prompt + style directives + negative prompt.
n8n receives this payload and calls fal.ai directly.

## Inputs required
- `linkedinText`: string — source post text
- `sourceImageUrl`: string | null — original LinkedIn image URL
- `postId`: string
- `brandVoice`: BrandVoiceProfile — for visual tone alignment
- `learnings`: string — image learnings from memory/learnings.md if any

## Platform image identity
- Platform: Instagram
- Dimensions: 1080 × 1080 (1:1 square)
- Aspect ratio: 1:1
- Optimal visual style: polished, aesthetic, thumb-stopping — grid-aware
- Text overlay: NEVER

## Prompt construction rules
1. Square format — think grid-awareness, the image must look good in an Instagram grid
2. Polished and aesthetic — higher production quality than Threads
3. Color consistency matters — warm tones or brand-aligned palette
4. Something visually compelling that makes someone stop scrolling
5. Avoid generic stock look — should feel authored and deliberate

## Prompt template

```
A [visual concept] — [aesthetic composition] — [polished, styled atmosphere].
[Deliberate lighting]. [Cohesive color palette]. Photographic quality, intentional aesthetic.
No text, no words, no captions, no overlays. Square 1:1 Instagram composition.
```

## Style directives (always fixed for this platform)

```json
{
  "aspectRatio": "1:1",
  "width": 1080,
  "height": 1080,
  "mood": "polished, aesthetic, thumb-stopping, intentional",
  "colorTone": "cohesive warm palette, brand-aligned, no harsh contrasts",
  "composition": "grid-aware square, strong visual anchor, balanced negative space",
  "textOverlay": false
}
```

## Negative prompt template

```
text, words, letters, captions, watermarks, logos, blurry, low quality, distorted,
generic stock photo, busy cluttered backgrounds, harsh colors, neon colors,
portrait orientation, inconsistent lighting, pixelated, ugly, deformed
```

## Output contract

Return a JSON object matching ImagePromptOutput:

```json
{
  "platform": "instagram",
  "postId": "<postId>",
  "sourceImageUrl": "<sourceImageUrl or null>",
  "prompt": "<constructed fal.ai prompt>",
  "styleDirectives": {
    "aspectRatio": "1:1",
    "width": 1080,
    "height": 1080,
    "mood": "polished, aesthetic, thumb-stopping, intentional",
    "colorTone": "<derived from post topic and brand tone>",
    "composition": "grid-aware square, strong visual anchor, balanced negative space",
    "textOverlay": false
  },
  "negativePrompt": "text, words, letters, captions, watermarks, logos, blurry, low quality, distorted, generic stock photo, busy cluttered backgrounds, harsh colors, neon colors, portrait orientation, inconsistent lighting, pixelated"
}
```
