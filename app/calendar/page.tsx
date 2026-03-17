import { TopBar } from "@/components/layout/TopBar"

export default function CalendarPage() {
  return (
    <div className="flex flex-col h-full">
      <TopBar title="Calendar" />
      <div className="flex-1 p-6">
        <h1 className="text-2xl font-semibold text-white">Calendar</h1>
      </div>
    </div>
  )
}
