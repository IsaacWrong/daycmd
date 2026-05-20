"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  elapsedMs,
  formatElapsed,
  isRunning,
  useActiveTimer,
} from "@/lib/timer";

export function GlobalTimerDock() {
  const { state, hydrated, pause, resume, stop, discard } = useActiveTimer();
  const [now, setNow] = useState(() => Date.now());
  const [stopping, setStopping] = useState(false);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isRunning(state)) return;
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [state]);

  if (!hydrated || !state) return null;

  const running = isRunning(state);
  const elapsed = elapsedMs(state, now);

  async function commit(withNote: string) {
    setBusy(true);
    setError(null);
    const result = await stop(withNote);
    setBusy(false);
    if ("error" in result) {
      setError(result.error);
      return;
    }
    setStopping(false);
    setNote("");
  }

  function handleStopClick() {
    if (running) pause();
    setStopping(true);
    setError(null);
  }

  function cancelStopFlow() {
    setStopping(false);
    setNote("");
    setError(null);
    if (!running) resume();
  }

  return (
    <div
      role="region"
      aria-label="Active project timer"
      style={{
        position: "fixed",
        left: 16,
        bottom: 16,
        zIndex: 80,
        minWidth: stopping ? 320 : 220,
        maxWidth: 360,
        padding: "10px 12px",
        border: "1px solid var(--rule)",
        borderRadius: 12,
        background: "oklch(from var(--bg-a) l c h / 0.92)",
        backdropFilter: "blur(10px)",
        boxShadow: "0 10px 30px oklch(0 0 0 / 0.25)",
        fontSize: 12,
        whiteSpace: "nowrap",
      }}
    >
      <div className="flex items-center gap-2">
        <span
          className="src-dot"
          style={{
            width: 7,
            height: 7,
            background: running ? "var(--c-good)" : "var(--fg-soft)",
            flexShrink: 0,
          }}
        />
        <Link
          href={`/projects/${encodeURIComponent(state.project)}`}
          className="hover:text-fg"
          style={{
            color: "var(--fg)",
            overflow: "hidden",
            textOverflow: "ellipsis",
            flex: 1,
            minWidth: 0,
          }}
          title={state.project}
        >
          {state.project}
        </Link>
        <span
          className="t-mono t-num"
          style={{ color: "var(--fg)", minWidth: 56, textAlign: "right" }}
        >
          {formatElapsed(elapsed)}
        </span>
      </div>

      {!stopping && (
        <div className="flex items-center gap-2 mt-2">
          <button
            type="button"
            onClick={running ? pause : resume}
            className="t-mono"
            style={btn()}
          >
            {running ? "pause" : "resume"}
          </button>
          <button
            type="button"
            onClick={handleStopClick}
            className="t-mono"
            style={btn()}
          >
            stop
          </button>
          <span className="flex-1" />
          <button
            type="button"
            onClick={discard}
            className="t-mono text-fg-soft hover:text-fg"
            style={{
              background: "transparent",
              border: 0,
              padding: "3px 4px",
              cursor: "pointer",
              fontSize: 11,
            }}
            title="Discard timer without logging"
          >
            ✕ discard
          </button>
        </div>
      )}

      {stopping && (
        <div className="mt-2 flex flex-col gap-2">
          <textarea
            autoFocus
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="What did you work on? (optional)"
            disabled={busy}
            rows={2}
            style={{
              width: "100%",
              resize: "vertical",
              background: "transparent",
              border: "1px solid var(--rule)",
              borderRadius: 6,
              padding: "6px 8px",
              color: "var(--fg)",
              outline: 0,
              fontSize: 12,
              fontFamily: "inherit",
              whiteSpace: "normal",
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                void commit(note);
              }
            }}
          />
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => void commit(note)}
              disabled={busy}
              className="t-mono"
              style={btn(busy)}
            >
              {busy ? "saving…" : "save"}
            </button>
            <button
              type="button"
              onClick={() => void commit("")}
              disabled={busy}
              className="t-mono text-fg-soft hover:text-fg"
              style={{
                background: "transparent",
                border: 0,
                padding: "3px 4px",
                cursor: busy ? "default" : "pointer",
                fontSize: 11,
              }}
            >
              skip note
            </button>
            <span className="flex-1" />
            <button
              type="button"
              onClick={cancelStopFlow}
              disabled={busy}
              className="t-mono text-fg-soft hover:text-fg"
              style={{
                background: "transparent",
                border: 0,
                padding: "3px 4px",
                cursor: busy ? "default" : "pointer",
                fontSize: 11,
              }}
            >
              cancel
            </button>
          </div>
          {error && (
            <span style={{ color: "var(--c-error)", fontSize: 11 }}>{error}</span>
          )}
        </div>
      )}
    </div>
  );
}

function btn(busy = false): React.CSSProperties {
  return {
    padding: "3px 10px",
    border: "1px solid var(--rule)",
    borderRadius: 6,
    background: "oklch(from var(--bg-a) l c h / 0.6)",
    color: "var(--fg)",
    cursor: busy ? "default" : "pointer",
    fontSize: 11,
    opacity: busy ? 0.6 : 1,
  };
}
