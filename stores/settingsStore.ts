import { create } from "zustand"
import type { BrandVoiceProfile, HashtagBankEntry } from "@/types"

interface SettingsStore {
  brandVoice: BrandVoiceProfile | null
  hashtagBank: HashtagBankEntry[]
  loading: boolean
  error: string | null
  fetchBrandVoice: () => Promise<void>
  fetchHashtagBank: () => Promise<void>
}

export const useSettingsStore = create<SettingsStore>((set) => ({
  brandVoice: null,
  hashtagBank: [],
  loading: false,
  error: null,
  fetchBrandVoice: async () => {
    // Stub — implemented in Session 3
  },
  fetchHashtagBank: async () => {
    // Stub — implemented in Session 3
  },
}))
