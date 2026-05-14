"use client";

import Link from "next/link";
import { useState } from "react";
import { usePoll } from "@/lib/hooks";
import type { RepoStats } from "@/lib/github";
import type { ObsidianTask } from "@/lib/tasks-parser";
import { Sparkline } from "./Sparkline";
import { SectionMini, type SourceAccent } from "./Section";

type ProjectDTO = {
  name: string;
  status: string | null;
  next: string | null;
  repo: string | null;
  url: string | null;
  weeklyHours: number;
  stats: RepoStats | null;
};

type GhSummary = {
  authored: { number: number }[];
  reviewRequested: { number: number }[];
  assigned: { number: number }[];
};

type UsageResp = {
  today: { cost: number };
  daily: { date: string; tokens: number }[];
};

type SettingsResp = {
  budgetDailyUsd: number;
  budgetAlertPct: number;
};

function NumberRow({
  label,
  value,
  sub,
  tone,
  spark,
}: {
  label: string;
  value: string;
  sub?: string;
  tone?: string;
  spark?: number[];
}) {
  return (
    <div className="flex items-center gap-2.5 py-2">
      <span className="flex-1 text-[13px] text-fg-soft">{label}</span>
      <span
        className="t-num text-[15px] font-medium"
        style={{ color: tone ?? "var(--fg)", letterSpacing: "-0.01em" }}
      >
        {value}
      </span>
      {sub && (
        <span className="t-mono text-[10px] text-fg-soft" style={{ width: 64, textAlign: "right" }}>
          {sub}
        </span>
      )}
      {spark && spark.length > 0 && <Sparkline data={spark} w={36} h={14} tone={tone} />}
    </div>
  );
}

export function TodayInNumbers() {
  const usage = usePoll<UsageResp>("/api/usage", 60_000).data;
  const tasks = usePoll<{ tasks: ObsidianTask[] }>("/api/obsidian/tasks", 60_000).data;
  const gh = usePoll<GhSummary | { error: string }>("/api/github", 60_000).data;
  const daily = usePoll<{ exists: boolean; content: string }>("/api/obsidian/daily", 60_000).data;
  const heat = usePoll<{ days: number[] }>("/api/heatmap", 90_000).data;
  const settings = usePoll<SettingsResp>("/api/settings", 5 * 60_000).data;

  const today = new Date().toISOString().slice(0, 10);
  const todayTokens =
    usage?.daily?.find((d) => d.date === today)?.tokens ?? 0;
  const tokensWeek = usage?.daily?.map((d) => d.tokens) ?? [];
  const tasksOpen = (tasks?.tasks ?? []).filter((t) => !t.done && !t.cancelled);
  const tasksDoneToday = (tasks?.tasks ?? []).filter(
    (t) => t.done && t.doneDate === today,
  ).length;
  const days = heat?.days ?? [];
  const commitsToday = days.length > 0 ? days[days.length - 1] : 0;
  const commits7d = days.slice(-7).reduce((a, b) => a + b, 0);
  const dailyWords = daily?.exists
    ? daily.content.trim().split(/\s+/).filter(Boolean).length
    : 0;
  const ghOpen =
    gh && !("error" in gh)
      ? gh.authored.length + gh.reviewRequested.length + gh.assigned.length
      : 0;

  const fmtTokens = (n: number) =>
    n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n);

  const spend = usage?.today.cost ?? 0;
  const cap = settings?.budgetDailyUsd ?? 0;
  const alertPct = settings?.budgetAlertPct ?? 0.8;
  const spendPct = cap > 0 ? Math.min(spend / cap, 1) : 0;
  const overAlert = cap > 0 && spend / cap >= alertPct;
  const overCap = cap > 0 && spend >= cap;
  const spendTone = overCap
    ? "var(--c-error)"
    : overAlert
      ? "var(--c-tasks)"
      : "var(--c-good)";
  const spendSub = cap > 0 ? `/ $${cap.toFixed(0)}` : "no cap";

  return (
    <SectionMini title="Today in numbers">
      <div className="py-2">
        <div className="flex items-center gap-2.5">
          <span className="flex-1 text-[13px] text-fg-soft">Spend</span>
          <span
            className="t-num text-[15px] font-medium"
            style={{ color: spendTone, letterSpacing: "-0.01em" }}
          >
            ${spend.toFixed(2)}
          </span>
          <span
            className="t-mono text-[10px] text-fg-soft"
            style={{ width: 64, textAlign: "right" }}
          >
            {spendSub}
          </span>
        </div>
        {cap > 0 && (
          <div
            className="h-[3px] rounded-full overflow-hidden mt-2"
            style={{ background: "oklch(from var(--fg) l c h / 0.08)" }}
          >
            <div
              className="h-full rounded-full"
              style={{ width: `${spendPct * 100}%`, background: spendTone }}
            />
          </div>
        )}
      </div>
      <NumberRow
        label="Tokens"
        value={fmtTokens(todayTokens)}
        tone="var(--c-agent)"
        spark={tokensWeek}
      />
      <NumberRow
        label="Tasks closed"
        value={String(tasksDoneToday)}
        sub={`of ${tasksOpen.length + tasksDoneToday}`}
        tone="var(--c-tasks)"
      />
      <NumberRow
        label="Commits"
        value={String(commitsToday)}
        sub={`${commits7d} · 7d`}
        tone="var(--c-github)"
        spark={days}
      />
      <NumberRow label="GitHub open" value={String(ghOpen)} tone="var(--c-gmail)" />
      <NumberRow
        label="Note words"
        value={String(dailyWords)}
        tone="var(--c-obsidian)"
      />
    </SectionMini>
  );
}

