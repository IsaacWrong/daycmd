import { useEffect, useRef } from "react";
import { Markdown } from "@/components/Markdown";
import type { Msg } from "../useAgent";

export function ThreadView({ messages, busy }: { messages: Msg[]; busy: boolean }) {
  const scrollRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages]);
  return (
    <div
      ref={scrollRef}
      className="scroll flex-1 min-h-0 overflow-y-auto pr-1 flex flex-col gap-[18px]"
    >
      {messages.map((m, i) => (
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
          </div>
          {m.tools && m.tools.length > 0 && (
            <div className="flex flex-wrap gap-1 mb-1.5">
              {m.tools.map((t, ti) => (
                <span
                  key={ti}
                  className="t-mono"
                  style={{
                    fontSize: 10,
                    padding: "1px 6px",
                    borderRadius: 4,
                    color:
                      t.ok === undefined
                        ? "var(--fg-soft)"
                        : t.ok
                          ? "var(--c-good)"
                          : "var(--c-error)",
                    background: "oklch(from var(--fg) l c h / 0.04)",
                  }}
                >
                  {t.ok === undefined ? "·" : t.ok ? "✓" : "✗"} {t.name}
                </span>
              ))}
            </div>
          )}
          {m.role === "assistant" ? (
            m.content ? (
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
            ) : busy && i === messages.length - 1 ? (
              <span className="text-fg-soft">…</span>
            ) : null
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
      ))}
    </div>
  );
}
