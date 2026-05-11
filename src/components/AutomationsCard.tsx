"use client";

import { useState } from "react";
import { usePoll } from "@/lib/hooks";
import { format } from "date-fns";

type Automation = {
  id: number;
  name: string;
  cron: string;
  prompt: string;
  enabled: boolean;
  last_run_at: number | null;
  created_at: number;
};

type Run = {
  id: number;
  automation_id: number;
  name: string;
  started_at: number;
  ended_at: number | null;
  ok: number | null;
  output: string | null;
  error: string | null;
};

type ClaudeCodeRoutine = {
  name: string;
  description: string;
  path: string;
};

type Resp = {
  automations: Automation[];
  recentRuns: Run[];
  claudeCodeRoutines: ClaudeCodeRoutine[];
  scheduler: { started: boolean; active: Array<{ id: number; cron: string }> };
};

function fmtTime(ms: number | null): string {
  if (!ms) return "—";
  return format(new Date(ms), "MMM d HH:mm");
}

export function AutomationsCard() {
  const { data, refresh } = usePoll<Resp>("/api/automations", 15_000);
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [cronExpr, setCronExpr] = useState("0 7 * * *");
  const [prompt, setPrompt] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [runningId, setRunningId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function create() {
    if (!name.trim() || !cronExpr.trim() || !prompt.trim()) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/automations", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name, cron: cronExpr, prompt }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? `HTTP ${res.status}`);
      setName("");
      setPrompt("");
      setCronExpr("0 7 * * *");
      setShowForm(false);
      refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  async function toggle(a: Automation) {
    await fetch(`/api/automations/${a.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ enabled: !a.enabled }),
    });
    refresh();
  }

  async function runNow(id: number) {
    setRunningId(id);
    try {
      await fetch(`/api/automations/${id}/run`, { method: "POST" });
    } finally {
      setRunningId(null);
      refresh();
    }
  }

  async function del(id: number) {
    if (!confirm("Delete this automation?")) return;
    await fetch(`/api/automations/${id}`, { method: "DELETE" });
    refresh();
  }

  return (
    <section className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-5 min-h-[280px] lg:col-span-2">
      <header className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-medium uppercase tracking-wider text-zinc-400">
          Automations
        </h2>
        <div className="flex items-center gap-2">
          {data?.scheduler.started ? (
            <span className="text-[10px] text-emerald-400 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" /> live
            </span>
          ) : (
            <span className="text-[10px] text-zinc-500">idle</span>
          )}
          <button
            onClick={() => setShowForm((v) => !v)}
            className="text-xs px-2 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-200"
          >
            {showForm ? "Cancel" : "+ New"}
          </button>
        </div>
      </header>

      {showForm && (
        <div className="mb-4 space-y-2 p-3 rounded-lg border border-zinc-800 bg-zinc-950/50">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Name (e.g. Morning Brief)"
            className="w-full bg-zinc-900 border border-zinc-800 rounded px-2 py-1.5 text-sm text-zinc-100"
          />
          <input
            value={cronExpr}
            onChange={(e) => setCronExpr(e.target.value)}
            placeholder="Cron (e.g. 0 7 * * *)"
            className="w-full bg-zinc-900 border border-zinc-800 rounded px-2 py-1.5 text-sm text-zinc-100 font-mono"
          />
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Prompt to run (e.g. Give me a morning brief and append it to today's daily note under Quick Capture.)"
            rows={3}
            className="w-full bg-zinc-900 border border-zinc-800 rounded px-2 py-1.5 text-sm text-zinc-100 resize-none"
          />
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-zinc-500 font-mono">
              min hour dom mon dow · 0 7 * * * = 7am daily
            </span>
            <button
              onClick={create}
              disabled={submitting}
              className="text-xs px-3 py-1 rounded bg-zinc-100 text-zinc-900 font-medium disabled:opacity-50"
            >
              {submitting ? "Creating…" : "Create"}
            </button>
          </div>
          {error && <p className="text-xs text-red-400">{error}</p>}
        </div>
      )}

      <div className="space-y-2">
        {data?.automations.length === 0 && (
          <p className="text-sm text-zinc-500">
            No automations yet. Examples: morning brief (7am), inbox triage (every 30min), weekly review (Sundays).
          </p>
        )}
        {data?.automations.map((a) => (
          <div
            key={a.id}
            className="p-2.5 rounded-lg border border-zinc-800 bg-zinc-950/30"
          >
            <div className="flex items-center justify-between gap-2 mb-1">
              <div className="flex items-center gap-2 min-w-0">
                <button
                  onClick={() => toggle(a)}
                  title={a.enabled ? "Disable" : "Enable"}
                  className={
                    "w-2 h-2 rounded-full shrink-0 " +
                    (a.enabled ? "bg-emerald-400" : "bg-zinc-600")
                  }
                />
                <span className="text-sm text-zinc-100 truncate">{a.name}</span>
                <span className="text-[10px] font-mono text-zinc-500 shrink-0">
                  {a.cron}
                </span>
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => runNow(a.id)}
                  disabled={runningId === a.id}
                  className="text-[11px] px-2 py-0.5 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-200 disabled:opacity-50"
                >
                  {runningId === a.id ? "Running…" : "Run"}
                </button>
                <button
                  onClick={() => del(a.id)}
                  className="text-[11px] px-1.5 py-0.5 text-zinc-500 hover:text-red-400"
                >
                  ×
                </button>
              </div>
            </div>
            <div className="text-xs text-zinc-500 truncate">{a.prompt}</div>
            {a.last_run_at && (
              <div className="text-[10px] text-zinc-600 mt-1">
                last run: {fmtTime(a.last_run_at)}
              </div>
            )}
          </div>
        ))}
      </div>

      {data && data.recentRuns.length > 0 && (
        <div className="mt-4">
          <h3 className="text-xs font-semibold text-zinc-300 mb-1.5">
            Recent runs
          </h3>
          <ul className="space-y-0.5">
            {data.recentRuns.slice(0, 5).map((r) => (
              <li
                key={r.id}
                className="text-xs flex items-baseline gap-2"
                title={r.error ?? r.output?.slice(0, 200) ?? ""}
              >
                <span
                  className={
                    "w-1.5 h-1.5 rounded-full mt-1 shrink-0 " +
                    (r.ok === 1
                      ? "bg-emerald-400"
                      : r.ok === 0
                        ? "bg-red-400"
                        : "bg-zinc-500")
                  }
                />
                <span className="text-zinc-500 w-20 shrink-0">
                  {fmtTime(r.started_at)}
                </span>
                <span className="text-zinc-300 truncate">{r.name}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {data && data.claudeCodeRoutines.length > 0 && (
        <div className="mt-4 pt-3 border-t border-zinc-800">
          <h3 className="text-xs font-semibold text-zinc-300 mb-1.5">
            Claude Code scheduled tasks{" "}
            <span className="text-zinc-500 font-normal">(read-only)</span>
          </h3>
          <ul className="space-y-1">
            {data.claudeCodeRoutines.map((r) => (
              <li key={r.name} className="text-xs">
                <div className="text-zinc-300">{r.name}</div>
                {r.description && (
                  <div className="text-zinc-500 truncate">{r.description}</div>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
