"use client";

import { useEffect, useRef, useState } from "react";
import type { SkillDef } from "@/lib/skills-defs";
import { UsageStrip } from "./UsageStrip";
import { Markdown } from "./Markdown";

const CATEGORY_LS_KEY = "ai-os.agent.category";
const MESSAGES_LS_KEY = (cat: string) => `ai-os.agent.messages.${cat}`;
const CONTAINER_LS_KEY = (cat: string) => `ai-os.agent.container.${cat}`;
const BUSY_EVENT = "ai-os:agent-busy";
const RUN_SKILL_EVENT = "ai-os:run-skill";

type Msg = {
  role: "user" | "assistant";
  content: string;
  tools?: Array<{ name: string; ok?: boolean }>;
};

function loadMessages(cat: string): Msg[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(MESSAGES_LS_KEY(cat));
    return raw ? (JSON.parse(raw) as Msg[]) : [];
  } catch {
    return [];
  }
}

function saveMessages(cat: string, msgs: Msg[]): void {
  if (typeof window === "undefined") return;
  if (msgs.length === 0) localStorage.removeItem(MESSAGES_LS_KEY(cat));
  else localStorage.setItem(MESSAGES_LS_KEY(cat), JSON.stringify(msgs));
}

function loadContainer(cat: string): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(CONTAINER_LS_KEY(cat));
}

function saveContainer(cat: string, id: string | null): void {
  if (typeof window === "undefined") return;
  if (id) localStorage.setItem(CONTAINER_LS_KEY(cat), id);
  else localStorage.removeItem(CONTAINER_LS_KEY(cat));
}

export function AgentPanel() {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [categories, setCategories] = useState<string[]>(["Personal"]);
  const [category, setCategory] = useState("Personal");
  const [hydrated, setHydrated] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Broadcast busy state for SkillsPanel
  useEffect(() => {
    window.dispatchEvent(new CustomEvent(BUSY_EVENT, { detail: busy }));
  }, [busy]);

  useEffect(() => {
    fetch("/api/kb")
      .then((r) => r.json())
      .then((j: { categories: Array<{ name: string }> }) => {
        const names = (j.categories ?? []).map((c) => c.name);
        if (names.length) setCategories(names);
        const saved =
          typeof window !== "undefined"
            ? localStorage.getItem(CATEGORY_LS_KEY)
            : null;
        const useCat = saved && names.includes(saved) ? saved : "Personal";
        setCategory(useCat);
        setMessages(loadMessages(useCat));
        setHydrated(true);
      })
      .catch(() => setHydrated(true));
  }, []);

  // Persist category choice
  useEffect(() => {
    if (!hydrated) return;
    if (typeof window !== "undefined") {
      localStorage.setItem(CATEGORY_LS_KEY, category);
    }
    // When category changes, load that category's thread
    setMessages(loadMessages(category));
  }, [category, hydrated]);

  // Persist messages on every change
  useEffect(() => {
    if (!hydrated) return;
    saveMessages(category, messages);
  }, [messages, category, hydrated]);

  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages]);

  // Listen for skill clicks from SkillsPanel
  const sendRef = useRef<((content: string, skill?: SkillDef) => void) | null>(null);
  useEffect(() => {
    function handler(e: Event) {
      const skill = (e as CustomEvent<SkillDef>).detail;
      if (!skill || !sendRef.current) return;
      sendRef.current(skill.prompt, skill);
    }
    window.addEventListener(RUN_SKILL_EVENT, handler);
    return () => window.removeEventListener(RUN_SKILL_EVENT, handler);
  }, []);

  async function send(content: string, skill?: SkillDef) {
    if (!content.trim() || busy) return;
    setError(null);
    const useCategory = skill?.category ?? category;
    const existing =
      useCategory === category ? messages : loadMessages(useCategory);
    const next: Msg[] = [
      ...existing,
      { role: "user", content },
      { role: "assistant", content: "", tools: [] },
    ];
    // Persist BEFORE switching category so the [category] effect's
    // loadMessages() picks up the placeholder, not stale data.
    saveMessages(useCategory, next);
    if (useCategory !== category) setCategory(useCategory);
    setMessages(next);
    setInput("");
    setBusy(true);

    const apiMessages = next
      .slice(0, -1)
      .map((m) => ({ role: m.role, content: m.content }));
    const containerId = loadContainer(useCategory);

    try {
      const res = await fetch("/api/agent", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          messages: apiMessages,
          category: useCategory,
          ...(containerId ? { containerId } : {}),
          ...(skill?.model ? { model: skill.model } : {}),
          ...(skill?.effort ? { effort: skill.effort } : {}),
          ...(skill?.maxTokens ? { maxTokens: skill.maxTokens } : {}),
        }),
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
              if (prev.length === 0) return prev;
              const copy = [...prev];
              const last = copy[copy.length - 1];
              if (!last) return prev;
              copy[copy.length - 1] = {
                ...last,
                content: last.content + delta,
              };
              return copy;
            });
          } else if (ev.type === "tool_start") {
            const d = ev.data as { name: string };
            setMessages((prev) => {
              if (prev.length === 0) return prev;
              const copy = [...prev];
              const last = copy[copy.length - 1];
              if (!last) return prev;
              copy[copy.length - 1] = {
                ...last,
                tools: [...(last.tools ?? []), { name: d.name }],
              };
              return copy;
            });
          } else if (ev.type === "tool_result") {
            const d = ev.data as { name: string; ok: boolean };
            setMessages((prev) => {
              if (prev.length === 0) return prev;
              const copy = [...prev];
              const last = copy[copy.length - 1];
              if (!last) return prev;
              const tools = [...(last.tools ?? [])];
              const idx = tools.findIndex(
                (t) => t.name === d.name && t.ok === undefined,
              );
              if (idx >= 0) tools[idx] = { ...tools[idx], ok: d.ok };
              copy[copy.length - 1] = { ...last, tools };
              return copy;
            });
          } else if (ev.type === "container") {
            saveContainer(useCategory, String(ev.data));
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

  function clearThread() {
    setMessages([]);
    saveContainer(category, null);
  }

  // keep ref to latest send for skill listener
  useEffect(() => {
    sendRef.current = send;
  });

  return (
    <section className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-5 lg:col-span-3 flex flex-col min-h-[480px]">
      <header className="flex items-center justify-between mb-3 gap-4 flex-wrap">
        <div className="flex items-center gap-4">
          <h2 className="text-sm font-medium uppercase tracking-wider text-zinc-400">
            Agent
          </h2>
          <UsageStrip />
        </div>
        <div className="flex gap-1.5 flex-wrap items-center">
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            disabled={busy}
            className="text-xs bg-zinc-800 border border-zinc-700 rounded px-2 py-1 text-zinc-200"
            title="Category — each category has its own thread + raw/ log"
          >
            {categories.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          {messages.length > 0 && (
            <button
              onClick={clearThread}
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
            Ask anything. Or hit a skill button. Each category has its own
            thread.
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
            {m.role === "assistant" ? (
              m.content ? (
                <Markdown>{m.content}</Markdown>
              ) : busy && i === messages.length - 1 ? (
                <span className="text-zinc-500">…</span>
              ) : null
            ) : (
              <div className="whitespace-pre-wrap text-zinc-100 leading-relaxed">
                {m.content}
              </div>
            )}
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
