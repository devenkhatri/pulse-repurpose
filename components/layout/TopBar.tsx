import type { ReactNode } from "react"

interface TopBarProps {
  title: string
  actions?: ReactNode
}

export function TopBar({ title, actions }: TopBarProps) {
  return (
    <header className="h-14 flex items-center justify-between px-6 border-b border-white/5 bg-[#0A0A0A] flex-shrink-0">
      <h1 className="text-sm font-medium text-white">{title}</h1>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </header>
  )
}
