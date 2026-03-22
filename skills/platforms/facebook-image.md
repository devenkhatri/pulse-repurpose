# Skill: Facebook Image Prompt Factory

## Purpose
Generate the structured image prompt payload for repurposing a LinkedIn post image for Facebook.
This skill produces a fal.ai prompt + style directives + negative prompt.
n8n receives this payload and calls fal.ai directly.

## Inputs required
- `linkedinText`: string — source post text
- `sourceImageUrl`: string | null — original LinkedIn image URL
- `postId`: string
- `brandVoice`: BrandVoiceProfile — for visual tone alignment (includes `imageBrandKit`)
- `learnings`: string — image learnings from memory/learnings.md if any

## Platform image identity
- Platform: Facebook
- Dimensions: 1200 × 630 (roughly 16:9 landscape, slightly shorter)
- Aspect ratio: 16:9
- Optimal visual style: warm, community-oriented, inviting — human element preferred
- Text overlay: NEVER

## Prompt construction rules
1. Landscape format — 16:9 slightly wider crop
2. Inviting and warm — this is a community-first platform
3. Human element preferred when relevant — people, hands, collaborative scenes
4. Approachable over slick — feels personal, not advertising-grade
5. Avoid overly formal or corporate imagery

## Image Brand Kit injection

If `brandVoice.imageBrandKit` is provided, inject it into the prompt as follows:
- **primaryColor / secondaryColor**: Define the warm palette — e.g. "earthy palette of [primaryColor] and [secondaryColor]"
- **visualStyle**: Append as style adjectives — e.g. "warm documentary style"
- **photographyStyle**: Define shot type — e.g. "lifestyle community photography"
- **moodKeywords**: Blend into mood — e.g. "inviting, [moodKeywords]"
- **avoidInImages**: Append each item to the negative prompt

## Prompt template

```
A [visual concept] — [warm, inviting scene] — [community-friendly atmosphere from moodKeywords].
[Soft, natural lighting]. [Warm palette: primaryColor and secondaryColor if set]. [visualStyle + photographyStyle]. Approachable, photorealistic quality.
No text, no words, no captions, no overlays. 16:9 landscape Facebook composition.
```

## Style directives (always fixed for this platform)

```json
{
  "aspectRatio": "16:9",
  "width": 1200,
  "height": 630,
  "mood": "warm, inviting, community-oriented, approachable",
  "colorTone": "warm earthy tones, soft natural palette, no harsh contrasts",
  "composition": "landscape, human element when possible, inviting scene",
  "textOverlay": false
}
```

## Negative prompt template

```
text, words, letters, captions, watermarks, logos, blurry, low quality, distorted,
cold corporate imagery, aggressive advertising feel, harsh neon colors,
portrait orientation, generic handshake stock photo, oversaturated, pixelated[, <avoidInImages items from imageBrandKit if set>]
```

## Output contract

Return a JSON object matching ImagePromptOutput:

```json
{
  "platform": "facebook",
  "postId": "<postId>",
  "sourceImageUrl": "<sourceImageUrl or null>",
  "prompt": "<constructed fal.ai prompt>",
  "styleDirectives": {
    "aspectRatio": "16:9",
    "width": 1200,
    "height": 630,
    "mood": "warm, inviting, community-oriented, approachable",
    "colorTone": "<derived from post topic and brand tone>",
    "composition": "landscape, human element when possible, inviting scene",
    "textOverlay": false
  },
  "negativePrompt": "text, words, letters, captions, watermarks, logos, blurry, low quality, distorted, cold corporate imagery, aggressive advertising feel, harsh neon colors, portrait orientation, generic handshake stock photo, oversaturated, pixelated"
}
```
