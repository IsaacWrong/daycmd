"use client";

import { useEffect, useRef, useState } from "react";
import type { SkillDef } from "@/lib/skills-defs";
import { UsageStrip } from "./UsageStrip";

type Msg = {
  role: "user" | "assistant";
  content: string;
  tools?: Array<{ name: string; ok?: boolean }>;
};

export function AgentPanel() {
  const [skills, setSkills] = useState<SkillDef[]>([]);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch("/api/agent/skills")
      .then((r) => r.json())
      .then((j) => setSkills(j.skills ?? []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages]);

  async function send(content: string) {
    if (!content.trim() || busy) return;
    setError(null);
    const next: Msg[] = [
      ...messages,
      { role: "user", content },
      { role: "assistant", content: "", tools: [] },
    ];
    setMessages(next);
    setInput("");
    setBusy(true);

    const apiMessages = next
      .slice(0, -1)
      .map((m) => ({ role: m.role, content: m.content }));

    try {
      const res = await fetch("/api/agent", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ messages: apiMessages }),
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
          const ev = JSON.parse(line.slice(6)) as {
            type: string;
            data: unknown;
          };
          if (ev.type === "text") {
            const delta = ev.data as string;
            setMessages((prev) => {
              const copy = [...prev];
              copy[copy.length - 1] = {
                ...copy[copy.length - 1],
                content: copy[copy.length - 1].content + delta,
              };
              return copy;
            });
          } else if (ev.type === "tool_start") {
            const d = ev.data as { name: string };
            setMessages((prev) => {
              const copy = [...prev];
              const last = copy[copy.length - 1];
              copy[copy.length - 1] = {
                ...last,
                tools: [...(last.tools ?? []), { name: d.name }],
              };
              return copy;
            });
          } else if (ev.type === "tool_result") {
            const d = ev.data as { name: string; ok: boolean };
            setMessages((prev) => {
              const copy = [...prev];
              const last = copy[copy.length - 1];
              const tools = [...(last.tools ?? [])];
              const idx = tools.findIndex((t) => t.name === d.name && t.ok === undefined);
              if (idx >= 0) tools[idx] = { ...tools[idx], ok: d.ok };
              copy[copy.length - 1] = { ...last, tools };
              return copy;
            });
          } else if (ev.type === "error") {
            setError(String(ev.data));
          }
        }
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-5 lg:col-span-4 flex flex-col min-h-[480px]">
      <header className="flex items-center justify-between mb-3 gap-4 flex-wrap">
        <div className="flex items-center gap-4">
          <h2 className="text-sm font-medium uppercase tracking-wider text-zinc-400">
            Agent
          </h2>
          <UsageStrip />
        </div>
        <div className="flex gap-1.5 flex-wrap">
          {skills.map((s) => (
            <button
              key={s.id}
              disabled={busy}
              onClick={() => send(s.prompt)}
              title={s.description}
              className="text-xs px-2 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-200 disabled:opacity-50"
            >
              {s.label}
            </button>
          ))}
          {messages.length > 0 && (
            <button
              onClick={() => setMessages([])}
              disabled={busy}
              className="text-xs px-2 py-1 rounded text-zinc-500 hover:text-zinc-300"
            >
              Clear
            </button>
          )}
        </div>
      </header>

      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto space-y-4 min-h-[280px] max-h-[520px] pr-2"
      >
        {messages.length === 0 && (
          <p className="text-sm text-zinc-500">
            Ask anything. Or hit a skill button. Tools available: tasks, daily note,
            inbox, calendar, GitHub, past notes.
          </p>
        )}
        {messages.map((m, i) => (
          <div key={i} className="text-sm">
            <div className="text-xs uppercase tracking-wider text-zinc-500 mb-1">
              {m.role === "user" ? "You" : "Agent"}
            </div>
            {m.tools && m.tools.length > 0 && (
              <div className="flex flex-wrap gap-1 mb-1.5">
                {m.tools.map((t, ti) => (
                  <span
                    key={ti}
                    className={
                      "text-[10px] px-1.5 py-0.5 rounded font-mono " +
                      (t.ok === undefined
                        ? "bg-zinc-800 text-zinc-400"
                        : t.ok
                          ? "bg-emerald-950 text-emerald-300"
                          : "bg-red-950 text-red-300")
                    }
                  >
                    {t.ok === undefined ? "·" : t.ok ? "✓" : "✗"} {t.name}
                  </span>
                ))}
              </div>
            )}
            <div className="whitespace-pre-wrap text-zinc-100 leading-relaxed">
              {m.content || (m.role === "assistant" && busy && i === messages.length - 1 ? "…" : "")}
            </div>
          </div>
        ))}
      </div>

      {error && <p className="text-sm text-red-400 mt-2">{error}</p>}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          send(input);
        }}
        className="mt-3 flex gap-2"
      >
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={busy ? "Working…" : "Ask anything…"}
          disabled={busy}
          className="flex-1 bg-zinc-950 border border-zinc-800 rounded-md px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:border-zinc-600 disabled:opacity-50"
        />
        <button
          type="submit"
          disabled={busy || !input.trim()}
          className="px-4 py-2 rounded-md bg-zinc-100 text-zinc-900 text-sm font-medium hover:bg-white disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Send
        </button>
      </form>
    </section>
  );
}
