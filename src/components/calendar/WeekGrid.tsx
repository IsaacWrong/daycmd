"use client";

import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { CalEvent } from "@/lib/calendar";
import { DAY_MS, parseEventTime, sameDay, startOfDay } from "./dates";

const HOUR_HEIGHT = 48;
const GUTTER = 56;
const HOURS = Array.from({ length: 24 }, (_, i) => i);
const SNAP_MIN = 15;
const SNAP_MS = SNAP_MIN * 60_000;
const PX_PER_MIN = HOUR_HEIGHT / 60;

type Props = {
  days: Date[];
  events: CalEvent[];
  today: Date;
  onEventClick: (e: CalEvent) => void;
  onSlotClick: (start: Date) => void;
  onMove?: (event: CalEvent, start: Date, end: Date) => Promise<void>;
};

type Positioned = {
  event: CalEvent;
  top: number;
  height: number;
  col: number;
  cols: number;
};

type DragState = {
  kind: "move" | "resize";
  event: CalEvent;
  // captured at drag start
  origStart: number;
  origEnd: number;
  pointerStartY: number;
  pointerStartX: number;
  // For move: minute offset from event start where the mouse grabbed
  grabOffsetMin: number;
  // Column bounding rects (relative to viewport) — captured once
  cols: { left: number; right: number; dayMs: number }[];
  // Current preview state
  start: number;
  end: number;
  // Indicates user dragged enough to suppress click
  moved: boolean;
};

function clampDayBounds(
  e: CalEvent,
  day: Date,
): { start: number; end: number } | null {
  const dayStart = startOfDay(day).getTime();
  const dayEnd = dayStart + DAY_MS;
  const s = parseEventTime(e.start);
  const en = parseEventTime(e.end);
  if (Number.isNaN(s) || Number.isNaN(en)) return null;
  if (en <= dayStart || s >= dayEnd) return null;
  return { start: Math.max(s, dayStart), end: Math.min(en, dayEnd) };
}

function layoutDay(events: CalEvent[], day: Date): Positioned[] {
  const items = events
    .filter((e) => !e.allDay)
    .map((e) => {
      const b = clampDayBounds(e, day);
      if (!b) return null;
      return { event: e, start: b.start, end: b.end };
    })
    .filter(Boolean) as { event: CalEvent; start: number; end: number }[];
  items.sort((a, b) => a.start - b.start || b.end - a.end);

  const clusters: {
    items: typeof items;
    maxCol: number;
    colsAssigned: Map<string, number>;
  }[] = [];
  let current: typeof items = [];
  let currentEnd = -Infinity;
  for (const it of items) {
    if (current.length && it.start < currentEnd) {
      current.push(it);
      currentEnd = Math.max(currentEnd, it.end);
    } else {
      if (current.length)
        clusters.push({ items: current, maxCol: 0, colsAssigned: new Map() });
      current = [it];
      currentEnd = it.end;
    }
  }
  if (current.length)
    clusters.push({ items: current, maxCol: 0, colsAssigned: new Map() });

  const dayStart = startOfDay(day).getTime();
  const out: Positioned[] = [];
  for (const cluster of clusters) {
    const colEnds: number[] = [];
    for (const it of cluster.items) {
      let col = colEnds.findIndex((end) => end <= it.start);
      if (col === -1) {
        col = colEnds.length;
        colEnds.push(it.end);
      } else {
        colEnds[col] = it.end;
      }
      cluster.colsAssigned.set(it.event.id, col);
      cluster.maxCol = Math.max(cluster.maxCol, col + 1);
    }
    for (const it of cluster.items) {
      const col = cluster.colsAssigned.get(it.event.id)!;
      const topMin = (it.start - dayStart) / 60000;
      const heightMin = Math.max((it.end - it.start) / 60000, 15);
      out.push({
        event: it.event,
        top: (topMin / 60) * HOUR_HEIGHT,
        height: (heightMin / 60) * HOUR_HEIGHT,
        col,
        cols: cluster.maxCol,
      });
    }
  }
  return out;
}

function snap(ms: number): number {
  return Math.round(ms / SNAP_MS) * SNAP_MS;
}

function fmtHourLabel(h: number): string {
  if (h === 0) return "";
  const d = new Date();
  d.setHours(h, 0, 0, 0);
  return d.toLocaleTimeString([], { hour: "numeric" });
}

function fmtRange(startMs: number, endMs: number): string {
  const s = new Date(startMs).toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  });
  const e = new Date(endMs).toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  });
  return `${s} – ${e}`;
}

