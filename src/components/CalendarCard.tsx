"use client";

import { usePoll } from "@/lib/hooks";
import type { CalEvent } from "@/lib/calendar";
import { format, isToday, isTomorrow } from "date-fns";

type Resp =
  | { events: CalEvent[]; configured: boolean; connected: boolean }
  | { error: string; configured: boolean; connected: boolean };

function timeLabel(e: CalEvent): string {
  if (e.allDay) return "all day";
  const d = new Date(e.start);
  return format(d, "h:mm a");
}

function dayBucket(e: CalEvent): "today" | "tomorrow" | "later" {
  const d = new Date(e.start);
  if (isToday(d)) return "today";
  if (isTomorrow(d)) return "tomorrow";
  return "later";
}

export function CalendarCard() {
  const { data, error } = usePoll<Resp>("/api/calendar", 60_000);

  const buckets = { today: [] as CalEvent[], tomorrow: [] as CalEvent[], later: [] as CalEvent[] };
  if (data && "events" in data) {
    for (const e of data.events) buckets[dayBucket(e)].push(e);
  }

  return (
    <section className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-5 min-h-[240px]">
      <header className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-medium uppercase tracking-wider text-zinc-400">
          Calendar
        </h2>
      </header>

      {error && <p className="text-sm text-red-400">{error}</p>}
      {!data && !error && <p className="text-sm text-zinc-500">Loading…</p>}

      {data && "error" in data && !data.configured && (
        <p className="text-sm text-zinc-500">Google not configured.</p>
      )}
      {data && "error" in data && data.configured && !data.connected && (
        <a
          href="/api/auth/google"
          className="inline-block text-sm rounded-md bg-zinc-800 hover:bg-zinc-700 px-3 py-1.5 text-zinc-100"
        >
          Connect Google
        </a>
      )}

      {data && "events" in data && (
        <div className="space-y-4">
          {(["today", "tomorrow", "later"] as const).map((bucket) => {
            const items = buckets[bucket];
            if (!items.length) return null;
            return (
              <div key={bucket}>
                <h3 className="text-xs font-semibold text-zinc-300 mb-1 capitalize">
                  {bucket}
                </h3>
                <ul className="space-y-0.5">
                  {items.slice(0, 6).map((e) => (
                    <li
                      key={e.id}
                      className="flex items-baseline gap-2 text-sm"
                    >
                      <span className="text-xs text-zinc-500 w-20 shrink-0">
                        {timeLabel(e)}
                      </span>
                      <a
                        href={e.hangoutLink ?? e.url ?? "#"}
                        target="_blank"
                        rel="noreferrer"
                        className="flex-1 truncate text-zinc-200 hover:text-zinc-50"
                      >
                        {e.summary}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
          {!buckets.today.length &&
            !buckets.tomorrow.length &&
            !buckets.later.length && (
              <p className="text-sm text-zinc-500">No upcoming events.</p>
            )}
        </div>
      )}
    </section>
  );
}
