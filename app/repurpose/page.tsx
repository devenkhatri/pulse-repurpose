import { TopBar } from "@/components/layout/TopBar"

export default function RepurposePage() {
  return (
    <div className="flex flex-col h-full">
      <TopBar title="Repurpose" />
      <div className="flex-1 p-6">
        <h1 className="text-2xl font-semibold text-white">Repurpose</h1>
      </div>
    </div>
  )
}
