"use client";

import { format } from "date-fns";
import type { Tod } from "./TodFrame";
import { todEmoji, weatherEmoji, DaycmdMark } from "./Glyph";
import { useClock, useWeather } from "./useWeather";
import { usePoll } from "@/lib/hooks";

type TodayLineResp = { line: string | null; cached?: boolean; error?: string };

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
  const todayLine = usePoll<TodayLineResp>("/api/micro/today-line", 30 * 60_000).data;

  return (
    <div
      className="dimmable flex items-center gap-[28px] px-14 pt-[28px] pb-[22px]"
      style={{ borderBottom: "1px solid var(--rule)" }}
    >
      <div className="flex items-center gap-4">
        <DaycmdMark s={34} />
        <div>
          <div
            className="t-display"
            style={{
              fontSize: 26,
              fontWeight: 500,
              letterSpacing: "-0.035em",
              lineHeight: 1,
            }}
          >
            {greetingFor(tod, name)}.
          </div>
          <div className="t-mono text-[11px] text-fg-soft mt-1.5 flex items-center gap-2">
            <span>{dateLine}</span>
            {todayLine?.line && (
              <>
                <span
                  className="inline-block"
                  style={{
                    width: 3,
                    height: 3,
                    borderRadius: 99,
                    background: "var(--c-agent)",
                    opacity: 0.7,
                  }}
                />
                <span
                  className="truncate"
                  style={{
                    fontFamily: "inherit",
                    color: "var(--fg-soft)",
                    maxWidth: 380,
                  }}
                  title={todayLine.line}
                >
                  <span style={{ color: "var(--c-agent)", marginRight: 4 }}>✦</span>
                  {todayLine.line}
                </span>
              </>
            )}
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
