import { TopBar } from "@/components/layout/TopBar"

export default function SettingsPage() {
  return (
    <div className="flex flex-col h-full">
      <TopBar title="Settings" />
      <div className="flex-1 p-6">
        <h1 className="text-2xl font-semibold text-white">Settings</h1>
      </div>
    </div>
  )
}
