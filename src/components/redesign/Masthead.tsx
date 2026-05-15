"use client";

import { format } from "date-fns";
import type { Tod } from "./TodFrame";
import { todEmoji, weatherEmoji } from "./Glyph";
import { useClock, useWeather } from "./useWeather";

function greetingFor(tod: Tod, name: string): string {
  const verb: Record<Tod, string> = {
    dawn: "Morning",
    morning: "Morning",
    noon: "Afternoon",
    afternoon: "Afternoon",
    dusk: "Evening",
    night: "Evening",
    deep: "Up late",
  };
  return `${verb[tod]}, ${name}`;
}

export function Masthead({
  tod,
  name = "Isaac",
}: {
  tod: Tod;
  name?: string;
}) {
  const now = useClock();
  const dateLine = format(now, "EEEE, MMMM d");
  const clock = format(now, "h:mm a");
  const w = useWeather();
  const nightish = tod === "night" || tod === "deep";

  return (
    <div
      className="dimmable flex items-center gap-[28px] px-14 pt-[28px] pb-[22px]"
      style={{ borderBottom: "1px solid var(--rule)" }}
    >
      <div className="flex items-center gap-3.5">
        <span
          className="inline-flex items-center justify-center text-white font-semibold"
          style={{
            width: 28,
            height: 28,
            borderRadius: 8,
            background:
              "linear-gradient(135deg, var(--c-agent), var(--c-tasks) 80%, var(--c-github))",
            fontSize: 14,
            boxShadow: "inset 0 0 0 1px oklch(1 0 0 / 0.20)",
          }}
        >
          ◉
        </span>
        <div>
          <div
            className="text-[19px] font-medium leading-[1.15]"
            style={{ letterSpacing: "-0.015em" }}
          >
            {greetingFor(tod, name)}.
          </div>
          <div className="t-mono text-[11px] text-fg-soft mt-0.5">
            {dateLine}
          </div>
        </div>
      </div>

      <span className="flex-1" />

      <span
        className="t-mono t-num text-[12px] text-fg whitespace-nowrap"
        title={format(now, "yyyy-MM-dd HH:mm:ss")}
        suppressHydrationWarning
      >
        {clock}
      </span>
      <span className="w-px h-3.5" style={{ background: "var(--rule)" }} />
      <div className="flex items-center gap-2 text-[12px] whitespace-nowrap">
        <span style={{ fontSize: 14, opacity: 0.85 }}>
          {w ? weatherEmoji(w.code, nightish) : todEmoji(tod)}
        </span>
        {w ? (
          <span className="t-mono t-num text-fg-soft">
            {w.tempF}° · H{w.hi} L{w.lo}
          </span>
        ) : (
          <span className="t-mono text-fg-soft opacity-60">—</span>
        )}
      </div>
    </div>
  );
}
