"use client";

import { useEffect, useState } from "react";
import { usePoll } from "@/lib/hooks";
import { format, formatDistanceToNowStrict } from "date-fns";
import type { CalEvent } from "@/lib/calendar";

type Resp =
  | { events: CalEvent[]; configured: boolean; connected: boolean }
  | { error: string; configured: boolean; connected: boolean };

function findNowNext(events: CalEvent[]): { now: CalEvent | null; next: CalEvent | null } {
  const ts = Date.now();
  let current: CalEvent | null = null;
  let upcoming: CalEvent | null = null;
  for (const e of events) {
    if (e.allDay) continue;
    const start = new Date(e.start).getTime();
    const end = new Date(e.end).getTime();
    if (Number.isNaN(start) || Number.isNaN(end)) continue;
    if (start <= ts && ts < end) {
      if (!current || end < new Date(current.end).getTime()) current = e;
    } else if (start > ts) {
      if (!upcoming || start < new Date(upcoming.start).getTime())
        upcoming = e;
    }
  }
  return { now: current, next: upcoming };
}

export function NowNext() {
  const { data } = usePoll<Resp>("/api/calendar", 60_000);
  const [, force] = useState(0);

  useEffect(() => {
    const id = setInterval(() => force((n) => n + 1), 30_000);
    return () => clearInterval(id);
  }, []);

  if (!data || !("events" in data)) return null;
  const { now, next } = findNowNext(data.events);
  if (!now && !next) return null;

  return (
    <div className="mb-4 rounded-xl border border-zinc-800 bg-zinc-900/60 px-4 py-2 flex items-center gap-4 flex-wrap">
      {now ? (
        <div className="flex items-center gap-2 text-sm">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-zinc-500 uppercase text-[10px] tracking-wider">
            Now
          </span>
          <span className="text-zinc-100 font-medium">{now.summary}</span>
          <span className="text-zinc-500 text-xs">
            ends in {formatDistanceToNowStrict(new Date(now.end))}
          </span>
        </div>
      ) : null}
      {now && next && <span className="text-zinc-700">·</span>}
      {next ? (
        <div className="flex items-center gap-2 text-sm">
          <span className="text-zinc-500 uppercase text-[10px] tracking-wider">
            Next
          </span>
          <span className="text-zinc-200">{next.summary}</span>
          <span className="text-zinc-500 text-xs">
            in {formatDistanceToNowStrict(new Date(next.start))} ·{" "}
            {format(new Date(next.start), "h:mm a")}
          </span>
        </div>
      ) : null}
    </div>
  );
}
