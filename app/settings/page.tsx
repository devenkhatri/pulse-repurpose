"use client"

import { useEffect } from "react"
import { TopBar } from "@/components/layout/TopBar"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { BrandVoiceForm } from "@/components/settings/BrandVoiceForm"
import { HashtagBankManager } from "@/components/settings/HashtagBankManager"
import { LoadingSpinner } from "@/components/shared/LoadingSpinner"
import { useSettingsStore } from "@/stores/settingsStore"
import type { BrandVoiceProfile, HashtagBankEntry } from "@/types"

export default function SettingsPage() {
  const {
    brandVoice,
    hashtagBank,
    loading,
    error,
    fetchBrandVoice,
    fetchHashtagBank,
    setBrandVoice,
    setHashtagBank,
  } = useSettingsStore()

  useEffect(() => {
    fetchBrandVoice()
    fetchHashtagBank()
  }, [fetchBrandVoice, fetchHashtagBank])

  return (
    <div className="flex flex-col h-full">
      <TopBar title="Settings" />

      <div className="flex-1 overflow-y-auto p-6">
        {loading && !brandVoice && (
          <div className="flex items-center justify-center h-48">
            <LoadingSpinner size="md" />
          </div>
        )}

        {error && !brandVoice && (
          <div className="rounded-lg border border-red-500/20 bg-red-500/10 p-4 text-red-400 text-sm max-w-md">
            Failed to load settings: {error}
          </div>
        )}

        {brandVoice && (
          <Tabs defaultValue="brand-voice" className="space-y-6">
            <TabsList className="bg-[#161616] border border-white/10 h-9">
              <TabsTrigger
                value="brand-voice"
                className="text-xs data-[state=active]:bg-[#7C3AED]/20 data-[state=active]:text-white"
              >
                Brand Voice
              </TabsTrigger>
              <TabsTrigger
                value="hashtag-bank"
                className="text-xs data-[state=active]:bg-[#7C3AED]/20 data-[state=active]:text-white"
              >
                Hashtag Bank
                {hashtagBank.length > 0 && (
                  <span className="ml-1.5 px-1.5 py-0.5 rounded-full bg-white/10 text-white/50 text-[10px]">
                    {hashtagBank.length}
                  </span>
                )}
              </TabsTrigger>
            </TabsList>

            <TabsContent value="brand-voice">
              <BrandVoiceForm
                initialProfile={brandVoice}
                onSaved={(saved: BrandVoiceProfile) => setBrandVoice(saved)}
              />
            </TabsContent>

            <TabsContent value="hashtag-bank">
              <HashtagBankManager
                entries={hashtagBank}
                topicPillars={brandVoice.topicPillars}
                onEntriesChange={(entries: HashtagBankEntry[]) =>
                  setHashtagBank(entries)
                }
              />
            </TabsContent>
          </Tabs>
        )}
      </div>
    </div>
  )
}
