"use client"

import { useEffect, useRef } from "react"
import { useRouter, usePathname } from "next/navigation"
import { toast } from "sonner"

/**
 * Checks on first mount whether brand voice is configured.
 * If examplePosts is empty, redirects to /settings and shows a welcome toast.
 * Only runs once per page load — does not re-check after user saves.
 */
export function FirstRunGuard() {
  const router = useRouter()
  const pathname = usePathname()
  const checked = useRef(false)

  useEffect(() => {
    // Only check once, and don't interrupt the user if they're already on /settings
    if (checked.current || pathname === "/settings") return
    checked.current = true

    fetch("/api/brand-voice")
      .then((r) => r.json())
      .then((data: { profile?: { examplePosts?: string[] } }) => {
        const examplePosts = data.profile?.examplePosts ?? []
        if (examplePosts.length === 0) {
          router.push("/settings")
          toast.info(
            "Before repurposing, set up your brand voice — Claude uses it to match your voice.",
            { duration: 6000, id: "first-run" }
          )
        }
      })
      .catch(() => {})
  }, [router, pathname])

  return null
}
