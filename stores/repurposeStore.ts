import { create } from "zustand"
import type { LinkedInPost, GenerationStatus, Platform, RepurposeVariantDraft, ChatMessage } from "@/types"

const ALL_PLATFORMS: Platform[] = ["twitter", "threads", "instagram", "facebook", "skool"]

function emptyVariantDraft(): RepurposeVariantDraft {
  return {
    text: "",
    imageUrl: null,
    imagePrompt: null,
    hashtags: [],
    suggestedHashtags: [],
    isApproved: false,
    isEdited: false,
  }
}

interface RepurposeStore {
  activePost: LinkedInPost | null
  generationStatus: GenerationStatus
  imageGenerationStatus: GenerationStatus
  selectedPlatforms: Platform[]
  variants: Partial<Record<Platform, RepurposeVariantDraft>>
  activePlatform: Platform | null
  chatHistory: Partial<Record<Platform, ChatMessage[]>>
  /** Platforms with unsaved local edits — polling skips re-init for these */
  dirtyPlatforms: Set<Platform>

  setActivePost: (post: LinkedInPost | null) => void
  setGenerationStatus: (status: GenerationStatus) => void
  setImageGenerationStatus: (status: GenerationStatus) => void
  setSelectedPlatforms: (platforms: Platform[]) => void
  initVariantsFromPost: (post: LinkedInPost) => void
  setVariantText: (platform: Platform, text: string) => void
  /** Update text from AI chat — does not set isEdited or mark platform dirty */
  setVariantTextFromAI: (platform: Platform, text: string) => void
  setVariantApproved: (platform: Platform, approved: boolean) => void
  setVariantHashtags: (platform: Platform, hashtags: string[]) => void
  addSuggestedHashtag: (platform: Platform, hashtag: string) => void
  markClean: (platform: Platform) => void
  setActivePlatform: (platform: Platform | null) => void
  addChatMessage: (platform: Platform, message: ChatMessage) => void
  clearChatHistory: (platform: Platform) => void
  setChatHistory: (platform: Platform, messages: ChatMessage[]) => void
  clearSession: () => void
}

export const useRepurposeStore = create<RepurposeStore>((set) => ({
  activePost: null,
  generationStatus: "idle",
  imageGenerationStatus: "idle",
  selectedPlatforms: ALL_PLATFORMS,
  variants: {},
  activePlatform: null,
  chatHistory: {},
  dirtyPlatforms: new Set<Platform>(),

  setActivePost: (post) => set({ activePost: post }),
  setGenerationStatus: (status) => set({ generationStatus: status }),
  setImageGenerationStatus: (status) => set({ imageGenerationStatus: status }),
  setSelectedPlatforms: (platforms) => set({ selectedPlatforms: platforms }),
  setActivePlatform: (platform) => set({ activePlatform: platform }),

  initVariantsFromPost: (post: LinkedInPost) => {
    set((state) => {
      const next: Partial<Record<Platform, RepurposeVariantDraft>> = {}
      for (const [platform, pv] of Object.entries(post.platforms)) {
        const p = platform as Platform
        // Skip platforms the user is actively editing — their local state wins
        if (state.dirtyPlatforms.has(p)) {
          next[p] = state.variants[p] ?? emptyVariantDraft()
          continue
        }
        next[p] = {
          text: pv.text ?? "",
          imageUrl: pv.imageUrl,
          imagePrompt: pv.imagePrompt,
          hashtags: pv.hashtags ?? [],
          suggestedHashtags: [],
          isApproved:
            pv.status === "approved" ||
            pv.status === "scheduled" ||
            pv.status === "published",
          isEdited: pv.isEdited,
        }
      }
      return { variants: next }
    })
  },

  setVariantText: (platform, text) =>
    set((state) => {
      const dirty = new Set(state.dirtyPlatforms)
      dirty.add(platform)
      return {
        dirtyPlatforms: dirty,
        variants: {
          ...state.variants,
          [platform]: {
            ...(state.variants[platform] ?? emptyVariantDraft()),
            text,
            isEdited: true,
          },
        },
      }
    }),

  setVariantTextFromAI: (platform, text) =>
    set((state) => ({
      variants: {
        ...state.variants,
        [platform]: {
          ...(state.variants[platform] ?? emptyVariantDraft()),
          text,
          // isEdited stays unchanged — AI edits don't count as manual user edits
        },
      },
    })),

  setVariantApproved: (platform, approved) =>
    set((state) => ({
      variants: {
        ...state.variants,
        [platform]: {
          ...(state.variants[platform] ?? emptyVariantDraft()),
          isApproved: approved,
        },
      },
    })),

  setVariantHashtags: (platform, hashtags) =>
    set((state) => ({
      variants: {
        ...state.variants,
        [platform]: {
          ...(state.variants[platform] ?? emptyVariantDraft()),
          hashtags,
        },
      },
    })),

  markClean: (platform) =>
    set((state) => {
      const dirty = new Set(state.dirtyPlatforms)
      dirty.delete(platform)
      return { dirtyPlatforms: dirty }
    }),

  addSuggestedHashtag: (platform, hashtag) =>
    set((state) => {
      const current = state.variants[platform] ?? emptyVariantDraft()
      if (current.hashtags.includes(hashtag)) return state
      return {
        variants: {
          ...state.variants,
          [platform]: {
            ...current,
            hashtags: [...current.hashtags, hashtag],
            suggestedHashtags: current.suggestedHashtags.filter((h) => h !== hashtag),
          },
        },
      }
    }),

  addChatMessage: (platform, message) =>
    set((state) => ({
      chatHistory: {
        ...state.chatHistory,
        [platform]: [...(state.chatHistory[platform] ?? []), message],
      },
    })),

  clearChatHistory: (platform) =>
    set((state) => ({
      chatHistory: {
        ...state.chatHistory,
        [platform]: [],
      },
    })),

  setChatHistory: (platform, messages) =>
    set((state) => ({
      chatHistory: {
        ...state.chatHistory,
        [platform]: messages,
      },
    })),

  clearSession: () =>
    set({
      activePost: null,
      generationStatus: "idle",
      imageGenerationStatus: "idle",
      variants: {},
      selectedPlatforms: ALL_PLATFORMS,
      activePlatform: null,
      chatHistory: {},
      dirtyPlatforms: new Set<Platform>(),
    }),
}))
