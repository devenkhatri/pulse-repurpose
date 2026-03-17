interface TopBarProps {
  title: string
}

export function TopBar({ title }: TopBarProps) {
  return (
    <header className="h-14 flex items-center px-6 border-b border-white/5 bg-[#0A0A0A] flex-shrink-0">
      <h1 className="text-sm font-medium text-white">{title}</h1>
    </header>
  )
}
