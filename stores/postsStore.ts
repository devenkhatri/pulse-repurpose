import { create } from "zustand"
import type { LinkedInPost, Platform, PostStatus } from "@/types"

interface PostsStore {
  posts: LinkedInPost[]
  loading: boolean
  error: string | null
  fetchPosts: (filters?: {
    status?: PostStatus
    platform?: Platform
    from?: string
    to?: string
  }) => Promise<void>
  updateVariantStatus: (postId: string, platform: Platform, status: PostStatus) => void
}

export const usePostsStore = create<PostsStore>((set, get) => ({
  posts: [],
  loading: false,
  error: null,

  fetchPosts: async (filters) => {
    set({ loading: true, error: null })
    try {
      const params = new URLSearchParams()
      if (filters?.status) params.set("status", filters.status)
      if (filters?.platform) params.set("platform", filters.platform)
      if (filters?.from) params.set("from", filters.from)
      if (filters?.to) params.set("to", filters.to)

      const url = `/api/posts${params.toString() ? `?${params.toString()}` : ""}`
      const res = await fetch(url)
      if (!res.ok) {
        const json = await res.json()
        throw new Error(json.error ?? "Failed to fetch posts")
      }
      const json = await res.json()
      set({ posts: json.posts ?? [], loading: false })
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error"
      set({ error: message, loading: false })
    }
  },

  updateVariantStatus: (postId, platform, status) => {
    set((state) => ({
      posts: state.posts.map((post) => {
        if (post.id !== postId) return post
        return {
          ...post,
          platforms: {
            ...post.platforms,
            [platform]: { ...post.platforms[platform], status },
          },
        }
      }),
    }))
  },
}))
