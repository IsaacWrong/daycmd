"use client";

import { useEffect, useRef, useState } from "react";
import { SKILLS } from "@/lib/skills-defs";
import { mutate } from "@/lib/hooks";

type TriageMsg = {
  role: "user" | "assistant";
  content: string;
  tools: Array<{ name: string; ok?: boolean }>;
};

type Props = {
  onClose: () => void;
};

export function TriagePanel({ onClose }: Props) {
  const [messages, setMessages] = useState<TriageMsg[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const containerIdRef = useRef<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const started = useRef(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const skill = SKILLS.find((s) => s.id === "triage");

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    if (!skill) {
      setError("triage skill not found");
      return;
    }
    void send(skill.prompt, /*isInitial*/ true);
    return () => {
      abortRef.current?.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [messages]);

  function invalidateCaches() {
    mutate("gmail:threads:inbox");
    mutate("gmail:labels");
    mutate("gmail:drafts");
  }

  async function send(content: string, isInitial = false) {
    if (busy) return;
    if (!skill) return;
    setError(null);
    setBusy(true);

    const userMsg: TriageMsg = { role: "user", content, tools: [] };
    const startedMessages = isInitial
      ? [userMsg, { role: "assistant" as const, content: "", tools: [] }]
      : [...messages, userMsg, { role: "assistant" as const, content: "", tools: [] }];
    setMessages(startedMessages);

    const apiMessages = startedMessages
      .slice(0, -1)
      .map((m) => ({ role: m.role, content: m.content }));

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const res = await fetch("/api/agent", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          messages: apiMessages,
          category: skill.category ?? "Personal",
          ...(containerIdRef.current ? { containerId: containerIdRef.current } : {}),
          ...(skill.id ? { skillId: skill.id } : {}),
        }),
        signal: controller.signal,
      });
      if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`);
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const lines = buf.split("\n\n");
        buf = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const ev = JSON.parse(line.slice(6)) as { type: string; data: unknown };
          if (ev.type === "text") {
            const delta = ev.data as string;
            setMessages((prev) => {
              const copy = [...prev];
              const last = copy[copy.length - 1];
              if (!last) return prev;
              copy[copy.length - 1] = { ...last, content: last.content + delta };
              return copy;
            });
          } else if (ev.type === "tool_start") {
            const d = ev.data as { name: string };
            setMessages((prev) => {
              const copy = [...prev];
              const last = copy[copy.length - 1];
              if (!last) return prev;
              copy[copy.length - 1] = {
                ...last,
                tools: [...last.tools, { name: d.name }],
              };
              return copy;
            });
            if (
              /gmail_(archive|trash|mark|star|unsubscribe|draft|label)/i.test(
                d.name,
              )
            ) {
              invalidateCaches();
            }
          } else if (ev.type === "tool_result") {
            const d = ev.data as { name: string; ok: boolean };
            setMessages((prev) => {
              const copy = [...prev];
              const last = copy[copy.length - 1];
              if (!last) return prev;
              const tools = [...last.tools];
              const idx = tools.findIndex(
                (t) => t.name === d.name && t.ok === undefined,
              );
              if (idx >= 0) tools[idx] = { ...tools[idx], ok: d.ok };
              copy[copy.length - 1] = { ...last, tools };
              return copy;
            });
          } else if (ev.type === "container") {
            containerIdRef.current = String(ev.data);
          } else if (ev.type === "error") {
            setError(String(ev.data));
          }
        }
      }
      invalidateCaches();
    } catch (e) {
      if ((e as Error).name !== "AbortError") {
        setError((e as Error).message);
      }
    } finally {
      abortRef.current = null;
      setBusy(false);
    }
  }

  function stop() {
    abortRef.current?.abort();
  }

  function onSubmit() {
    const v = input.trim();
    if (!v || busy) return;
    setInput("");
    void send(v);
  }

  function reset() {
    abortRef.current?.abort();
    setMessages([]);
    containerIdRef.current = null;
    started.current = false;
    if (skill) {
      started.current = true;
      void send(skill.prompt, true);
    }
  }

  return (
    <>
      <header
        className="flex items-center gap-2 px-5"
        style={{ height: 56, borderBottom: "1px solid var(--rule)", flexShrink: 0 }}
      >
        <span className="src-dot src-agent" style={{ width: 8, height: 8 }} />
        <h3 className="m-0 text-[15px] font-medium" style={{ letterSpacing: "-0.01em" }}>
          AI Triage
        </h3>
        <span className="text-fg-soft text-[12px]">
          {busy ? "running…" : "ready"}
        </span>
        <span className="flex-1" />
        {busy && (
          <button onClick={stop} className="cal-pill">
            Stop
          </button>
        )}
        {!busy && messages.length > 0 && (
          <button onClick={reset} className="cal-pill">
            Restart
          </button>
        )}
        <button onClick={onClose} className="cal-icon-btn" aria-label="Close">
          ✕
        </button>
      </header>

      <div
        ref={scrollRef}
        className="flex-1 min-h-0 overflow-y-auto scroll"
        style={{ padding: "12px 16px" }}
      >
        {error && (
          <div
            className="text-[12px] mb-3"
            style={{
              color: "var(--c-error)",
              whiteSpace: "pre-wrap",
              padding: "8px 10px",
              border: "1px solid var(--c-error)",
              borderRadius: 8,
            }}
          >
            {error}
          </div>
        )}

        {messages.map((m, i) => (
          <TurnView key={i} msg={m} isFirstUser={i === 0 && m.role === "user"} />
        ))}
      </div>

      <div
        style={{
          borderTop: "1px solid var(--rule)",
          padding: "10px 14px",
          flexShrink: 0,
        }}
      >
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
              e.preventDefault();
              onSubmit();
            }
          }}
          placeholder={
            busy
              ? "Agent running…"
              : "Reply to agent (e.g. \"yes, unsubscribe 1, 3, 5\")"
          }
          rows={3}
          className="cal-input"
          style={{
            width: "100%",
            resize: "vertical",
            fontFamily: "inherit",
          }}
          disabled={busy}
        />
        <div className="flex items-center gap-2 mt-2">
          <span className="text-fg-soft text-[11px]">⌘↵ to send</span>
          <span className="flex-1" />
          <button
            onClick={onSubmit}
            className="cal-primary-btn"
            disabled={busy || !input.trim()}
          >
            Send
          </button>
        </div>
      </div>
    </>
  );
}

function TurnView({ msg, isFirstUser }: { msg: TriageMsg; isFirstUser: boolean }) {
  if (msg.role === "user") {
    // Hide the initial canned skill prompt to reduce noise.
    if (isFirstUser) return null;
    return (
      <div
        style={{
          padding: "8px 12px",
          marginBottom: 10,
          background: "color-mix(in srgb, var(--c-gmail) 8%, transparent)",
          borderLeft: "2px solid var(--c-gmail)",
          borderRadius: 6,
          fontSize: 13,
          whiteSpace: "pre-wrap",
        }}
      >
        {msg.content}
      </div>
    );
  }
  return (
    <div style={{ marginBottom: 14 }}>
      {msg.tools.length > 0 && (
        <div
          style={{
            padding: "8px 10px",
            border: "1px solid var(--rule)",
            borderRadius: 8,
            marginBottom: 8,
            background: "oklch(from var(--fg) l c h / 0.03)",
          }}
        >
          <div className="t-eyebrow" style={{ marginBottom: 6 }}>
            actions · {msg.tools.length}
          </div>
          <div className="flex flex-wrap gap-1.5">
            {msg.tools.map((t, i) => (
              <span
                key={i}
                className="t-mono text-[10.5px]"
                style={{
                  padding: "2px 6px",
                  borderRadius: 4,
                  background:
                    t.ok === undefined
                      ? "oklch(from var(--fg) l c h / 0.06)"
                      : t.ok
                        ? "color-mix(in srgb, var(--c-good) 18%, transparent)"
                        : "color-mix(in srgb, var(--c-error) 18%, transparent)",
                  color: t.ok === undefined ? "var(--fg-soft)" : "var(--fg)",
                }}
              >
                {t.name}
                {t.ok === false && " ✗"}
              </span>
            ))}
          </div>
        </div>
      )}
      <div
        className="text-[13px]"
        style={{
          whiteSpace: "pre-wrap",
          lineHeight: 1.55,
          letterSpacing: "-0.005em",
        }}
      >
        {msg.content || ""}
      </div>
    </div>
  );
}
