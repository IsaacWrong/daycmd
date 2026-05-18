import { useEffect, useState } from "react";
import { Markdown } from "@/components/Markdown";
import type { Msg } from "../useAgent";

const SPINNER_FRAMES = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];

function fmtElapsed(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  const s = ms / 1000;
  if (s < 60) return `${s.toFixed(s < 10 ? 1 : 0)}s`;
  const m = Math.floor(s / 60);
  const rem = Math.floor(s % 60);
  return `${m}m${rem.toString().padStart(2, "0")}s`;
}

function useTicker(active: boolean, intervalMs = 200): number {
  const [, force] = useState(0);
  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => force((n) => (n + 1) % 1_000_000), intervalMs);
    return () => clearInterval(id);
  }, [active, intervalMs]);
  return Date.now();
}

function currentStage(m: Msg): string {
  const running = m.tools?.find((t) => t.ok === undefined);
  if (running) return `running ${running.name}`;
  if (m.tools && m.tools.length > 0 && !m.content) return "processing tool results";
  if (m.content) return "writing response";
  return "thinking";
}

export function Bubble({
  m,
  animate,
  busy,
}: {
  m: Msg;
  animate: boolean;
  busy: boolean;
}) {
  const isUser = m.role === "user";
  const now = useTicker(busy);
  const frame = SPINNER_FRAMES[Math.floor(now / 100) % SPINNER_FRAMES.length];
  return (
    <div
      className={animate ? "agent-bubble-enter" : undefined}
      style={{
        display: "flex",
        justifyContent: isUser ? "flex-end" : "flex-start",
      }}
    >
      <div className={isUser ? "agent-bubble-user" : "agent-bubble-claude"}>
        {m.tools && m.tools.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-1.5">
            {m.tools.map((t, ti) => {
              const running = t.ok === undefined;
              const dur = running
                ? t.startedAt
                  ? now - t.startedAt
                  : 0
                : t.durationMs;
              return (
                <span
                  key={ti}
                  className="t-mono"
                  style={{
                    fontSize: 10,
                    padding: "1px 6px",
                    borderRadius: 4,
                    color: running
                      ? "var(--c-agent)"
                      : t.ok
                        ? "var(--c-good)"
                        : "var(--c-error)",
                    background: "oklch(from var(--fg) l c h / 0.06)",
                  }}
                >
                  {running ? frame : t.ok ? "✓" : "✗"} {t.name}
                  {dur !== undefined && dur > 0 && (
                    <span style={{ marginLeft: 6, color: "var(--fg-soft)" }}>
                      {fmtElapsed(dur)}
                    </span>
                  )}
                </span>
              );
            })}
          </div>
        )}
        {isUser ? (
          <div className="whitespace-pre-wrap">{m.content}</div>
        ) : (
          <>
            {m.content && <Markdown>{m.content}</Markdown>}
            {busy && (
              <div
                className="t-mono"
                style={{
                  marginTop: m.content ? 8 : 0,
                  fontSize: 11.5,
                  padding: "6px 10px",
                  borderRadius: 6,
                  border: "1px solid oklch(from var(--fg) l c h / 0.1)",
                  background: "oklch(from var(--fg) l c h / 0.04)",
                  color: "var(--fg-soft)",
                  lineHeight: 1.5,
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 8,
                }}
              >
                <span style={{ color: "var(--c-agent)" }}>{frame}</span>
                <span style={{ color: "var(--fg)" }}>{currentStage(m)}</span>
                <span>{fmtElapsed(now - (m.startedAt ?? now))}</span>
              </div>
            )}
            {!busy && m.startedAt && m.endedAt && (
              <div
                className="t-mono mt-1"
                style={{ fontSize: 10, color: "var(--fg-soft)" }}
              >
                {fmtElapsed(m.endedAt - m.startedAt)}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
