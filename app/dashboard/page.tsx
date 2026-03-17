import { TopBar } from "@/components/layout/TopBar"

export default function DashboardPage() {
  return (
    <div className="flex flex-col h-full">
      <TopBar title="Dashboard" />
      <div className="flex-1 p-6">
        <h1 className="text-2xl font-semibold text-white">Dashboard</h1>
      </div>
    </div>
  )
}
