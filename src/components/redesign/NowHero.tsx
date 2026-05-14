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
  const [nowMs, setNowMs] = useState<number | null>(null);
  useEffect(() => {
    setNowMs(Date.now());
    const id = setInterval(() => setNowMs(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);
  if (nowMs === null) {
    return (
      <div
        style={{
          height: 36,
          borderRadius: 8,
          background: "oklch(from var(--fg) l c h / 0.04)",
          border: "1px solid var(--rule)",
        }}
      />
    );
  }
  return <DayStripInner events={events} nowMs={nowMs} />;
}

function DayStripInner({ events, nowMs }: { events: CalEvent[]; nowMs: number }) {
  const SPAN_HOURS = 8;
  const spanMs = SPAN_HOURS * 3600 * 1000;
  const endMs = nowMs + spanMs;

  const blocks = events
    .filter((e) => !e.allDay)
    .map((e, i) => {
      const s = new Date(e.start).getTime();
      const en = new Date(e.end).getTime();
      if (Number.isNaN(s) || Number.isNaN(en)) return null;
      if (en <= nowMs || s >= endMs) return null;
      const startMs = Math.max(s, nowMs);
      const stopMs = Math.min(en, endMs);
      if (stopMs <= startMs) return null;
      const color = SRC_BY_INDEX[i % SRC_BY_INDEX.length];
      return {
        leftPct: ((startMs - nowMs) / spanMs) * 100,
        widthPct: ((stopMs - startMs) / spanMs) * 100,
        label: e.summary,
        color,
      };
    })
    .filter((b): b is NonNullable<typeof b> => b !== null);

  const nowDate = new Date(nowMs);
  const firstHour = new Date(nowDate);
  firstHour.setMinutes(0, 0, 0);
  firstHour.setHours(firstHour.getHours() + 1);
  const ticks: { pct: number; label: string }[] = [];
  for (let t = firstHour.getTime(); t <= endMs; t += 3600 * 1000) {
    const pct = ((t - nowMs) / spanMs) * 100;
    const d = new Date(t);
    ticks.push({
      pct,
      label: d.toLocaleTimeString([], { hour: "numeric" }).replace(" ", "").toLowerCase(),
    });
  }

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
        {ticks.map((tk, i) => (
          <div
            key={i}
            className="absolute top-0 bottom-0"
            style={{
              left: `${tk.pct}%`,
              width: 1,
              background: "oklch(from var(--fg) l c h / 0.08)",
            }}
          />
        ))}

        {blocks.map((b, i) => (
          <div
            key={i}
            title={b.label}
            className="absolute flex items-center overflow-hidden whitespace-nowrap"
            style={{
              top: 6,
              bottom: 6,
              left: `${b.leftPct}%`,
              width: `calc(${b.widthPct}% - 2px)`,
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
        ))}

        <div
          className="absolute"
          style={{
            top: -3,
            bottom: -3,
            left: 0,
            width: 2,
            background: "var(--fg)",
          }}
        />
        <div
          className="absolute rounded-full"
          style={{
            top: -4,
            left: -4,
            width: 10,
            height: 10,
            background: "var(--fg)",
          }}
        />
      </div>
      <div
        className="relative t-mono mt-1.5 text-[10px] text-fg-soft"
        style={{ height: 12 }}
      >
        <span
          style={{
            position: "absolute",
            left: 0,
            color: "var(--fg)",
            fontWeight: 500,
          }}
        >
          now
        </span>
        {ticks.map((tk, i) =>
          tk.pct < 6 ? null : (
            <span
              key={i}
              style={{
                position: "absolute",
                left: `${tk.pct}%`,
                transform: "translateX(-50%)",
              }}
            >
              {tk.label}
            </span>
          ),
        )}
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
    <div className="focus-keep mb-10">
      <div className="t-eyebrow mb-3.5">
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
        className="m-0 mb-[26px] font-medium"
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