function StreakBar({
  label,
  value,
  unit,
  pct,
  tone,
}: {
  label: string;
  value: number;
  unit: string;
  pct: number;
  tone: string;
}) {
  return (
    <div className="py-2">
      <div className="flex items-baseline mb-2">
        <span className="flex-1 text-[13px] text-fg-soft">{label}</span>
        <span className="t-num text-[14px] font-medium" style={{ color: tone }}>
          {value}
        </span>
        <span className="t-mono ml-1 text-[10px] text-fg-soft">{unit}</span>
      </div>
      <div
        className="h-[3px] rounded-full overflow-hidden"
        style={{ background: "oklch(from var(--fg) l c h / 0.08)" }}
      >
        <div
          className="h-full rounded-full"
          style={{ width: `${Math.min(pct * 100, 100)}%`, background: tone }}
        />
      </div>
    </div>
  );
}

export function Streaks() {
  const streaks =
    usePoll<{ dailyNote: number; ship: number }>("/api/streaks", 5 * 60_000).data;
  const dailyNote = streaks?.dailyNote ?? 0;
  const shipDays = streaks?.ship ?? 0;

  return (
    <SectionMini title="Streaks">
      <StreakBar
        label="Daily note"
        value={dailyNote}
        unit="d"
        pct={dailyNote / 30}
        tone="var(--c-obsidian)"
      />
      <StreakBar
        label="Ship"
        value={shipDays}
        unit="d"
        pct={shipDays / 30}
        tone="var(--c-good)"
      />
    </SectionMini>
  );
}

function projectAccent(p: ProjectDTO): SourceAccent {
  const s = (p.status ?? "").toLowerCase();
  if (s === "shipping" || s === "shipping v0.4") return "good";
  if (s === "building") return "tasks";
  if (s === "idea") return "calendar";
  if (s === "on hold") return "agent";
  return "github";
}

function ProjectRow({ p }: { p: ProjectDTO }) {
  const commits = p.stats?.weeklyCommits ?? 0;
  // Synthesize a small 7-bar spark from the single weeklyCommits value.
  const spark = [2, 0, 4, 3, 1, 5, 9].map((v) => v * (commits / 12 + 0.1));
  const accent = projectAccent(p);
  return (
    <Link
      href={`/projects/${encodeURIComponent(p.name)}`}
      className="flex items-center gap-2.5 py-2 text-[13px] hover:opacity-80"
    >
      <span className={`src-dot src-${accent}`} style={{ width: 6, height: 6 }} />
      <span className="flex-1" style={{ letterSpacing: "-0.005em" }}>
        {p.name}
      </span>
      <Sparkline data={spark} w={42} h={14} tone={`var(--c-${accent})`} />
      <span className="t-mono t-num text-[10px] text-fg-soft" style={{ width: 32, textAlign: "right" }}>
        {p.weeklyHours.toFixed(1)}h
      </span>
    </Link>
  );
}

export function ProjectsList() {
  const { data, refresh } = usePoll<{ projects: ProjectDTO[] }>("/api/projects", 60_000);
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [repo, setRepo] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: name.trim(), repo: repo.trim() || undefined }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j?.error ?? `Failed (${res.status})`);
      }
      setName("");
      setRepo("");
      setAdding(false);
      await refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <SectionMini
      title="Projects"
      right={
        <span className="ml-auto flex items-center gap-3">
          <Link
            href="/projects"
            className="t-mono text-[10px] text-fg-soft hover:text-fg"
            title="All projects overview"
          >
            all →
          </Link>
          <button
            type="button"
            onClick={() => setAdding((v) => !v)}
            className="t-mono text-[10px] text-fg-soft hover:text-fg"
            style={{
              background: "transparent",
              border: 0,
              padding: 0,
              cursor: "pointer",
            }}
            title="Add project"
          >
            {adding ? "cancel" : "+ new"}
          </button>
        </span>
      }
    >
      {(data?.projects ?? []).slice(0, 6).map((p) => (
        <ProjectRow key={p.name} p={p} />
      ))}
      {(!data || data.projects.length === 0) && !adding && (
        <p className="text-[12px] text-fg-soft py-1">No active projects.</p>
      )}
      {adding && (
        <form onSubmit={submit} className="py-2 flex flex-col gap-1.5">
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Name"
            disabled={busy}
            className="text-[13px]"
            style={{
              background: "transparent",
              border: "1px solid var(--rule)",
              borderRadius: 4,
              padding: "4px 6px",
              color: "var(--fg)",
              outline: 0,
            }}
          />
          <input
            value={repo}
            onChange={(e) => setRepo(e.target.value)}
            placeholder="owner/repo (optional)"
            disabled={busy}
            className="text-[13px]"
            style={{
              background: "transparent",
              border: "1px solid var(--rule)",
              borderRadius: 4,
              padding: "4px 6px",
              color: "var(--fg)",
              outline: 0,
            }}
          />
          {error && (
            <span className="text-[11px]" style={{ color: "var(--c-error)" }}>
              {error}
            </span>
          )}
          <button
            type="submit"
            disabled={busy || !name.trim()}
            className="t-mono text-[11px] self-start"
            style={{
              padding: "3px 8px",
              border: "1px solid var(--rule)",
              borderRadius: 4,
              background: "transparent",
              color: "var(--fg)",
              cursor: busy ? "default" : "pointer",
              opacity: busy || !name.trim() ? 0.5 : 1,
            }}
          >
            {busy ? "creating…" : "create"}
          </button>
        </form>
      )}
    </SectionMini>
  );
}
