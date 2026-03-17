"use client"

import { Plus, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"

interface ExamplePostsInputProps {
  posts: string[]
  onChange: (posts: string[]) => void
  maxPosts?: number
}

export function ExamplePostsInput({
  posts,
  onChange,
  maxPosts = 5,
}: ExamplePostsInputProps) {
  const addPost = () => {
    if (posts.length < maxPosts) onChange([...posts, ""])
  }

  const removePost = (index: number) => {
    onChange(posts.filter((_, i) => i !== index))
  }

  const updatePost = (index: number, value: string) => {
    const updated = [...posts]
    updated[index] = value
    onChange(updated)
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Label className="text-white/70 text-sm">
          Example posts ({posts.length}/{maxPosts})
        </Label>
        {posts.length < maxPosts && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={addPost}
            className="text-[#7C3AED] hover:text-[#7C3AED] hover:bg-[#7C3AED]/10 h-7 px-2 text-xs"
          >
            <Plus className="w-3 h-3 mr-1" />
            Add example
          </Button>
        )}
      </div>

      {posts.length === 0 && (
        <div
          className="rounded-lg border border-dashed border-white/10 p-4 text-center cursor-pointer hover:border-white/20 transition-colors"
          onClick={addPost}
        >
          <p className="text-white/30 text-sm">
            Paste a LinkedIn post that sounds exactly like you
          </p>
          <p className="text-white/20 text-xs mt-1">
            Adding examples significantly improves repurposing quality
          </p>
        </div>
      )}

      {posts.map((post, index) => (
        <div key={index} className="relative group">
          <Textarea
            value={post}
            onChange={(e) => updatePost(index, e.target.value)}
            placeholder="Paste a LinkedIn post that sounds exactly like you..."
            className="min-h-[120px] bg-[#161616] border-white/10 text-white placeholder:text-white/20 resize-none pr-8 focus:border-[#7C3AED]/50"
          />
          <div className="absolute top-2 right-2 flex items-center gap-1">
            <span className="text-white/20 text-xs">{post.length}</span>
            <button
              type="button"
              onClick={() => removePost(index)}
              className="opacity-0 group-hover:opacity-100 transition-opacity p-0.5 rounded hover:bg-white/10 text-white/40 hover:text-white/70"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        </div>
      ))}
    </div>
  )
}
