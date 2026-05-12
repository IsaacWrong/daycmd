"use client";

import { useEffect, useRef, useState } from "react";
import { usePoll } from "@/lib/hooks";
import type { RepoStats } from "@/lib/github";

type ProjectDTO = {
  name: string;
  status: string | null;
  next: string | null;
  repo: string | null;
  url: string | null;
  weeklyHours: number;
  stats: RepoStats | null;
};

type Resp = { projects: ProjectDTO[] } | { error: string };

function isErr(r: Resp | null): r is { error: string } {
  return !!r && "error" in r;
}

function fmtHours(h: number): string {
  if (h <= 0) return "0h";
  if (h < 1) return `${Math.round(h * 60)}m`;
  return `${h.toFixed(1)}h`;
}

function fmtAgo(iso: string | undefined): string {
  if (!iso) return "—";
  const ms = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(ms / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function StatusBadge({ status }: { status: string | null }) {
  const color = (() => {
    switch ((status ?? "").toLowerCase()) {
      case "building":
      case "shipping":
        return "bg-emerald-900/50 text-emerald-300 border-emerald-700/50";
      case "idea":
        return "bg-blue-900/50 text-blue-300 border-blue-700/50";
      case "on hold":
        return "bg-amber-900/50 text-amber-300 border-amber-700/50";
      case "cold":
        return "bg-zinc-800 text-zinc-400 border-zinc-700";
      default:
        return "bg-zinc-800 text-zinc-300 border-zinc-700";
    }
  })();
  return (
    <span className={`text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded border ${color}`}>
      {status ?? "unset"}
    </span>
  );
}

function ProjectRow({ p, onChanged }: { p: ProjectDTO; onChanged: () => void }) {
  const [timerStart, setTimerStart] = useState<number | null>(() => {
    if (typeof window === "undefined") return null;
    const v = localStorage.getItem(`timer:${p.name}`);
    return v ? Number(v) : null;
  });
  const [elapsed, setElapsed] = useState(0);
  const [editingNext, setEditingNext] = useState(false);
  const [nextDraft, setNextDraft] = useState(p.next ?? "");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setNextDraft(p.next ?? "");
  }, [p.next]);

  useEffect(() => {
    if (!timerStart) return;
    const id = setInterval(() => setElapsed(Date.now() - timerStart), 1000);
    setElapsed(Date.now() - timerStart);
    return () => clearInterval(id);
  }, [timerStart]);

  function startTimer() {
    const now = Date.now();
    localStorage.setItem(`timer:${p.name}`, String(now));
    setTimerStart(now);
  }

  async function stopTimer() {
    if (!timerStart) return;
    const start = new Date(timerStart).toISOString();
    const end = new Date().toISOString();
    localStorage.removeItem(`timer:${p.name}`);
    setTimerStart(null);
    setElapsed(0);
    try {
      await fetch(`/api/projects/${encodeURIComponent(p.name)}/time`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ start, end }),
      });
      onChanged();
    } catch {}
  }

  async function saveNext() {
    if (nextDraft.trim() === (p.next ?? "").trim()) {
      setEditingNext(false);
      return;
    }
    setSaving(true);
    try {
      await fetch(`/api/projects/${encodeURIComponent(p.name)}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ next: nextDraft.trim() }),
      });
      onChanged();
    } finally {
      setSaving(false);
      setEditingNext(false);
    }
  }

  const elapsedMin = Math.floor(elapsed / 60000);
  const elapsedSec = Math.floor((elapsed % 60000) / 1000);

  return (
    <div className="border border-zinc-800 rounded-lg p-3 bg-zinc-900/30 space-y-2">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <h3 className="text-sm font-medium text-zinc-100 truncate">{p.name}</h3>
          <StatusBadge status={p.status} />
        </div>
        {p.repo && (
          <a
            href={`https://github.com/${p.repo}`}
            target="_blank"
            rel="noreferrer"
            className="text-xs text-zinc-500 hover:text-zinc-300 shrink-0"
          >
            {p.repo}
          </a>
        )}
      </div>

      <div className="text-xs text-zinc-400">
        <span className="text-zinc-500 mr-1">NEXT:</span>
        {editingNext ? (
          <input
            autoFocus
            value={nextDraft}
            onChange={(e) => setNextDraft(e.target.value)}
            onBlur={saveNext}
            onKeyDown={(e) => {
              if (e.key === "Enter") saveNext();
              if (e.key === "Escape") {
                setNextDraft(p.next ?? "");
                setEditingNext(false);
              }
            }}
            disabled={saving}
            className="bg-zinc-800 rounded px-1 py-0.5 outline-none w-full max-w-md text-zinc-100"
          />
        ) : (
          <button
            onClick={() => setEditingNext(true)}
            className="text-left hover:text-zinc-200"
          >
            {p.next || <span className="italic text-zinc-600">click to set</span>}
          </button>
        )}
      </div>

      <div className="flex items-center gap-3 text-xs text-zinc-500 flex-wrap">
        <span>
          ⏱ {fmtHours(p.weeklyHours)} <span className="text-zinc-600">7d</span>
        </span>
        {p.stats?.lastCommit && (
          <a
            href={p.stats.lastCommit.url}
            target="_blank"
            rel="noreferrer"
            className="hover:text-zinc-300 truncate max-w-[280px]"
            title={p.stats.lastCommit.message}
          >
            📦 {p.stats.lastCommit.message}{" "}
            <span className="text-zinc-600">· {fmtAgo(p.stats.lastCommit.date)}</span>
          </a>
        )}
        {p.stats && (
          <>
            <span>📊 {p.stats.weeklyCommits} commits/7d</span>
            <span>PRs open: {p.stats.openPRs}</span>
          </>
        )}
        {p.stats?.error && (
          <span className="text-red-400" title={p.stats.error}>gh error</span>
        )}
      </div>

      <div className="flex items-center gap-2">
        {timerStart ? (
          <>
            <button
              onClick={stopTimer}
              className="text-xs px-2 py-1 rounded bg-red-900/50 text-red-200 border border-red-800 hover:bg-red-900"
            >
              Stop · {elapsedMin}:{String(elapsedSec).padStart(2, "0")}
            </button>
          </>
        ) : (
          <button
            onClick={startTimer}
            className="text-xs px-2 py-1 rounded bg-zinc-800 text-zinc-200 border border-zinc-700 hover:bg-zinc-700"
          >
            Start timer
          </button>
        )}
      </div>
    </div>
  );
}

export function ProjectsCard() {
  const { data, error, refresh } = usePoll<Resp>("/api/projects", 60_000);

  return (
    <section className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-5 lg:col-span-2">
      <header className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-medium uppercase tracking-wider text-zinc-400">
          Side Projects
        </h2>
        <span className="text-xs text-zinc-500">⌘K to capture idea</span>
      </header>

      {error && <p className="text-sm text-red-400">{error}</p>}
      {!data && !error && <p className="text-sm text-zinc-500">Loading…</p>}
      {isErr(data) && <p className="text-sm text-red-400">{data.error}</p>}

      {data && !isErr(data) && (
        <div className="space-y-3">
          {data.projects.length === 0 && (
            <p className="text-sm text-zinc-500">No active projects.</p>
          )}
          {data.projects.map((p) => (
            <ProjectRow key={p.name} p={p} onChanged={refresh} />
          ))}
        </div>
      )}
    </section>
  );
}
