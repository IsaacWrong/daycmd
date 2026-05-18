import { useEffect, useRef, useState } from "react";
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

function StatusBlock({ msg, now }: { msg: Msg; now: number }) {
  const start = msg.startedAt ?? now;
  const elapsed = now - start;
  const frame = SPINNER_FRAMES[Math.floor(now / 100) % SPINNER_FRAMES.length];
  return (
    <div
      className="t-mono mt-2"
      style={{
        fontSize: 11.5,
        padding: "8px 10px",
        borderRadius: 6,
        border: "1px solid oklch(from var(--fg) l c h / 0.08)",
        background: "oklch(from var(--fg) l c h / 0.03)",
        color: "var(--fg-soft)",
        lineHeight: 1.5,
      }}
    >
      <div style={{ color: "var(--fg)" }}>
        <span style={{ color: "var(--c-agent)" }}>{frame}</span>{" "}
        {currentStage(msg)}
        <span style={{ marginLeft: 8, color: "var(--fg-soft)" }}>
          {fmtElapsed(elapsed)}
        </span>
      </div>
    </div>
  );
}

export function ThreadView({ messages, busy }: { messages: Msg[]; busy: boolean }) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const now = useTicker(busy);
  const last = messages[messages.length - 1];
  const lastContentLen = last?.content.length ?? 0;
  const lastToolsLen = last?.tools?.length ?? 0;
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 200;
    if (!busy || nearBottom) {
      el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
    }
  }, [messages.length, lastContentLen, lastToolsLen, busy]);
  return (
    <div
      ref={scrollRef}
      className="scroll flex-1 min-h-0 overflow-y-auto pr-1 flex flex-col gap-[18px]"
    >
      {messages.map((m, i) => {
        const isLast = i === messages.length - 1;
        const isWorking = busy && isLast && m.role === "assistant";
        return (
          <div key={i}>
            <div
              className="t-mono uppercase mb-1.5"
              style={{
                fontSize: 10,
                color: m.role === "user" ? "var(--c-agent)" : "var(--fg-soft)",
                letterSpacing: "0.04em",
              }}
            >
              {m.role === "user" ? "you" : "claude"}
              {m.role === "assistant" && !isWorking && m.startedAt && m.endedAt && (
                <span
                  style={{
                    marginLeft: 8,
                    color: "var(--fg-soft)",
                    textTransform: "none",
                    letterSpacing: 0,
                  }}
                >
                  {fmtElapsed(m.endedAt - m.startedAt)}
                </span>
              )}
            </div>
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
                        background: "oklch(from var(--fg) l c h / 0.04)",
                      }}
                    >
                      {running
                        ? SPINNER_FRAMES[
                            Math.floor(now / 100) % SPINNER_FRAMES.length
                          ]
                        : t.ok
                          ? "✓"
                          : "✗"}{" "}
                      {t.name}
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
            {m.role === "assistant" ? (
              <>
                {m.content && (
                  <div
                    style={{
                      fontSize: 14.5,
                      lineHeight: 1.55,
                      color: "var(--fg)",
                      letterSpacing: "-0.005em",
                      textWrap: "pretty",
                    }}
                  >
                    <Markdown>{m.content}</Markdown>
                  </div>
                )}
                {isWorking && <StatusBlock msg={m} now={now} />}
              </>
            ) : (
              <div
                className="whitespace-pre-wrap"
                style={{
                  fontSize: 14.5,
                  lineHeight: 1.55,
                  color: "var(--fg)",
                  letterSpacing: "-0.005em",
                }}
              >
                {m.content}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
