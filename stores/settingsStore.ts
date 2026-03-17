import { create } from "zustand"
import type { BrandVoiceProfile, HashtagBankEntry } from "@/types"

interface SettingsStore {
  brandVoice: BrandVoiceProfile | null
  hashtagBank: HashtagBankEntry[]
  loading: boolean
  error: string | null
  fetchBrandVoice: () => Promise<void>
  fetchHashtagBank: () => Promise<void>
  setBrandVoice: (profile: BrandVoiceProfile) => void
  setHashtagBank: (entries: HashtagBankEntry[]) => void
}

export const useSettingsStore = create<SettingsStore>((set) => ({
  brandVoice: null,
  hashtagBank: [],
  loading: false,
  error: null,

  fetchBrandVoice: async () => {
    set({ loading: true, error: null })
    try {
      const res = await fetch("/api/brand-voice")
      if (!res.ok) throw new Error("Failed to load brand voice")
      const { profile } = (await res.json()) as { profile: BrandVoiceProfile }
      set({ brandVoice: profile })
    } catch (err) {
      set({ error: err instanceof Error ? err.message : "Unknown error" })
    } finally {
      set({ loading: false })
    }
  },

  fetchHashtagBank: async () => {
    set({ loading: true, error: null })
    try {
      const res = await fetch("/api/hashtag-bank")
      if (!res.ok) throw new Error("Failed to load hashtag bank")
      const { entries } = (await res.json()) as { entries: HashtagBankEntry[] }
      set({ hashtagBank: entries })
    } catch (err) {
      set({ error: err instanceof Error ? err.message : "Unknown error" })
    } finally {
      set({ loading: false })
    }
  },

  setBrandVoice: (profile) => set({ brandVoice: profile }),
  setHashtagBank: (entries) => set({ hashtagBank: entries }),
}))
