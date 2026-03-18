import type { Metadata } from "next"
import { GeistSans } from "geist/font/sans"
import { GeistMono } from "geist/font/mono"
import { Toaster } from "sonner"
import { Sidebar } from "@/components/layout/Sidebar"
import { WebhookBanner } from "@/components/layout/WebhookBanner"
import { FirstRunGuard } from "@/components/layout/FirstRunGuard"
import "./globals.css"

export const metadata: Metadata = {
  title: "Pulse Repurpose",
  description: "Personal content operations — repurpose LinkedIn posts across platforms",
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className={`dark ${GeistSans.variable} ${GeistMono.variable}`}>
      <body className="bg-[#0A0A0A] text-white antialiased">
        <FirstRunGuard />
        <div className="flex h-screen overflow-hidden">
          <Sidebar />
          <main className="flex-1 overflow-y-auto flex flex-col">
            <WebhookBanner />
            {children}
          </main>
        </div>
        <Toaster theme="dark" position="bottom-right" richColors />
      </body>
    </html>
  )
}
