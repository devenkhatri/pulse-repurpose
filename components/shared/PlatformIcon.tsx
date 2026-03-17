import { cn } from "@/lib/utils"
import type { Platform } from "@/types"

interface PlatformIconProps {
  platform: Platform
  size?: "sm" | "md" | "lg"
  className?: string
}

const platformConfig: Record<Platform, { label: string; color: string; bg: string }> = {
  twitter: { label: "X", color: "text-[#1DA1F2]", bg: "bg-[#1DA1F2]/10" },
  threads: { label: "Th", color: "text-white", bg: "bg-white/10" },
  instagram: { label: "In", color: "text-[#E1306C]", bg: "bg-[#E1306C]/10" },
  facebook: { label: "Fb", color: "text-[#1877F2]", bg: "bg-[#1877F2]/10" },
  skool: { label: "Sk", color: "text-[#00A651]", bg: "bg-[#00A651]/10" },
  linkedin: { label: "Li", color: "text-[#0A66C2]", bg: "bg-[#0A66C2]/10" },
}

const sizeClasses = {
  sm: "w-5 h-5 text-[10px]",
  md: "w-7 h-7 text-xs",
  lg: "w-9 h-9 text-sm",
}

export function PlatformIcon({ platform, size = "md", className }: PlatformIconProps) {
  const config = platformConfig[platform]
  return (
    <div
      className={cn(
        "rounded-md flex items-center justify-center font-semibold flex-shrink-0",
        config.bg,
        config.color,
        sizeClasses[size],
        className
      )}
      title={config.label}
    >
      {config.label}
    </div>
  )
}
