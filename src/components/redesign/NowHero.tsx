"use client";

import { useEffect, useState } from "react";
import { format, formatDistanceToNowStrict } from "date-fns";
import { usePoll } from "@/lib/hooks";
import type { CalEvent } from "@/lib/calendar";

type CalResp =
  | { events: CalEvent[]; configured: boolean; connected: boolean }
  | { error: string; configured: boolean; connected: boolean };

const SRC_BY_INDEX: Array<"calendar" | "tasks" | "good" | "agent" | "github"> = [
  "calendar",
  "tasks",
  "good",
  "agent",
  "github",
];

function findNow(events: CalEvent[], ts: number): CalEvent | null {
  let current: CalEvent | null = null;
  for (const e of events) {
    if (e.allDay) continue;
    const start = new Date(e.start).getTime();
    const end = new Date(e.end).getTime();
    if (Number.isNaN(start) || Number.isNaN(end)) continue;
    if (start <= ts && ts < end) {
      if (!current || end < new Date(current.end).getTime()) current = e;
    }
  }
  return current;
}

function DayStrip({ events }: { events: CalEvent[] }) {
  const startH = 9;
  const endH = 22;
  const span = endH - startH;
  const now = new Date();
  const nowH = now.getHours() + now.getMinutes() / 60;
  const nowPct = Math.max(0, Math.min(100, ((nowH - startH) / span) * 100));

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const blocks = events
    .filter((e) => !e.allDay)
    .map((e, i) => {
      const s = new Date(e.start);
      const en = new Date(e.end);
      if (s >= tomorrow || en <= today) return null;
      const sH = Math.max(s.getHours() + s.getMinutes() / 60, startH);
      const eH = Math.min(en.getHours() + en.getMinutes() / 60 || endH, endH);
      if (eH <= sH) return null;
      const color = SRC_BY_INDEX[i % SRC_BY_INDEX.length];
      return { sH, eH, label: e.summary, color };
    })
    .filter((b): b is NonNullable<typeof b> => b !== null);

  return (
    <div>
      <div
        className="relative overflow-hidden"
        style={{
          height: 36,
          borderRadius: 8,
          background: "oklch(from var(--fg) l c h / 0.04)",
          border: "1px solid var(--rule)",
        }}
      >
        {Array.from({ length: span + 1 }, (_, i) => (
          <div
            key={i}
            className="absolute top-0 bottom-0"
            style={{
              left: `${(i / span) * 100}%`,
              width: 1,
              background:
                i % 3 === 0 ? "oklch(from var(--fg) l c h / 0.08)" : "transparent",
            }}
          />
        ))}

        {blocks.map((b, i) => {
          const left = ((b.sH - startH) / span) * 100;
          const width = ((b.eH - b.sH) / span) * 100;
          return (
            <div
              key={i}
              title={b.label}
              className="absolute flex items-center overflow-hidden whitespace-nowrap"
              style={{
                top: 6,
                bottom: 6,
                left: `${left}%`,
                width: `calc(${width}% - 2px)`,
                borderRadius: 4,
                background: `oklch(from var(--c-${b.color}) l c h / 0.30)`,
                borderLeft: `2px solid var(--c-${b.color})`,
                padding: "0 6px",
                fontSize: 10.5,
                color: "var(--fg)",
                fontWeight: 500,
                letterSpacing: "-0.005em",
                textOverflow: "ellipsis",
              }}
            >
              {b.label}
            </div>
          );
        })}

        <div
          className="absolute"
          style={{
            top: -3,
            bottom: -3,
            left: `${nowPct}%`,
            width: 2,
            background: "var(--fg)",
            boxShadow: "0 0 0 3px var(--bg-a)",
          }}
        />
        <div
          className="absolute rounded-full"
          style={{
            top: -8,
            left: `calc(${nowPct}% - 4px)`,
            width: 10,
            height: 10,
            background: "var(--fg)",
            boxShadow: "0 0 0 3px var(--bg-a)",
          }}
        />
      </div>
      <div className="t-mono flex justify-between mt-1.5 text-[10px] text-fg-soft">
        <span>9a</span>
        <span>12p</span>
        <span>3p</span>
        <span>6p</span>
        <span>9p</span>
      </div>
    </div>
  );
}

export function NowHero() {
  const { data } = usePoll<CalResp>("/api/calendar", 60_000);
  const [, tick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => tick((n) => n + 1), 30_000);
    return () => clearInterval(id);
  }, []);

  const events = data && "events" in data ? data.events : [];
  const now = findNow(events, Date.now());

  return (
    <div className="focus-keep mb-7">
      <div className="t-eyebrow mb-2.5">
        {now ? (
          <>
            Now · ends {format(new Date(now.end), "h:mm a")} ·{" "}
            {formatDistanceToNowStrict(new Date(now.end))} left
          </>
        ) : (
          <>Now · open block</>
        )}
      </div>
      <h2
        className="m-0 mb-[18px] font-medium"
        style={{
          fontSize: 36,
          letterSpacing: "-0.025em",
          lineHeight: 1.08,
        }}
      >
        {now ? now.summary : "Open block"}
      </h2>
      <DayStrip events={events} />
    </div>
  );
}
