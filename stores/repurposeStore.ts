import { create } from "zustand"
import type { LinkedInPost, GenerationStatus } from "@/types"

interface RepurposeStore {
  activePost: LinkedInPost | null
  generationStatus: GenerationStatus
  imageGenerationStatus: GenerationStatus
  setActivePost: (post: LinkedInPost | null) => void
  setGenerationStatus: (status: GenerationStatus) => void
  setImageGenerationStatus: (status: GenerationStatus) => void
}

export const useRepurposeStore = create<RepurposeStore>((set) => ({
  activePost: null,
  generationStatus: "idle",
  imageGenerationStatus: "idle",
  setActivePost: (post) => set({ activePost: post }),
  setGenerationStatus: (status) => set({ generationStatus: status }),
  setImageGenerationStatus: (status) => set({ imageGenerationStatus: status }),
}))
