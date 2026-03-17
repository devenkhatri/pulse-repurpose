import { create } from "zustand"
import type { LinkedInPost } from "@/types"

interface PostsStore {
  posts: LinkedInPost[]
  loading: boolean
  error: string | null
  fetchPosts: () => Promise<void>
}

export const usePostsStore = create<PostsStore>((set) => ({
  posts: [],
  loading: false,
  error: null,
  fetchPosts: async () => {
    // Stub — implemented in Session 2
  },
}))
