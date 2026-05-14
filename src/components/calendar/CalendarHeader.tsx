"use client";

import type { CalendarView } from "./types";
import {
  fmtDayLong,
  fmtMonthYear,
  fmtWeekRange,
} from "./dates";

type Props = {
  view: CalendarView;
  cursor: Date;
  onViewChange: (v: CalendarView) => void;
  onNav: (delta: -1 | 1) => void;
  onToday: () => void;
  onNew: () => void;
  onClose: () => void;
  titleId?: string;
};

const VIEWS: CalendarView[] = ["day", "week", "month"];

export function CalendarHeader({
  view,
  cursor,
  onViewChange,
  onNav,
  onToday,
  onNew,
  onClose,
  titleId,
}: Props) {
  const title =
    view === "month"
      ? fmtMonthYear(cursor)
      : view === "week"
        ? fmtWeekRange(cursor)
        : fmtDayLong(cursor);

  return (
    <header
      className="flex items-center gap-3 px-5"
      style={{
        height: 56,
        borderBottom: "1px solid var(--rule)",
        flexShrink: 0,
      }}
    >
      <button
        onClick={onClose}
        aria-label="Close"
        className="cal-icon-btn"
        style={{ marginLeft: -6 }}
      >
        ✕
      </button>

      <div className="flex items-center gap-1 ml-1">
        <button onClick={() => onNav(-1)} aria-label="Previous" className="cal-icon-btn">
          ‹
        </button>
        <button onClick={() => onNav(1)} aria-label="Next" className="cal-icon-btn">
          ›
        </button>
        <button onClick={onToday} className="cal-pill">
          Today
        </button>
      </div>

      <h2
        id={titleId}
        className="m-0 text-[15px] font-medium"
        style={{ letterSpacing: "-0.01em", marginLeft: 6 }}
      >
        {title}
      </h2>

      <span className="flex-1" />

      <div
        className="flex items-center"
        style={{
          border: "1px solid var(--rule)",
          borderRadius: 8,
          padding: 2,
        }}
      >
        {VIEWS.map((v) => (
          <button
            key={v}
            onClick={() => onViewChange(v)}
            className="cal-seg-btn"
            data-active={v === view}
          >
            {v[0].toUpperCase() + v.slice(1)}
          </button>
        ))}
      </div>

      <button onClick={onNew} className="cal-primary-btn">
        + New
      </button>
    </header>
  );
}
