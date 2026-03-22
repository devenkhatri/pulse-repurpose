export type Platform = 'twitter' | 'threads' | 'instagram' | 'facebook' | 'skool' | 'linkedin'

export type PostStatus = 'pending' | 'approved' | 'scheduled' | 'published' | 'failed'

export type GenerationStatus = 'idle' | 'generating_text' | 'generating_images' | 'done' | 'failed'

export interface LinkedInPost {
  id: string                        // Unique row ID from Sheet (row number as string)
  linkedinText: string              // Original LinkedIn post text
  linkedinImageUrl: string | null   // Original image URL if available
  postedAt: string                  // ISO date string
  platforms: Record<Platform, PlatformVariant>
}

export interface PlatformVariant {
  text: string | null
  contentPrompt: string | null      // JSON string of { systemPrompt, userPrompt } from content skill
  imagePrompt: string | null        // fal.ai prompt string from image skill
  imageUrl: string | null
  hashtags: string[]
  status: PostStatus
  generatedAt: string | null        // ISO date string
  scheduledAt: string | null        // ISO date string
  publishedAt: string | null        // ISO date string
  approvedAt: string | null         // ISO date string
  isEdited: boolean
  error: string | null
  // Analytics fields — written by n8n Workflow 4
  platformPostId: string | null     // Native post ID on the platform
  impressions: number | null
  likes: number | null
  comments: number | null
  shares: number | null
  engagementRate: number | null     // (likes+comments+shares) / impressions * 100
  fetchedAt: string | null          // ISO date string — when analytics were last fetched
  // First comment fields — Session 13
  firstComment: string | null       // Comment to post ~30s after publish
  firstCommentStatus: string | null // 'pending' | 'published' | 'failed' | null
}

export interface BrandVoiceProfile {
  toneDescriptors: string[]         // e.g. ["direct", "practical", "no fluff"]
  writingStyle: string              // Free text paragraph describing writing style
  topicPillars: string[]            // e.g. ["solopreneurship", "AI tools", "productivity"]
  avoidList: string[]               // Words, phrases, or patterns to never use
  examplePosts: string[]            // 3–5 raw LinkedIn post texts the user loves
  lastUpdated: string               // ISO date string
}

export interface HashtagBankEntry {
  id: string
  hashtag: string                   // Without # prefix
  platforms: Platform[]             // Which platforms this is relevant for
  topicPillar: string | null        // Which pillar it belongs to
  usageCount: number
  lastUsed: string | null
}

export interface RepurposeSession {
  sourcePost: LinkedInPost
  variants: Record<Platform, RepurposeVariantDraft>
  activeChat: ChatMessage[]
  activePlatform: Platform | null
  generationStatus: GenerationStatus
  imageGenerationStatus: GenerationStatus
}

export interface RepurposeVariantDraft {
  text: string
  imageUrl: string | null
  imagePrompt: string | null        // The prompt n8n will use to generate the image
  hashtags: string[]
  suggestedHashtags: string[]       // From AI, not yet added
  isApproved: boolean
  isEdited: boolean                 // True if user manually edited the AI output
}

export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
  timestamp: string
}

export interface ContentPromptOutput {
  systemPrompt: string
  userPrompt: string
  context: {
    platformLabel: string
    maxChars: number
    hashtagCount: string        // e.g. "1-3 hashtags"
    threadEnabled: boolean
    learningsApplied: string[]
  }
}

export interface ImagePromptOutput {
  prompt: string
  sourceImageUrl: string | null
  styleDirectives: {
    aspectRatio: string
    width: number
    height: number
    mood: string
    colorTone: string
    composition: string
    textOverlay: false
  }
  negativePrompt: string
}

// Webhook 1: App → n8n content repurpose workflow
// Skills pre-build all prompts; n8n receives ready-to-use per-platform prompt pairs.
export interface ContentRepurposeWebhookPayload {
  postId: string
  contentPrompts: Partial<Record<Platform, {
    systemPrompt: string
    userPrompt: string
    context: {
      platformLabel: string
      maxChars: number
      hashtagCount: string
      threadEnabled: boolean
      learningsApplied: string[]
    }
  }>>
  callbackUrl: string               // App's /api/callback/repurpose endpoint
}

// Webhook 2: App → n8n image repurpose workflow
export interface ImageRepurposeWebhookPayload {
  postId: string
  imagePayloads: Partial<Record<Platform, ImagePromptOutput>>  // Full per-platform image prompt objects
  callbackUrl: string               // App's /api/callback/images endpoint
}

// Webhook 3: App → n8n publish workflow
export interface PublishWebhookPayload {
  platform: Platform
  text: string
  imageUrl: string | null
  hashtags: string[]
  scheduledAt: string | null
  sheetRowId: string
  postId: string
  callbackUrl: string               // App's /api/callback/publish endpoint
  firstComment: string | null       // Optional first comment to post after publish
}

// n8n → App callback (after content or image generation is done)
export interface N8nCallbackPayload {
  postId: string
  status: 'done' | 'failed'
  error?: string
}

export interface CalendarEvent {
  id: string
  postId: string
  platform: Platform
  title: string                     // First 60 chars of text
  start: Date
  status: PostStatus
  color: string                     // Platform color hex
}

export interface GapWarning {
  platform: Platform
  lastPostDate: string
  daysGap: number
  pillarGap: string | null          // e.g. "No AI tools content in 10 days"
}

// Sheet webhook types
export type SheetAction =
  | 'GET_ALL_POSTS'
  | 'GET_POST_BY_ID'
  | 'UPDATE_PLATFORM_VARIANT'
  | 'UPDATE_MULTIPLE_PLATFORMS'
  | 'WRITE_CONTENT_PROMPTS'
  | 'WRITE_IMAGE_PROMPTS'
  | 'UPDATE_STATUS'
  | 'UPDATE_ANALYTICS'
  | 'UPDATE_FIRST_COMMENT'

export interface SheetWebhookRequest<A extends SheetAction = SheetAction> {
  action: A
  payload: SheetActionPayload[A]
}

export interface SheetActionPayload {
  GET_ALL_POSTS: {
    statusFilter?: PostStatus
    platformFilter?: Platform
    fromDate?: string
    toDate?: string
  }
  GET_POST_BY_ID: {
    postId: string
  }
  UPDATE_PLATFORM_VARIANT: {
    postId: string
    platform: Platform
    variant: Partial<PlatformVariant>
  }
  UPDATE_MULTIPLE_PLATFORMS: {
    postId: string
    variants: Partial<Record<Platform, Partial<PlatformVariant>>>
  }
  WRITE_CONTENT_PROMPTS: {
    postId: string
    prompts: Partial<Record<Platform, string>>
  }
  WRITE_IMAGE_PROMPTS: {
    postId: string
    prompts: Partial<Record<Platform, string>>
  }
  UPDATE_STATUS: {
    postId: string
    platform: Platform
    status: PostStatus
  }
  UPDATE_ANALYTICS: {
    postId: string
    platform: Platform
    metrics: {
      impressions: number
      likes: number
      comments: number
      shares: number
      engagementRate: number
      fetchedAt: string
    }
  }
  UPDATE_FIRST_COMMENT: {
    postId: string
    platform: Platform
    firstComment: string | null
    firstCommentStatus?: string | null
  }
}

// Note: PlatformRule is defined and exported from lib/platform-rules.ts
