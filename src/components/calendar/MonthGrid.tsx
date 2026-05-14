"use client";

import { useMemo } from "react";
import type { CalEvent } from "@/lib/calendar";
import {
  addDays,
  monthGridRange,
  parseEventTime,
  sameDay,
  startOfDay,
  DAY_MS,
} from "./dates";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

type Props = {
  cursor: Date;
  events: CalEvent[];
  today: Date;
  onEventClick: (e: CalEvent) => void;
  onDayClick: (day: Date) => void;
};

function eventOverlapsDay(e: CalEvent, day: Date): boolean {
  const dayStart = startOfDay(day).getTime();
  const dayEnd = dayStart + DAY_MS;
  const start = parseEventTime(e.start);
  // Google all-day end is exclusive; non-allday is exclusive at end. Both safe with strict <.
  const end = parseEventTime(e.end);
  if (Number.isNaN(start) || Number.isNaN(end)) return false;
  return start < dayEnd && end > dayStart;
}

export function MonthGrid({
  cursor,
  events,
  today,
  onEventClick,
  onDayClick,
}: Props) {
  const { from } = monthGridRange(cursor);
  const month = cursor.getMonth();

  const days = useMemo(() => {
    return Array.from({ length: 42 }, (_, i) => addDays(from, i));
  }, [from]);

  const byDay = useMemo(() => {
    const map = new Map<number, CalEvent[]>();
    for (const d of days) map.set(d.getTime(), []);
    for (const e of events) {
      for (const d of days) {
        if (eventOverlapsDay(e, d)) {
          map.get(d.getTime())!.push(e);
        }
      }
    }
    // Sort events per day: all-day first, then by start time
    for (const arr of map.values()) {
      arr.sort((a, b) => {
        if (a.allDay !== b.allDay) return a.allDay ? -1 : 1;
        return a.start < b.start ? -1 : a.start > b.start ? 1 : 0;
      });
    }
    return map;
  }, [days, events]);

  return (
    <div
      className="flex flex-col flex-1 min-h-0"
      style={{ borderTop: "1px solid var(--rule)" }}
    >
      <div
        className="grid"
        style={{
          gridTemplateColumns: "repeat(7, 1fr)",
          borderBottom: "1px solid var(--rule)",
          flexShrink: 0,
        }}
      >
        {WEEKDAYS.map((d) => (
          <div
            key={d}
            className="t-mono uppercase text-fg-soft"
            style={{
              fontSize: 10,
              letterSpacing: "0.08em",
              padding: "8px 10px",
              textAlign: "right",
            }}
          >
            {d}
          </div>
        ))}
      </div>

      <div
        className="grid flex-1 min-h-0"
        style={{
          gridTemplateColumns: "repeat(7, 1fr)",
          gridTemplateRows: "repeat(6, 1fr)",
        }}
      >
        {days.map((day, idx) => {
          const inMonth = day.getMonth() === month;
          const isToday = sameDay(day, today);
          const dayEvents = byDay.get(day.getTime()) ?? [];
          const visible = dayEvents.slice(0, 3);
          const hidden = dayEvents.length - visible.length;
          const col = idx % 7;
          return (
            <div
              key={day.getTime()}
              onClick={() => onDayClick(day)}
              className="cal-cell"
              style={{
                borderRight: col < 6 ? "1px solid var(--rule)" : "none",
                borderBottom: idx < 35 ? "1px solid var(--rule)" : "none",
                opacity: inMonth ? 1 : 0.45,
                padding: "4px 6px 6px",
                cursor: "pointer",
                display: "flex",
                flexDirection: "column",
                gap: 2,
                overflow: "hidden",
              }}
            >
              <div
                className="flex items-center justify-end"
                style={{ height: 22, padding: "2px 2px 0" }}
              >
                <span
                  className="t-mono"
                  style={{
                    fontSize: 11,
                    fontWeight: isToday ? 600 : 400,
                    color: isToday ? "var(--c-calendar)" : undefined,
                    background: isToday
                      ? "color-mix(in srgb, var(--c-calendar) 15%, transparent)"
                      : undefined,
                    borderRadius: 999,
                    padding: isToday ? "1px 7px" : 0,
                  }}
                >
                  {day.getDate()}
                </span>
              </div>
              {visible.map((e) => (
                <button
                  key={`${e.calendarId}-${e.id}`}
                  onClick={(ev) => {
                    ev.stopPropagation();
                    onEventClick(e);
                  }}
                  className="cal-chip"
                  style={{
                    background: e.calendarColor
                      ? `color-mix(in srgb, ${e.calendarColor} 22%, transparent)`
                      : "color-mix(in srgb, var(--c-calendar) 22%, transparent)",
                    borderLeft: `2px solid ${e.calendarColor ?? "var(--c-calendar)"}`,
                  }}
                  title={e.summary}
                >
                  <span className="truncate">{e.summary}</span>
                </button>
              ))}
              {hidden > 0 && (
                <button
                  onClick={(ev) => {
                    ev.stopPropagation();
                    onDayClick(day);
                  }}
                  className="t-mono text-fg-soft"
                  style={{
                    fontSize: 10,
                    textAlign: "left",
                    padding: "0 4px",
                    background: "transparent",
                    border: "none",
                    cursor: "pointer",
                  }}
                >
                  +{hidden} more
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
