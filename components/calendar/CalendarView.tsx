"use client"

import { useRef, useState } from "react"
import FullCalendar from "@fullcalendar/react"
import dayGridPlugin from "@fullcalendar/daygrid"
import timeGridPlugin from "@fullcalendar/timegrid"
import interactionPlugin from "@fullcalendar/interaction"
import type { EventClickArg, EventDropArg } from "@fullcalendar/core"
import type { CalendarEvent, Platform } from "@/types"
import { PLATFORM_RULES } from "@/lib/platform-rules"
import { cn } from "@/lib/utils"

const TRACKED_PLATFORMS: Platform[] = ["twitter", "threads", "instagram", "facebook", "skool"]

interface CalendarViewProps {
  events: CalendarEvent[]
  onEventClick: (event: CalendarEvent) => void
  onReschedule?: (postId: string, platform: Platform, scheduledAt: string) => Promise<void>
}

type CalendarViewMode = "dayGridMonth" | "timeGridWeek"

export function CalendarView({ events, onEventClick, onReschedule }: CalendarViewProps) {
  const calendarRef = useRef<FullCalendar>(null)
  const [view, setView] = useState<CalendarViewMode>("dayGridMonth")
  const [activePlatforms, setActivePlatforms] = useState<Set<Platform>>(
    new Set(TRACKED_PLATFORMS)
  )

  // Filter events by active platforms
  const filteredEvents = events.filter((ev) => activePlatforms.has(ev.platform))

  const fcEvents = filteredEvents.map((ev) => ({
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

  async function handleEventDrop(arg: EventDropArg) {
    const eventData = arg.event.extendedProps.eventData as CalendarEvent
    if (!onReschedule || !arg.event.start) {
      arg.revert()
      return
    }
    try {
      await onReschedule(
        eventData.postId,
        eventData.platform,
        arg.event.start.toISOString()
      )
    } catch {
      arg.revert()
    }
  }

  function switchView(v: CalendarViewMode) {
    setView(v)
    calendarRef.current?.getApi().changeView(v)
  }

  function goToToday() {
    calendarRef.current?.getApi().today()
  }

  function togglePlatform(platform: Platform) {
    setActivePlatforms((prev) => {
      const next = new Set(prev)
      if (next.has(platform)) {
        if (next.size === 1) return prev // keep at least one
        next.delete(platform)
      } else {
        next.add(platform)
      }
      return next
    })
  }

  return (
    <div className="flex flex-col gap-3">
      {/* Controls bar */}
      <div className="flex items-center gap-3 flex-wrap">
        {/* Platform filter pills */}
        <div className="flex items-center gap-1.5 flex-wrap flex-1">
          {TRACKED_PLATFORMS.map((platform) => {
            const isActive = activePlatforms.has(platform)
            const color = PLATFORM_RULES[platform].color
            return (
              <button
                key={platform}
                onClick={() => togglePlatform(platform)}
                className={cn(
                  "px-2.5 py-1 rounded-full text-xs font-medium transition-colors capitalize",
                  isActive
                    ? "text-white"
                    : "bg-white/5 text-zinc-500 hover:text-zinc-300"
                )}
                style={isActive ? { backgroundColor: color } : undefined}
              >
                {platform}
              </button>
            )
          })}
        </div>

        {/* Today + View toggle */}
        <div className="flex gap-2">
          <button
            onClick={goToToday}
            className="px-3 py-1.5 rounded-md text-sm font-medium transition-colors bg-[var(--bg-card)] text-white/60 hover:text-white border border-white/10 hover:border-white/20"
          >
            Today
          </button>
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
      </div>

      {/* Calendar */}
      <div className="calendar-wrapper rounded-xl overflow-hidden border border-white/10 bg-[var(--bg-card)] p-4">
        <FullCalendar
          ref={calendarRef}
          plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
          initialView={view}
          events={fcEvents}
          eventClick={handleEventClick}
          editable={!!onReschedule}
          eventDrop={handleEventDrop}
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
