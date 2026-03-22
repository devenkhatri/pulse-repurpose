# Skill: Skool Community Image Prompt Factory

## Purpose
Generate the structured image prompt payload for repurposing a LinkedIn post image for Skool Community.
This skill produces a fal.ai prompt + style directives + negative prompt.
n8n receives this payload and calls fal.ai directly.

## Inputs required
- `linkedinText`: string — source post text
- `sourceImageUrl`: string | null — original LinkedIn image URL
- `postId`: string
- `brandVoice`: BrandVoiceProfile — for visual tone alignment (includes `imageBrandKit`)
- `learnings`: string — image learnings from memory/learnings.md if any

## Platform image identity
- Platform: Skool Community
- Dimensions: 1200 × 675 (16:9 landscape)
- Aspect ratio: 16:9
- Optimal visual style: educational, clear, trustworthy — feels like a lesson or insight, not marketing
- Text overlay: NEVER

## Prompt construction rules
1. Landscape format — educational visual style
2. Clean, clear, diagram-like quality — communicates expertise and trust
3. Simple scenes that support a concept rather than distract from it
4. Trustworthy and calm — not exciting or clickbait-y
5. Works well as a discussion starter backdrop

## Image Brand Kit injection

If `brandVoice.imageBrandKit` is provided, inject it into the prompt as follows:
- **primaryColor / secondaryColor**: Anchor the muted palette — e.g. "neutral palette grounded in [primaryColor]"
- **visualStyle**: Append as style adjectives — e.g. "clean educational minimalist style"
- **photographyStyle**: Define shot type — e.g. "conceptual illustrative photography"
- **moodKeywords**: Blend into atmosphere — e.g. "calm, trustworthy, [moodKeywords]"
- **avoidInImages**: Append each item to the negative prompt

## Prompt template

```
A [educational visual concept related to post topic] — [clean, minimal scene] — [trustworthy, calm atmosphere from moodKeywords].
[Clear, even lighting]. [Neutral palette: primaryColor and secondaryColor if set]. [visualStyle + photographyStyle]. Clean educational quality, illustrative or photorealistic.
No text, no words, no captions, no overlays. 16:9 landscape Skool community composition.
```

## Style directives (always fixed for this platform)

```json
{
  "aspectRatio": "16:9",
  "width": 1200,
  "height": 675,
  "mood": "educational, clear, trustworthy, calm",
  "colorTone": "neutral tones, cool or warm muted palette, professional clarity",
  "composition": "clean landscape, simple focal point, diagram-like clarity",
  "textOverlay": false
}
```

## Negative prompt template

```
text, words, letters, captions, watermarks, logos, blurry, low quality, distorted,
marketing-style imagery, aggressive colors, busy backgrounds, sales-y feel,
portrait orientation, neon colors, dramatic lighting, oversaturated, pixelated[, <avoidInImages items from imageBrandKit if set>]
```

## Output contract

Return a JSON object matching ImagePromptOutput:

```json
{
  "platform": "skool",
  "postId": "<postId>",
  "sourceImageUrl": "<sourceImageUrl or null>",
  "prompt": "<constructed fal.ai prompt>",
  "styleDirectives": {
    "aspectRatio": "16:9",
    "width": 1200,
    "height": 675,
    "mood": "educational, clear, trustworthy, calm",
    "colorTone": "<derived from post topic and brand tone>",
    "composition": "clean landscape, simple focal point, diagram-like clarity",
    "textOverlay": false
  },
  "negativePrompt": "text, words, letters, captions, watermarks, logos, blurry, low quality, distorted, marketing-style imagery, aggressive colors, busy backgrounds, sales-y feel, portrait orientation, neon colors, dramatic lighting, oversaturated, pixelated"
}
```
