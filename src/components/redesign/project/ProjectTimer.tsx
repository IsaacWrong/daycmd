"use client";

import { useEffect, useState } from "react";
import {
  elapsedMs,
  formatElapsed,
  isRunning,
  useActiveTimer,
} from "@/lib/timer";

export function ProjectTimer({ name }: { name: string }) {
  const { state, start } = useActiveTimer();
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!isRunning(state)) return;
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [state]);

  const active = state?.project === name ? state : null;
  const otherActive = state && state.project !== name ? state : null;

  if (active) {
    const running = isRunning(active);
    return (
      <div
        className="flex items-center gap-2 t-mono"
        style={{ fontSize: 12, whiteSpace: "nowrap" }}
        title="Controls available in bottom-left dock"
      >
        <span
          className="src-dot"
          style={{
            width: 6,
            height: 6,
            background: running ? "var(--c-good)" : "var(--fg-soft)",
          }}
        />
        <span className="t-num" style={{ color: "var(--fg)", minWidth: 56 }}>
          {formatElapsed(elapsedMs(active, now))}
        </span>
        <span className="text-fg-soft" style={{ fontSize: 10 }}>
          {running ? "running" : "paused"}
        </span>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => start(name)}
      className="t-mono"
      style={{
        padding: "4px 12px",
        border: "1px solid var(--rule)",
        borderRadius: 6,
        background: "oklch(from var(--bg) l c h / 0.6)",
        color: "var(--fg)",
        cursor: "pointer",
        fontSize: 11,
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        whiteSpace: "nowrap",
      }}
      title={
        otherActive
          ? `Will replace active timer on "${otherActive.project}"`
          : undefined
      }
    >
      <span style={{ color: "var(--c-good)" }}>●</span> start timer
      {otherActive && (
        <span className="text-fg-soft" style={{ fontSize: 10 }}>
          (replace)
        </span>
      )}
    </button>
  );
}
