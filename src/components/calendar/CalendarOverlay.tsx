"use client";

import { useEffect, useId, useMemo, useState } from "react";
import { Overlay } from "@/components/ui/Overlay";
import type { CalEvent } from "@/lib/calendar";
import {
  type CalendarRangeResp,
  updateCalendarEvent,
  useCalendarRange,
} from "@/lib/calendar-client";
import { CalendarHeader } from "./CalendarHeader";
import { EventEditor } from "./EventEditor";
import { MonthGrid } from "./MonthGrid";
import { WeekGrid } from "./WeekGrid";
import type { CalendarView, EventDraft } from "./types";
import {
  DAY_MS,
  addDays,
  addMonths,
  monthGridRange,
  startOfDay,
  startOfWeek,
} from "./dates";

type Props = {
  open: boolean;
  onClose: () => void;
  initialDate?: Date;
  initialEventId?: string;
};

function rangeFor(view: CalendarView, cursor: Date): { from: Date; to: Date } {
  if (view === "month") return monthGridRange(cursor);
  if (view === "week") {
    const from = startOfWeek(cursor);
    return { from, to: new Date(addDays(from, 6).getTime() + DAY_MS - 1) };
  }
  const from = startOfDay(cursor);
  return { from, to: new Date(from.getTime() + DAY_MS - 1) };
}

export function CalendarOverlay({
  open,
  onClose,
  initialDate,
  initialEventId,
}: Props) {
  const titleId = useId();
  const [view, setView] = useState<CalendarView>("month");
  const [cursor, setCursor] = useState<Date>(() => initialDate ?? new Date());
  const [today, setToday] = useState<Date>(() => new Date());
  const [draft, setDraft] = useState<EventDraft | null>(null);

  useEffect(() => {
    if (open && initialDate) setCursor(initialDate);
  }, [open, initialDate]);

  useEffect(() => {
    const id = setInterval(() => setToday(new Date()), 60_000);
    return () => clearInterval(id);
  }, []);

  const range = useMemo(() => rangeFor(view, cursor), [view, cursor]);
  const rangeKey = useMemo(
    () => ({ from: range.from.toISOString(), to: range.to.toISOString() }),
    [range],
  );
  const { data } = useCalendarRange(rangeKey);
  const events = useMemo<CalEvent[]>(() => {
    if (!data) return [];
    const r = data as CalendarRangeResp;
    return "events" in r ? r.events : [];
  }, [data]);

  useEffect(() => {
    if (!open || !initialEventId || !events.length) return;
    const ev = events.find((e) => e.id === initialEventId);
    if (ev) setDraft({ event: ev });
  }, [open, initialEventId, events]);

  function navDelta(delta: -1 | 1) {
    if (view === "month") setCursor((c) => addMonths(c, delta));
    else if (view === "week") setCursor((c) => addDays(c, 7 * delta));
    else setCursor((c) => addDays(c, delta));
  }

  const handleMove = useMemo(
    () =>
      async (event: CalEvent, start: Date, end: Date) => {
        try {
          await updateCalendarEvent(rangeKey, event, {
            start: start.toISOString(),
            end: end.toISOString(),
          });
        } catch (e) {
          console.error("[calendar] reschedule failed:", (e as Error).message);
        }
      },
    [rangeKey],
  );

  return (
    <Overlay open={open} onClose={onClose} labelledBy={titleId}>
      <div
        className="flex flex-col glass-card"
        style={{
          margin: 24,
          flex: 1,
          borderRadius: 14,
          overflow: "hidden",
        }}
      >
        <CalendarHeader
          view={view}
          cursor={cursor}
          onViewChange={setView}
          onNav={navDelta}
          onToday={() => setCursor(new Date())}
          onNew={() =>
            setDraft({
              event: null,
              initial: { start: new Date().toISOString() },
            })
          }
          onClose={onClose}
          titleId={titleId}
        />

        <div className="flex-1 min-h-0 flex">
          <div className="flex-1 min-h-0 flex flex-col">
            {view === "month" && (
              <MonthGrid
                cursor={cursor}
                events={events}
                today={today}
                onEventClick={(e) => setDraft({ event: e })}
                onDayClick={(d) => {
                  setCursor(d);
                  setView("day");
                }}
              />
            )}
            {view === "week" && (
              <WeekGrid
                days={Array.from({ length: 7 }, (_, i) =>
                  addDays(startOfWeek(cursor), i),
                )}
                events={events}
                today={today}
                onEventClick={(e) => setDraft({ event: e })}
                onSlotClick={(start) => {
                  const end = new Date(start.getTime() + 60 * 60_000);
                  setDraft({
                    event: null,
                    initial: { start: start.toISOString(), end: end.toISOString() },
                  });
                }}
                onMove={handleMove}
              />
            )}
            {view === "day" && (
              <WeekGrid
                days={[startOfDay(cursor)]}
                events={events}
                today={today}
                onEventClick={(e) => setDraft({ event: e })}
                onSlotClick={(start) => {
                  const end = new Date(start.getTime() + 60 * 60_000);
                  setDraft({
                    event: null,
                    initial: { start: start.toISOString(), end: end.toISOString() },
                  });
                }}
                onMove={handleMove}
              />
            )}
          </div>

          {draft && (
            <EventEditor
              draft={draft}
              range={rangeKey}
              onClose={() => setDraft(null)}
            />
          )}
        </div>
      </div>
    </Overlay>
  );
}
