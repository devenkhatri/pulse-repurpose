"use client"

import { useRef, useState } from "react"
import FullCalendar from "@fullcalendar/react"
import dayGridPlugin from "@fullcalendar/daygrid"
import timeGridPlugin from "@fullcalendar/timegrid"
import interactionPlugin from "@fullcalendar/interaction"
import type { EventClickArg } from "@fullcalendar/core"
import type { CalendarEvent } from "@/types"
import { cn } from "@/lib/utils"

interface CalendarViewProps {
  events: CalendarEvent[]
  onEventClick: (event: CalendarEvent) => void
}

type CalendarViewMode = "dayGridMonth" | "timeGridWeek"

export function CalendarView({ events, onEventClick }: CalendarViewProps) {
  const calendarRef = useRef<FullCalendar>(null)
  const [view, setView] = useState<CalendarViewMode>("dayGridMonth")

  const fcEvents = events.map((ev) => ({
    id: ev.id,
    title: ev.title,
    start: ev.start,
    backgroundColor: ev.color,
    borderColor: ev.color,
    extendedProps: {
      eventData: ev,
    },
  }))

  function handleEventClick(arg: EventClickArg) {
    const eventData = arg.event.extendedProps.eventData as CalendarEvent
    onEventClick(eventData)
  }

  function switchView(v: CalendarViewMode) {
    setView(v)
    calendarRef.current?.getApi().changeView(v)
  }

  return (
    <div className="flex flex-col gap-3">
      {/* View toggle */}
      <div className="flex gap-2 self-end">
        <button
          onClick={() => switchView("dayGridMonth")}
          className={cn(
            "px-3 py-1.5 rounded-md text-sm font-medium transition-colors",
            view === "dayGridMonth"
              ? "bg-[var(--accent)] text-white"
              : "bg-[var(--bg-card)] text-white/60 hover:text-white"
          )}
        >
          Month
        </button>
        <button
          onClick={() => switchView("timeGridWeek")}
          className={cn(
            "px-3 py-1.5 rounded-md text-sm font-medium transition-colors",
            view === "timeGridWeek"
              ? "bg-[var(--accent)] text-white"
              : "bg-[var(--bg-card)] text-white/60 hover:text-white"
          )}
        >
          Week
        </button>
      </div>

      {/* Calendar */}
      <div className="calendar-wrapper rounded-xl overflow-hidden border border-white/10 bg-[var(--bg-card)] p-4">
        <FullCalendar
          ref={calendarRef}
          plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
          initialView={view}
          events={fcEvents}
          eventClick={handleEventClick}
          height="auto"
          headerToolbar={{
            left: "prev,next today",
            center: "title",
            right: "",
          }}
          eventDisplay="block"
          dayMaxEvents={3}
          eventTimeFormat={{
            hour: "numeric",
            minute: "2-digit",
            meridiem: "short",
          }}
        />
      </div>
    </div>
  )
}
