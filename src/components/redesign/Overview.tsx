"use client";

import { useEffect, useState } from "react";
import { mutate, usePoll } from "@/lib/hooks";
import type { ObsidianTask } from "@/lib/tasks-parser";
import type { GhSummary } from "@/lib/github";
import type { GmailMsg } from "@/lib/gmail";
import type { ErrorRow } from "@/lib/errors";
import type { SectionKey } from "./DashboardNav";
import { Markdown } from "@/components/Markdown";

type RankResp = { ranked: Array<{ id: string; reason: string }>; error?: string };
type BriefResp = { brief: { ts: number; output: string } | null };
const SMART_RANK_KEY = "daycmd.upnext.smart";
const BRIEF_COLLAPSED_KEY = "daycmd.brief.collapsed";

type TasksResp = { tasks: ObsidianTask[] };
type GhResp = GhSummary | { error: string };
type GmailResp =
  | { messages: GmailMsg[]; configured: boolean; connected: boolean }
  | { error: string; configured: boolean; connected: boolean };
type ErrorsResp = { errors: ErrorRow[] };
type UsageResp = { today: { cost: number }; daily: { date: string; tokens: number }[] };
type HeatResp = { days: number[] };
type StreaksResp = { dailyNote: number; ship: number };
type DailyResp = { exists: boolean; content: string };

const PRIORITY_RANK: Record<NonNullable<ObsidianTask["priority"]>, number> = {
  highest: 0,
  high: 1,
  medium: 2,
  low: 3,
  lowest: 4,
};

function dueRank(t: ObsidianTask, today: string): number {
  if (!t.due) return 3;
  if (t.due < today) return 0;
  if (t.due === today) return 1;
  return 2;
}

function dueLabel(t: ObsidianTask, today: string): string {
  if (!t.due) return "no date";
  if (t.due === today) return "today";
  if (t.due < today) {
    const dd = new Date(t.due);
    const tt = new Date(today);
    const days = Math.round((tt.getTime() - dd.getTime()) / 86_400_000);
    return `overdue ${days}d`;
  }
  return t.due.slice(5);
}

function pickTopTasks(tasks: ObsidianTask[], today: string): ObsidianTask[] {
  return tasks
    .filter((t) => !t.done && !t.cancelled)
    .slice()
    .sort((a, b) => {
      const dr = dueRank(a, today) - dueRank(b, today);
      if (dr !== 0) return dr;
      const ap = a.priority ? PRIORITY_RANK[a.priority] : 5;
      const bp = b.priority ? PRIORITY_RANK[b.priority] : 5;
      if (ap !== bp) return ap - bp;
      return (a.due ?? "z").localeCompare(b.due ?? "z");
    })
    .slice(0, 3);
}

function Block({
  eyebrow,
  jumpLabel,
  onJump,
  headerExtra,
  children,
}: {
  eyebrow: string;
  jumpLabel?: string;
  onJump?: () => void;
  headerExtra?: React.ReactNode;
  children: React.ReactNode;
}) {
  const interactive = !!onJump;
  return (
    <section
      onClick={onJump}
      role={interactive ? "button" : undefined}
      tabIndex={interactive ? 0 : undefined}
      onKeyDown={
        interactive
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onJump?.();
              }
            }
          : undefined
      }
      data-interactive={interactive ? "true" : "false"}
      className="dimmable block-lift"
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 14,
        cursor: interactive ? "pointer" : "default",
      }}
    >
      <div className="flex items-center gap-2">
        <span className="t-eyebrow">{eyebrow}</span>
        {headerExtra}
        {jumpLabel && (
          <span
            className="t-mono ml-auto text-fg-soft"
            style={{ fontSize: 10 }}
          >
            {jumpLabel}
          </span>
        )}
      </div>
      <div>{children}</div>
    </section>
  );
}

function TaskRow({
  t,
  today,
  onToggle,
  reason,
}: {
  t: ObsidianTask;
  today: string;
  onToggle: (t: ObsidianTask) => void;
  reason?: string;
}) {
  const overdue = t.due && t.due < today;
  return (
    <div
      style={{
        padding: "10px 0",
        borderBottom: "1px solid var(--rule)",
      }}
    >
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onToggle(t);
          }}
          aria-label="Mark done"
          style={{
            width: 14,
            height: 14,
            borderRadius: 4,
            border: "1.5px solid var(--rule)",
            background: "transparent",
            cursor: "pointer",
            flexShrink: 0,
          }}
        />
        <span
          className="flex-1 truncate"
          style={{
            fontSize: 14,
            letterSpacing: "-0.005em",
          }}
        >
          {t.text}
        </span>
        <span
          className="t-mono"
          style={{
            fontSize: 11,
            color: overdue ? "var(--c-error)" : "var(--fg-soft)",
          }}
        >
          {dueLabel(t, today)}
        </span>
      </div>
      {reason && (
        <div
          className="t-mono"
          style={{
            fontSize: 10.5,
            color: "var(--c-agent)",
            paddingLeft: 26,
            marginTop: 4,
            letterSpacing: "0.01em",
            opacity: 0.85,
          }}
        >
          <span style={{ marginRight: 4 }}>✦</span>
          {reason}
        </div>
      )}
    </div>
  );
}

