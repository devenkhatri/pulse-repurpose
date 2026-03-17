"use client"

import { Check } from "lucide-react"
import { cn } from "@/lib/utils"

interface ApproveButtonProps {
  isApproved: boolean
  disabled?: boolean
  onClick: () => void
}

export function ApproveButton({ isApproved, disabled, onClick }: ApproveButtonProps) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors",
        isApproved
          ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/10"
          : "bg-[#1C1C1C] text-[#888888] border border-[#2A2A2A] hover:border-emerald-500/40 hover:text-emerald-400",
        disabled && "opacity-40 cursor-not-allowed"
      )}
      title={isApproved ? "Click to unapprove" : "Approve this variant"}
    >
      <Check className="w-3.5 h-3.5" />
      {isApproved ? "Approved" : "Approve"}
    </button>
  )
}