export function WeekGrid({
  days,
  events,
  today,
  onEventClick,
  onSlotClick,
  onMove,
}: Props) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const colsContainerRef = useRef<HTMLDivElement>(null);
  const colRefs = useRef<Array<HTMLDivElement | null>>([]);
  const [nowOffset, setNowOffset] = useState<number>(() => {
    const n = new Date();
    return (n.getHours() * 60 + n.getMinutes()) * PX_PER_MIN;
  });
  const [drag, setDrag] = useState<DragState | null>(null);
  const suppressClickRef = useRef(false);

  useEffect(() => {
    const id = setInterval(() => {
      const n = new Date();
      setNowOffset((n.getHours() * 60 + n.getMinutes()) * PX_PER_MIN);
    }, 60_000);
    return () => clearInterval(id);
  }, []);

  useLayoutEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = 7 * HOUR_HEIGHT - 16;
    }
  }, []);

  const allDayByCol = useMemo(
    () =>
      days.map((d) =>
        events.filter((e) => {
          if (!e.allDay) return false;
          const b = clampDayBounds(e, d);
          return !!b;
        }),
      ),
    [days, events],
  );

  const positionedByCol = useMemo(
    () => days.map((d) => layoutDay(events, d)),
    [days, events],
  );

  const allDayRowHeight =
    24 + Math.max(...allDayByCol.map((a) => a.length)) * 20;

  function captureCols(): DragState["cols"] {
    return days.map((d, i) => {
      const r = colRefs.current[i]?.getBoundingClientRect();
      return {
        left: r?.left ?? 0,
        right: r?.right ?? 0,
        dayMs: startOfDay(d).getTime(),
      };
    });
  }

  function startMove(event: CalEvent, e: React.PointerEvent, p: Positioned) {
    if (event.allDay) return;
    const origStart = new Date(event.start).getTime();
    const origEnd = new Date(event.end).getTime();
    if (Number.isNaN(origStart) || Number.isNaN(origEnd)) return;
    // Compute where in the block the pointer grabbed (minutes from event start)
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const grabMin = ((e.clientY - rect.top) / HOUR_HEIGHT) * 60;
    setDrag({
      kind: "move",
      event,
      origStart,
      origEnd,
      pointerStartX: e.clientX,
      pointerStartY: e.clientY,
      grabOffsetMin: grabMin,
      cols: captureCols(),
      start: origStart,
      end: origEnd,
      moved: false,
    });
    e.preventDefault();
    e.stopPropagation();
    void p;
  }

  function startResize(event: CalEvent, e: React.PointerEvent) {
    if (event.allDay) return;
    const origStart = new Date(event.start).getTime();
    const origEnd = new Date(event.end).getTime();
    if (Number.isNaN(origStart) || Number.isNaN(origEnd)) return;
    setDrag({
      kind: "resize",
      event,
      origStart,
      origEnd,
      pointerStartX: e.clientX,
      pointerStartY: e.clientY,
      grabOffsetMin: 0,
      cols: captureCols(),
      start: origStart,
      end: origEnd,
      moved: false,
    });
    e.preventDefault();
    e.stopPropagation();
  }

  useEffect(() => {
    if (!drag) return;

    function pointerMove(ev: PointerEvent) {
      setDrag((prev) => {
        if (!prev) return prev;
        const dx = ev.clientX - prev.pointerStartX;
        const dy = ev.clientY - prev.pointerStartY;
        const moved = prev.moved || Math.abs(dx) > 3 || Math.abs(dy) > 3;

        if (prev.kind === "resize") {
          const deltaMin = dy / PX_PER_MIN;
          const newEnd = snap(prev.origEnd + deltaMin * 60000);
          const minEnd = prev.origStart + SNAP_MS;
          return { ...prev, moved, end: Math.max(newEnd, minEnd) };
        }

        // move
        // Vertical: shift entire event by delta minutes
        const deltaMin = dy / PX_PER_MIN;
        const dayShiftDir = (() => {
          // find column under pointer
          const col = prev.cols.find(
            (c) => ev.clientX >= c.left && ev.clientX <= c.right,
          );
          if (!col) return null;
          const origDayMs = startOfDay(new Date(prev.origStart)).getTime();
          return col.dayMs - origDayMs;
        })();
        const dayDelta = dayShiftDir ?? 0;
        const newStart = snap(prev.origStart + deltaMin * 60000 + dayDelta);
        const dur = prev.origEnd - prev.origStart;
        return {
          ...prev,
          moved,
          start: newStart,
          end: newStart + dur,
        };
      });
    }

    function pointerUp() {
      const snapshot = drag;
      setDrag(null);
      if (!snapshot) return;
      if (snapshot.moved) suppressClickRef.current = true;
      if (
        !snapshot.moved ||
        !onMove ||
        (snapshot.start === snapshot.origStart &&
          snapshot.end === snapshot.origEnd)
      ) {
        return;
      }
      void onMove(
        snapshot.event,
        new Date(snapshot.start),
        new Date(snapshot.end),
      );
    }

    document.addEventListener("pointermove", pointerMove);
    document.addEventListener("pointerup", pointerUp);
    document.addEventListener("pointercancel", pointerUp);
    return () => {
      document.removeEventListener("pointermove", pointerMove);
      document.removeEventListener("pointerup", pointerUp);
      document.removeEventListener("pointercancel", pointerUp);
    };
  }, [drag, onMove]);

  // Compute ghost rect when dragging
  const ghost = useMemo(() => {
    if (!drag || !drag.moved) return null;
    const startDate = new Date(drag.start);
    const endDate = new Date(drag.end);
    // find which column index startDate falls in
    const dayMs = startOfDay(startDate).getTime();
    const colIdx = drag.cols.findIndex((c) => c.dayMs === dayMs);
    if (colIdx === -1) return null;
    const dayStart = dayMs;
    const topMin = (drag.start - dayStart) / 60000;
    const heightMin = Math.max((drag.end - drag.start) / 60000, 15);
    return {
      colIdx,
      top: topMin * PX_PER_MIN,
      height: heightMin * PX_PER_MIN,
      label: drag.event.summary,
      color: drag.event.calendarColor,
      range: fmtRange(drag.start, drag.end),
    };
  }, [drag]);

  return (
    <div
      className="flex flex-col flex-1 min-h-0"
      style={{ borderTop: "1px solid var(--rule)" }}
    >
      <div
        className="grid"
        style={{
          gridTemplateColumns: `${GUTTER}px repeat(${days.length}, 1fr)`,
          borderBottom: "1px solid var(--rule)",
          flexShrink: 0,
        }}
      >
        <div />
        {days.map((d) => {
          const isToday = sameDay(d, today);
          return (
            <div
              key={d.getTime()}
              className="flex items-center justify-center gap-2"
              style={{
                padding: "8px 10px",
                borderLeft: "1px solid var(--rule)",
              }}
            >
              <span
                className="t-mono uppercase text-fg-soft"
                style={{ fontSize: 10, letterSpacing: "0.08em" }}
              >
                {d.toLocaleDateString(undefined, { weekday: "short" })}
              </span>
              <span
                className="t-mono"
                style={{
                  fontSize: 13,
                  fontWeight: isToday ? 600 : 400,
                  color: isToday ? "var(--c-calendar)" : undefined,
                  background: isToday
                    ? "color-mix(in srgb, var(--c-calendar) 15%, transparent)"
                    : undefined,
                  borderRadius: 999,
                  padding: isToday ? "1px 8px" : 0,
                }}
              >
                {d.getDate()}
              </span>
            </div>
          );
        })}
      </div>

      <div
        className="grid"
        style={{
          gridTemplateColumns: `${GUTTER}px repeat(${days.length}, 1fr)`,
          borderBottom: "1px solid var(--rule)",
          flexShrink: 0,
          minHeight: allDayRowHeight,
        }}
      >
        <div
          className="t-mono uppercase text-fg-soft"
          style={{
            fontSize: 9,
            letterSpacing: "0.08em",
            padding: "6px 8px",
            textAlign: "right",
          }}
        >
          all day
        </div>
        {allDayByCol.map((list, idx) => (
          <div
            key={days[idx].getTime()}
            style={{
              borderLeft: "1px solid var(--rule)",
              padding: 3,
              display: "flex",
              flexDirection: "column",
              gap: 2,
            }}
          >
            {list.map((e) => (
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
          </div>
        ))}
      </div>

      <div
        ref={scrollRef}
        className="scroll"
        style={{ flex: 1, overflowY: "auto", position: "relative" }}
      >
        <div
          ref={colsContainerRef}
          className="grid"
          style={{
            gridTemplateColumns: `${GUTTER}px repeat(${days.length}, 1fr)`,
            position: "relative",
          }}
        >
          <div style={{ position: "relative" }}>
            {HOURS.map((h) => (
              <div
                key={h}
                className="t-mono text-fg-soft"
                style={{
                  position: "relative",
                  height: HOUR_HEIGHT,
                  fontSize: 10,
                  paddingRight: 8,
                  textAlign: "right",
                }}
              >
                <span
                  style={{
                    position: "absolute",
                    top: -6,
                    right: 8,
                    background: "var(--bg-b)",
                    padding: "0 2px",
                  }}
                >
                  {fmtHourLabel(h)}
                </span>
              </div>
            ))}
          </div>

          {days.map((d, colIdx) => {
            const positioned = positionedByCol[colIdx];
            const isToday = sameDay(d, today);
            const isGhostCol = ghost?.colIdx === colIdx;
            return (
              <div
                key={d.getTime()}
                ref={(el) => {
                  colRefs.current[colIdx] = el;
                }}
                style={{
                  position: "relative",
                  borderLeft: "1px solid var(--rule)",
                  height: HOUR_HEIGHT * 24,
                }}
                onClick={(e) => {
                  if (drag) return;
                  if (suppressClickRef.current) {
                    suppressClickRef.current = false;
                    return;
                  }
                  const rect = (
                    e.currentTarget as HTMLDivElement
                  ).getBoundingClientRect();
                  const y = e.clientY - rect.top;
                  const minutes =
                    Math.round((y / HOUR_HEIGHT) * 60 / SNAP_MIN) * SNAP_MIN;
                  const start = new Date(
                    startOfDay(d).getTime() + minutes * 60000,
                  );
                  onSlotClick(start);
                }}
              >
                {HOURS.map((h) => (
                  <div
                    key={h}
                    style={{
                      position: "absolute",
                      left: 0,
                      right: 0,
                      top: h * HOUR_HEIGHT,
                      height: 1,
                      background: "var(--rule)",
                      opacity: 0.6,
                    }}
                  />
                ))}

                {isToday && (
                  <div
                    style={{
                      position: "absolute",
                      left: 0,
                      right: 0,
                      top: nowOffset,
                      height: 1,
                      background: "var(--c-calendar)",
                      zIndex: 3,
                      pointerEvents: "none",
                    }}
                  >
                    <span
                      style={{
                        position: "absolute",
                        left: -4,
                        top: -4,
                        width: 8,
                        height: 8,
                        borderRadius: 999,
                        background: "var(--c-calendar)",
                      }}
                    />
                  </div>
                )}

                {positioned.map((p) => {
                  const widthPct = 100 / p.cols;
                  const isDragging = drag?.event.id === p.event.id;
                  return (
                    <div
                      key={`${p.event.calendarId}-${p.event.id}`}
                      onClick={(ev) => {
                        ev.stopPropagation();
                        if (suppressClickRef.current) {
                          suppressClickRef.current = false;
                          return;
                        }
                        onEventClick(p.event);
                      }}
                      onPointerDown={(ev) => startMove(p.event, ev, p)}
                      className="cal-block"
                      style={{
                        position: "absolute",
                        top: p.top + 1,
                        height: Math.max(p.height - 2, 14),
                        left: `calc(${p.col * widthPct}% + 2px)`,
                        width: `calc(${widthPct}% - 4px)`,
                        background: p.event.calendarColor
                          ? `color-mix(in srgb, ${p.event.calendarColor} 26%, var(--bg-b))`
                          : "color-mix(in srgb, var(--c-calendar) 26%, var(--bg-b))",
                        borderLeft: `2px solid ${
                          p.event.calendarColor ?? "var(--c-calendar)"
                        }`,
                        cursor: "grab",
                        opacity: isDragging && drag?.moved ? 0.35 : 1,
                        userSelect: "none",
                        touchAction: "none",
                      }}
                      title={p.event.summary}
                    >
                      <div className="cal-block-title">{p.event.summary}</div>
                      {p.height > 28 && (
                        <div className="cal-block-time">
                          {new Date(p.event.start).toLocaleTimeString([], {
                            hour: "numeric",
                            minute: "2-digit",
                          })}
                        </div>
                      )}
                      <div
                        onPointerDown={(ev) => startResize(p.event, ev)}
                        style={{
                          position: "absolute",
                          left: 0,
                          right: 0,
                          bottom: 0,
                          height: 6,
                          cursor: "ns-resize",
                          touchAction: "none",
                        }}
                      />
                    </div>
                  );
                })}

                {ghost && isGhostCol && (
                  <div
                    className="cal-block"
                    style={{
                      position: "absolute",
                      top: ghost.top,
                      height: Math.max(ghost.height, 14),
                      left: 2,
                      right: 2,
                      background: ghost.color
                        ? `color-mix(in srgb, ${ghost.color} 36%, var(--bg-b))`
                        : "color-mix(in srgb, var(--c-calendar) 36%, var(--bg-b))",
                      borderLeft: `2px solid ${
                        ghost.color ?? "var(--c-calendar)"
                      }`,
                      boxShadow:
                        "0 4px 16px -4px color-mix(in srgb, var(--fg) 30%, transparent)",
                      pointerEvents: "none",
                      zIndex: 5,
                    }}
                  >
                    <div className="cal-block-title">{ghost.label}</div>
                    <div className="cal-block-time">{ghost.range}</div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
