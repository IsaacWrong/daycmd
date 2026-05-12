"use client";

import { format, subDays } from "date-fns";
import { usePoll } from "@/lib/hooks";

const WEEKDAYS = ["S", "M", "T", "W", "T", "F", "S"];

export function Heatmap() {
  const { data } = usePoll<{ days: number[] }>("/api/heatmap", 90_000);
  const days: number[] = data?.days ?? new Array(14).fill(0);
  const max = Math.max(...days, 1);
  const today = new Date();
  const startDate = subDays(today, days.length - 1);
  const firstDow = startDate.getDay();
  const orderedWeekdays: string[] = [];
  for (let i = 0; i < 7; i++) orderedWeekdays.push(WEEKDAYS[(firstDow + i) % 7]);

  return (
    <div>
      <div className="grid grid-cols-7 gap-1 mb-1.5">
        {orderedWeekdays.map((d, i) => (
          <div key={i} className="t-mono text-[9px] text-fg-soft text-center">
            {d}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {days.map((v, i) => {
          const isToday = i === days.length - 1;
          const alpha = v === 0 ? 0.05 : 0.12 + (v / max) * 0.55;
          return (
            <div
              key={i}
              title={`${v} commits`}
              className="h-[22px] rounded"
              style={{
                background:
                  v === 0
                    ? "oklch(from var(--fg) l c h / 0.05)"
                    : `oklch(from var(--c-tasks) l c h / ${alpha})`,
                border: isToday
                  ? "1px solid oklch(from var(--c-tasks) l c h / 0.5)"
                  : "none",
              }}
            />
          );
        })}
      </div>
      <div className="t-mono text-[10px] text-fg-soft mt-2 flex justify-between items-center">
        <span>{format(startDate, "MMM d")}</span>
        <span className="flex items-center gap-1">
          {[0.1, 0.25, 0.45, 0.7].map((a, i) => (
            <span
              key={i}
              className="w-2 h-2 rounded-sm"
              style={{ background: `oklch(from var(--c-tasks) l c h / ${a})` }}
            />
          ))}
        </span>
        <span>today</span>
      </div>
    </div>
  );
}
