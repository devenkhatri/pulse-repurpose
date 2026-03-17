# Skill: Threads Image Prompt Factory

## Purpose
Generate the structured image prompt payload for repurposing a LinkedIn post image for Threads.
This skill produces a fal.ai prompt + style directives + negative prompt.
n8n receives this payload and calls fal.ai directly.

## Inputs required
- `linkedinText`: string — source post text
- `sourceImageUrl`: string | null — original LinkedIn image URL
- `postId`: string
- `brandVoice`: BrandVoiceProfile — for visual tone alignment
- `learnings`: string — image learnings from memory/learnings.md if any

## Platform image identity
- Platform: Threads
- Dimensions: 1080 × 1080 (1:1 square)
- Aspect ratio: 1:1
- Optimal visual style: warm, casual, personal — feels like something a friend would share
- Text overlay: NEVER

## Prompt construction rules
1. Square format — center-weighted compositions work best
2. Personal, intimate framing — not corporate or magazine-style
3. Warm tones, natural light preferred
4. Something visually interesting but approachable — not overwhelming
5. Match the conversational tone of Threads content

## Prompt template

```
A [visual concept] — [intimate or natural scene] — [warm, personal atmosphere].
[Natural lighting]. [Warm or muted color palette]. Casual, authentic feel.
No text, no words, no captions, no overlays. Square 1:1 composition.
```

## Style directives (always fixed for this platform)

```json
{
  "aspectRatio": "1:1",
  "width": 1080,
  "height": 1080,
  "mood": "warm, casual, personal, approachable",
  "colorTone": "warm neutrals, natural tones, soft contrasts",
  "composition": "center-weighted, intimate framing, human element preferred",
  "textOverlay": false
}
```

## Negative prompt template

```
text, words, letters, captions, watermarks, logos, blurry, low quality, distorted,
corporate stock photo, formal business setting, harsh lighting, oversaturated,
cold clinical colors, pixelated, ugly, deformed
```

## Output contract

Return a JSON object matching ImagePromptOutput:

```json
{
  "platform": "threads",
  "postId": "<postId>",
  "sourceImageUrl": "<sourceImageUrl or null>",
  "prompt": "<constructed fal.ai prompt>",
  "styleDirectives": {
    "aspectRatio": "1:1",
    "width": 1080,
    "height": 1080,
    "mood": "warm, casual, personal, approachable",
    "colorTone": "<derived from post topic and brand tone>",
    "composition": "center-weighted, intimate framing, human element preferred",
    "textOverlay": false
  },
  "negativePrompt": "text, words, letters, captions, watermarks, logos, blurry, low quality, distorted, corporate stock photo, formal business setting, harsh lighting, oversaturated, cold clinical colors, pixelated"
}
```
