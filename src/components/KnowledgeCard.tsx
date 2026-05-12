"use client";

import { useEffect, useState } from "react";
import { usePoll } from "@/lib/hooks";
import { format } from "date-fns";

type Stats = {
  name: string;
  rawCount: number;
  wikiCount: number;
  outputCount: number;
  lastRawAt: number | null;
  lastCompileAt: number | null;
  driftCount: number;
};

type Resp = { categories: Stats[] };

function fmt(ms: number | null): string {
  if (!ms) return "—";
  return format(new Date(ms), "MMM d HH:mm");
}

export function KnowledgeCard() {
  const { data, refresh } = usePoll<Resp>("/api/kb", 30_000);
  const [compiling, setCompiling] = useState<string | null>(null);
  const [compileOutput, setCompileOutput] = useState<{
    category: string;
    lines: string[];
    tools: Array<{ name: string; ok?: boolean }>;
    done: boolean;
    error?: string;
  } | null>(null);
  const [newCatName, setNewCatName] = useState("");
  const [showNewCat, setShowNewCat] = useState(false);

  useEffect(() => {
    if (compileOutput?.done) {
      const t = setTimeout(() => refresh(), 500);
      return () => clearTimeout(t);
    }
  }, [compileOutput, refresh]);

  async function compile(category: string) {
    setCompiling(category);
    setCompileOutput({ category, lines: [], tools: [], done: false });
    try {
      const res = await fetch(
        `/api/kb/${encodeURIComponent(category)}/compile`,
        { method: "POST" },
      );
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
          setCompileOutput((prev) => {
            if (!prev) return prev;
            if (ev.type === "text") {
              return { ...prev, lines: [...prev.lines, ev.data as string] };
            }
            if (ev.type === "tool_start") {
              const d = ev.data as { name: string };
              return { ...prev, tools: [...prev.tools, { name: d.name }] };
            }
            if (ev.type === "tool_result") {
              const d = ev.data as { name: string; ok: boolean };
              const tools = [...prev.tools];
              const idx = tools.findIndex(
                (t) => t.name === d.name && t.ok === undefined,
              );
              if (idx >= 0) tools[idx] = { ...tools[idx], ok: d.ok };
              return { ...prev, tools };
            }
            if (ev.type === "done") return { ...prev, done: true };
            if (ev.type === "error")
              return { ...prev, done: true, error: String(ev.data) };
            return prev;
          });
        }
      }
    } catch (e) {
      setCompileOutput((prev) =>
        prev ? { ...prev, done: true, error: (e as Error).message } : prev,
      );
    } finally {
      setCompiling(null);
    }
  }

  async function createCategory() {
    if (!newCatName.trim()) return;
    await fetch("/api/kb", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: newCatName.trim() }),
    });
    setNewCatName("");
    setShowNewCat(false);
    refresh();
  }

  return (
    <section className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-5 min-h-[280px] lg:col-span-2">
      <header className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-medium uppercase tracking-wider text-zinc-400">
          Knowledge
        </h2>
        <button
          onClick={() => setShowNewCat((v) => !v)}
          className="text-xs px-2 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-200"
        >
          {showNewCat ? "Cancel" : "+ Category"}
        </button>
      </header>

      {showNewCat && (
        <div className="mb-3 flex gap-2">
          <input
            value={newCatName}
            onChange={(e) => setNewCatName(e.target.value)}
            placeholder="Category name (e.g. Reading)"
            className="flex-1 bg-zinc-900 border border-zinc-800 rounded px-2 py-1.5 text-sm text-zinc-100"
          />
          <button
            onClick={createCategory}
            className="text-xs px-3 py-1 rounded bg-zinc-100 text-zinc-900 font-medium"
          >
            Create
          </button>
        </div>
      )}

      <div className="space-y-1.5">
        {(data?.categories ?? []).map((c) => (
          <div
            key={c.name}
            className="p-2 rounded-lg border border-zinc-800 bg-zinc-950/30"
          >
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-sm text-zinc-100 truncate">{c.name}</span>
                <span className="text-[10px] font-mono text-zinc-500 shrink-0">
                  raw {c.rawCount} · wiki {c.wikiCount} · out {c.outputCount}
                </span>
                {c.driftCount > 0 && (
                  <span
                    className="text-[10px] px-1 py-0.5 rounded bg-amber-950 text-amber-300 shrink-0"
                    title={`${c.driftCount} raws since last compile`}
                  >
                    +{c.driftCount}
                  </span>
                )}
              </div>
              <button
                onClick={() => compile(c.name)}
                disabled={compiling !== null}
                className="text-[11px] px-2 py-0.5 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-200 disabled:opacity-50 shrink-0"
              >
                {compiling === c.name ? "…" : "Compile"}
              </button>
            </div>
            <div className="text-[10px] text-zinc-600 mt-0.5">
              last compile: {fmt(c.lastCompileAt)}
              {c.lastRawAt && ` · last raw: ${fmt(c.lastRawAt)}`}
            </div>
          </div>
        ))}
      </div>

      {compileOutput && (
        <div className="mt-3 p-3 rounded-lg border border-zinc-800 bg-zinc-950/50">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs text-zinc-400">
              Compiling {compileOutput.category}
            </span>
            <button
              onClick={() => setCompileOutput(null)}
              className="text-[11px] text-zinc-500 hover:text-zinc-300"
            >
              ×
            </button>
          </div>
          {compileOutput.tools.length > 0 && (
            <div className="flex flex-wrap gap-1 mb-2">
              {compileOutput.tools.slice(-15).map((t, ti) => (
                <span
                  key={ti}
                  className={
                    "text-[10px] px-1 py-0.5 rounded font-mono " +
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
          {compileOutput.error && (
            <p className="text-xs text-red-400">{compileOutput.error}</p>
          )}
          {compileOutput.done && !compileOutput.error && (
            <p className="text-xs text-emerald-400 mb-1">Done.</p>
          )}
          <pre className="text-[11px] text-zinc-300 whitespace-pre-wrap max-h-48 overflow-y-auto">
            {compileOutput.lines.join("")}
          </pre>
        </div>
      )}
    </section>
  );
}
