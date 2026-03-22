"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { LayoutDashboard, RefreshCw, Calendar, Settings, Zap, BarChart2 } from "lucide-react"
import { cn } from "@/lib/utils"

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/repurpose", label: "Repurpose", icon: RefreshCw },
  { href: "/calendar", label: "Calendar", icon: Calendar },
  { href: "/analytics", label: "Analytics", icon: BarChart2 },
  { href: "/settings", label: "Settings", icon: Settings },
]

export function Sidebar() {
  const pathname = usePathname()

  return (
    <aside className="w-[240px] flex-shrink-0 flex flex-col bg-[#111111] border-r border-white/5 h-screen">
      {/* Logo */}
      <div className="flex items-center gap-2 px-5 py-5 border-b border-white/5">
        <div className="w-7 h-7 rounded-md bg-[#7C3AED] flex items-center justify-center">
          <Zap className="w-4 h-4 text-white" />
        </div>
        <span className="font-semibold text-white text-sm">Pulse Repurpose</span>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-1">
        {navItems.map((item) => {
          const Icon = item.icon
          const isActive = pathname === item.href || pathname.startsWith(item.href + "/")
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors",
                isActive
                  ? "bg-[#7C3AED]/20 text-[#7C3AED] font-medium"
                  : "text-white/50 hover:text-white hover:bg-white/5"
              )}
            >
              <Icon className="w-4 h-4 flex-shrink-0" />
              {item.label}
            </Link>
          )
        })}
      </nav>

      {/* Footer */}
      <div className="px-5 py-4 border-t border-white/5">
        <p className="text-xs text-white/20">
          {process.env.NEXT_PUBLIC_APP_VERSION ? `v${process.env.NEXT_PUBLIC_APP_VERSION}` : "Pulse Repurpose"}
        </p>
      </div>
    </aside>
  )
}
