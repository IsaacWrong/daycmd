"use client";

import Link from "next/link";
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
    <div className="flex items-center gap-2.5 py-1.5">
      <span className="flex-1 text-[12.5px] text-fg-soft">{label}</span>
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
  const heat = usePoll<{ days: number[] }>("/api/heatmap", 10 * 60_000).data;

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

  return (
    <SectionMini title="Today in numbers">
      <NumberRow
        label="Tokens"
        value={fmtTokens(todayTokens)}
        sub={`$${(usage?.today.cost ?? 0).toFixed(2)}`}
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
    <div className="py-1.5">
      <div className="flex items-baseline mb-1.5">
        <span className="flex-1 text-[12.5px] text-fg-soft">{label}</span>
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
      className="flex items-center gap-2.5 py-1.5 text-[13px] hover:opacity-80"
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
  const { data } = usePoll<{ projects: ProjectDTO[] }>("/api/projects", 60_000);
  return (
    <SectionMini title="Projects">
      {(data?.projects ?? []).slice(0, 6).map((p) => (
        <ProjectRow key={p.name} p={p} />
      ))}
      {(!data || data.projects.length === 0) && (
        <p className="text-[12px] text-fg-soft py-1">No active projects.</p>
      )}
    </SectionMini>
  );
}
