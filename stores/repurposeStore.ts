import { create } from "zustand"
import type { LinkedInPost, GenerationStatus, Platform, RepurposeVariantDraft } from "@/types"

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

  setActivePost: (post: LinkedInPost | null) => void
  setGenerationStatus: (status: GenerationStatus) => void
  setImageGenerationStatus: (status: GenerationStatus) => void
  setSelectedPlatforms: (platforms: Platform[]) => void
  initVariantsFromPost: (post: LinkedInPost) => void
  setVariantText: (platform: Platform, text: string) => void
  setVariantApproved: (platform: Platform, approved: boolean) => void
  setVariantHashtags: (platform: Platform, hashtags: string[]) => void
  addSuggestedHashtag: (platform: Platform, hashtag: string) => void
  clearSession: () => void
}

export const useRepurposeStore = create<RepurposeStore>((set) => ({
  activePost: null,
  generationStatus: "idle",
  imageGenerationStatus: "idle",
  selectedPlatforms: ALL_PLATFORMS,
  variants: {},

  setActivePost: (post) => set({ activePost: post }),
  setGenerationStatus: (status) => set({ generationStatus: status }),
  setImageGenerationStatus: (status) => set({ imageGenerationStatus: status }),
  setSelectedPlatforms: (platforms) => set({ selectedPlatforms: platforms }),

  initVariantsFromPost: (post: LinkedInPost) => {
    const variants: Partial<Record<Platform, RepurposeVariantDraft>> = {}
    for (const [platform, pv] of Object.entries(post.platforms)) {
      variants[platform as Platform] = {
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
    set({ variants })
  },

  setVariantText: (platform, text) =>
    set((state) => ({
      variants: {
        ...state.variants,
        [platform]: {
          ...(state.variants[platform] ?? emptyVariantDraft()),
          text,
          isEdited: true,
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

  clearSession: () =>
    set({
      activePost: null,
      generationStatus: "idle",
      imageGenerationStatus: "idle",
      variants: {},
      selectedPlatforms: ALL_PLATFORMS,
    }),
}))
