import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import { format } from "date-fns"
import type { Platform } from "@/types"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatDate(date: Date): string {
  return format(date, "MMM d, yyyy")
}

export function truncate(text: string, maxLen: number): string {
  if (text.length <= maxLen) return text
  return text.slice(0, maxLen - 3) + "..."
}

export function platformColor(platform: Platform): string {
  const colors: Record<Platform, string> = {
    twitter: "#1DA1F2",
    threads: "#000000",
    instagram: "#E1306C",
    facebook: "#1877F2",
    skool: "#00A651",
    linkedin: "#0A66C2",
  }
  return colors[platform]
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
