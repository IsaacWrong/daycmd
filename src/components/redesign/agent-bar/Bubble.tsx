import { Markdown } from "@/components/Markdown";
import type { Msg } from "../useAgent";

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
                  background: "oklch(from var(--fg) l c h / 0.06)",
                }}
              >
                {t.ok === undefined ? "·" : t.ok ? "✓" : "✗"} {t.name}
              </span>
            ))}
          </div>
        )}
        {isUser ? (
          <div className="whitespace-pre-wrap">{m.content}</div>
        ) : m.content ? (
          <Markdown>{m.content}</Markdown>
        ) : busy ? (
          <span className="text-fg-soft">…</span>
        ) : null}
      </div>
    </div>
  );
}