function AlertRow({
  text,
  onClick,
}: {
  text: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      className="flex items-center text-left w-full hover:opacity-80"
      style={{
        padding: "10px 0",
        borderBottom: "1px solid var(--rule)",
        background: "transparent",
        border: 0,
        borderBottomWidth: 1,
        borderBottomStyle: "solid",
        borderBottomColor: "var(--rule)",
        cursor: "pointer",
        fontSize: 14,
        letterSpacing: "-0.005em",
        color: "var(--fg)",
      }}
    >
      <span className="flex-1">{text}</span>
      <span className="t-mono text-fg-soft" style={{ fontSize: 11 }}>
        →
      </span>
    </button>
  );
}

export function Overview({
  onJump,
}: {
  onJump: (k: SectionKey) => void;
}) {
  const tasks = usePoll<TasksResp>("/api/obsidian/tasks", 60_000).data;
  const gh = usePoll<GhResp>("/api/github", 60_000).data;
  const mail = usePoll<GmailResp>("/api/gmail", 60_000).data;
  const errors = usePoll<ErrorsResp>("/api/errors", 60_000).data;
  const usage = usePoll<UsageResp>("/api/usage", 60_000).data;
  const heat = usePoll<HeatResp>("/api/heatmap", 90_000).data;
  const streaks = usePoll<StreaksResp>("/api/streaks", 5 * 60_000).data;
  const daily = usePoll<DailyResp>("/api/obsidian/daily", 60_000).data;

  const today = new Date().toISOString().slice(0, 10);
  const allTasks = tasks?.tasks ?? [];

  const brief = usePoll<BriefResp>("/api/micro/morning-brief", 10 * 60_000).data;
  const [briefBusy, setBriefBusy] = useState(false);
  const [briefCollapsed, setBriefCollapsed] = useState(false);
  useEffect(() => {
    try {
      setBriefCollapsed(localStorage.getItem(BRIEF_COLLAPSED_KEY) === "1");
    } catch {}
  }, []);
  function toggleBriefCollapsed() {
    setBriefCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(BRIEF_COLLAPSED_KEY, next ? "1" : "0");
      } catch {}
      return next;
    });
  }
  async function runBrief() {
    setBriefBusy(true);
    try {
      await fetch("/api/micro/morning-brief", { method: "POST" });
      mutate("/api/micro/morning-brief");
    } finally {
      setBriefBusy(false);
    }
  }

  const briefIsToday =
    brief?.brief &&
    new Date(brief.brief.ts).toISOString().slice(0, 10) === today;

  const [smart, setSmart] = useState(false);
  useEffect(() => {
    try {
      setSmart(localStorage.getItem(SMART_RANK_KEY) === "1");
    } catch {}
  }, []);
  function toggleSmart() {
    setSmart((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(SMART_RANK_KEY, next ? "1" : "0");
      } catch {}
      return next;
    });
  }

  const [rank, setRank] = useState<RankResp | null>(null);
  const [rankBusy, setRankBusy] = useState(false);
  useEffect(() => {
    if (!smart) {
      setRank(null);
      return;
    }
    let cancelled = false;
    async function load() {
      setRankBusy(true);
      try {
        const res = await fetch("/api/micro/rank-tasks", { cache: "no-store" });
        const json = (await res.json()) as RankResp;
        if (!cancelled) setRank(json);
      } catch {
        if (!cancelled) setRank({ ranked: [], error: "load failed" });
      } finally {
        if (!cancelled) setRankBusy(false);
      }
    }
    void load();
    const id = setInterval(() => void load(), 15 * 60_000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [smart]);

  const heuristicTop = pickTopTasks(allTasks, today);
  let displayTop: Array<{ task: ObsidianTask; reason?: string }> = heuristicTop.map((t) => ({
    task: t,
  }));
  if (smart && rank?.ranked?.length) {
    const byId = new Map(allTasks.map((t) => [t.id, t]));
    const ranked = rank.ranked
      .map((r) => {
        const task = byId.get(r.id);
        return task && !task.done && !task.cancelled
          ? { task, reason: r.reason }
          : null;
      })
      .filter((x): x is { task: ObsidianTask; reason: string } => x !== null);
    if (ranked.length) displayTop = ranked;
  }

  async function toggle(t: ObsidianTask) {
    if (t.done) return;
    try {
      const res = await fetch("/api/obsidian/tasks", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ file: t.file, text: t.text }),
      });
      if (res.ok) mutate("/api/obsidian/tasks");
    } catch {}
  }

  const overdueCount = allTasks.filter(
    (t) => !t.done && !t.cancelled && t.due && t.due < today,
  ).length;
  const ghOk = gh && !("error" in gh);
  const prReview = ghOk ? gh.reviewRequested.length : 0;
  const messages = mail && "messages" in mail ? mail.messages : [];
  const unread = messages.filter((m) => m.unread).length;
  const openErrors = errors?.errors?.length ?? 0;

  const alerts: { text: string; key: SectionKey }[] = [];
  if (overdueCount > 0) {
    alerts.push({
      text: `${overdueCount} overdue task${overdueCount === 1 ? "" : "s"}`,
      key: "tasks",
    });
  }
  if (prReview > 0) {
    alerts.push({
      text: `${prReview} PR${prReview === 1 ? "" : "s"} awaiting your review`,
      key: "github",
    });
  }
  if (unread > 0) {
    alerts.push({
      text: `${unread} unread mail${unread === 1 ? "" : "s"}`,
      key: "mail",
    });
  }
  if (openErrors > 0) {
    alerts.push({
      text: `${openErrors} open error${openErrors === 1 ? "" : "s"}`,
      key: "github",
    });
  }

  const closedToday = allTasks.filter(
    (t) => t.done && t.doneDate === today,
  ).length;
  const days = heat?.days ?? [];
  const commitsToday = days.length ? days[days.length - 1] : 0;
  const shipDays = streaks?.ship ?? 0;
  const noteWords = daily?.exists
    ? daily.content.trim().split(/\s+/).filter(Boolean).length
    : 0;
  const todaySpend = usage?.today.cost ?? 0;

  const stats: { label: string; value: string; tone?: string; jump?: SectionKey }[] = [];
  stats.push({ label: "closed", value: String(closedToday), tone: "var(--c-tasks)", jump: "tasks" });
  stats.push({ label: "commits", value: String(commitsToday), tone: "var(--c-github)", jump: "github" });
  if (shipDays > 0) {
    stats.push({ label: "d ship streak", value: String(shipDays), tone: "var(--c-good)", jump: "github" });
  }
  stats.push({ label: "note words", value: String(noteWords), tone: "var(--c-obsidian)", jump: "note" });
  if (todaySpend > 0) {
    stats.push({ label: "spend", value: `$${todaySpend.toFixed(2)}`, tone: "var(--c-agent)" });
  }
  const visibleStats = stats.slice(0, 4);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 44 }}>
      {/* Morning brief AI intel card */}
      <section
        className="dimmable"
        style={{
          marginTop: -4,
          border: "1px solid oklch(from var(--c-agent) l c h / 0.24)",
          borderRadius: 10,
          padding: "14px 18px",
          background: "oklch(from var(--c-agent) l c h / 0.04)",
        }}
      >
        <div className="flex items-center gap-2" style={{ marginBottom: 6 }}>
          <span
            className="t-eyebrow"
            style={{ color: "var(--c-agent)", letterSpacing: "0.08em" }}
          >
            ✦ Morning Brief
          </span>
          {brief?.brief && (
            <span
              className="t-mono text-fg-soft"
              style={{ fontSize: 10 }}
              title={new Date(brief.brief.ts).toLocaleString()}
            >
              {briefIsToday
                ? new Date(brief.brief.ts).toLocaleTimeString([], {
                    hour: "numeric",
                    minute: "2-digit",
                  })
                : new Date(brief.brief.ts).toLocaleDateString()}
            </span>
          )}
          <span className="ml-auto flex items-center gap-1.5">
            <button
              type="button"
              onClick={runBrief}
              disabled={briefBusy}
              title="Run brief now"
              className="t-mono"
              style={{
                background: "transparent",
                border: "1px solid var(--rule)",
                borderRadius: 6,
                padding: "2px 8px",
                fontSize: 10,
                color: briefBusy ? "var(--fg-soft)" : "var(--c-agent)",
                cursor: briefBusy ? "wait" : "pointer",
                letterSpacing: "0.04em",
              }}
            >
              {briefBusy ? "running…" : brief?.brief ? "refresh" : "run"}
            </button>
            {brief?.brief && (
              <button
                type="button"
                onClick={toggleBriefCollapsed}
                title={briefCollapsed ? "Expand" : "Collapse"}
                className="t-mono"
                style={{
                  background: "transparent",
                  border: "1px solid var(--rule)",
                  borderRadius: 6,
                  padding: "2px 8px",
                  fontSize: 10,
                  color: "var(--fg-soft)",
                  cursor: "pointer",
                  letterSpacing: "0.04em",
                }}
              >
                {briefCollapsed ? "+" : "−"}
              </button>
            )}
          </span>
        </div>
        {!brief?.brief && (
          <p className="text-fg-soft" style={{ fontSize: 12 }}>
            No brief yet today. Runs daily at 8am — hit run to generate now.
          </p>
        )}
        {brief?.brief && !briefIsToday && !briefCollapsed && (
          <p
            className="t-mono text-fg-soft"
            style={{ fontSize: 10.5, marginBottom: 8 }}
          >
            Stale — last run{" "}
            {new Date(brief.brief.ts).toLocaleDateString()}. Refresh for today.
          </p>
        )}
        {brief?.brief && !briefCollapsed && (
          <div style={{ fontSize: 13 }}>
            <Markdown>{brief.brief.output}</Markdown>
          </div>
        )}
      </section>

      {/* Hero "Today" stat row — full-bleed, display face */}
      <section className="dimmable" style={{ marginTop: -4 }}>
        <div
          className="t-eyebrow"
          style={{ marginBottom: 18 }}
        >
          Today
        </div>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: `repeat(${visibleStats.length}, minmax(0, 1fr))`,
            gap: 24,
            alignItems: "end",
          }}
        >
          {visibleStats.map((s, i) => (
            <div
              key={s.label}
              className="stat-rise"
              onClick={s.jump ? () => onJump(s.jump!) : undefined}
              role={s.jump ? "button" : undefined}
              tabIndex={s.jump ? 0 : undefined}
              onKeyDown={
                s.jump
                  ? (e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        onJump(s.jump!);
                      }
                    }
                  : undefined
              }
              style={
                {
                  display: "flex",
                  flexDirection: "column",
                  gap: 6,
                  borderLeft: "1px solid var(--rule)",
                  paddingLeft: 16,
                  cursor: s.jump ? "pointer" : "default",
                  "--d": `${i * 70}ms`,
                } as React.CSSProperties
              }
            >
              <span
                className="t-display"
                style={{
                  fontSize: 56,
                  fontWeight: 400,
                  color: s.tone ?? "var(--fg)",
                }}
              >
                {s.value}
              </span>
              <span
                className="t-mono"
                style={{
                  fontSize: 10.5,
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                  color: "var(--fg-soft)",
                }}
              >
                {s.label}
              </span>
            </div>
          ))}
        </div>
      </section>

      {/* Up next + Watch side-by-side */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: alerts.length > 0 ? "1.6fr 1fr" : "1fr",
          gap: 40,
          alignItems: "start",
        }}
      >
        <Block
          eyebrow="Up next"
          jumpLabel="→ all tasks"
          onJump={() => onJump("tasks")}
          headerExtra={
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                toggleSmart();
              }}
              title={smart ? "Smart rank on — click to disable" : "Smart rank: agent picks based on calendar gaps + priority"}
              className="t-mono"
              style={{
                background: smart
                  ? "oklch(from var(--c-agent) l c h / 0.14)"
                  : "transparent",
                border: `1px solid ${smart ? "oklch(from var(--c-agent) l c h / 0.32)" : "var(--rule)"}`,
                borderRadius: 6,
                padding: "2px 8px",
                fontSize: 10,
                color: smart ? "var(--c-agent)" : "var(--fg-soft)",
                cursor: "pointer",
                letterSpacing: "0.04em",
                display: "inline-flex",
                alignItems: "center",
                gap: 4,
              }}
            >
              <span style={{ fontSize: 11, lineHeight: 1 }}>✦</span>
              {smart ? (rankBusy ? "ranking…" : "smart") : "smart"}
            </button>
          }
        >
          {displayTop.length === 0 ? (
            <p className="text-fg-soft" style={{ fontSize: 13, padding: "6px 0" }}>
              Clean slate. Worth keeping it that way for now.
            </p>
          ) : (
            displayTop.map(({ task, reason }) => (
              <TaskRow
                key={task.id}
                t={task}
                today={today}
                onToggle={toggle}
                reason={reason}
              />
            ))
          )}
        </Block>

        {alerts.length > 0 && (
          <Block eyebrow="Watch">
            {alerts.map((a) => (
              <AlertRow key={a.text} text={a.text} onClick={() => onJump(a.key)} />
            ))}
          </Block>
        )}
      </div>
    </div>
  );
}
