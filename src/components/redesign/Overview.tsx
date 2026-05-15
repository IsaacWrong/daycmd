"use client";

import { mutate, usePoll } from "@/lib/hooks";
import type { ObsidianTask } from "@/lib/tasks-parser";
import type { GhSummary } from "@/lib/github";
import type { GmailMsg } from "@/lib/gmail";
import type { ErrorRow } from "@/lib/errors";
import type { SectionKey } from "./DashboardNav";

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
  children,
}: {
  eyebrow: string;
  jumpLabel?: string;
  onJump?: () => void;
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
      className="dimmable"
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 14,
        cursor: interactive ? "pointer" : "default",
      }}
    >
      <div className="flex items-center gap-2">
        <span className="t-eyebrow">{eyebrow}</span>
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
}: {
  t: ObsidianTask;
  today: string;
  onToggle: (t: ObsidianTask) => void;
}) {
  const overdue = t.due && t.due < today;
  return (
    <div
      className="flex items-center gap-3"
      style={{
        padding: "10px 0",
        borderBottom: "1px solid var(--rule)",
      }}
    >
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
  const top = pickTopTasks(allTasks, today);

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

  const stats: { label: string; value: string; tone?: string }[] = [];
  stats.push({ label: "closed", value: String(closedToday), tone: "var(--c-tasks)" });
  stats.push({ label: "commits", value: String(commitsToday), tone: "var(--c-github)" });
  if (shipDays > 0) {
    stats.push({ label: "d ship streak", value: String(shipDays), tone: "var(--c-good)" });
  }
  stats.push({ label: "note words", value: String(noteWords), tone: "var(--c-obsidian)" });
  if (todaySpend > 0) {
    stats.push({ label: "spend", value: `$${todaySpend.toFixed(2)}`, tone: "var(--c-agent)" });
  }
  const visibleStats = stats.slice(0, 4);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 36 }}>
      <Block
        eyebrow="Up next"
        jumpLabel="→ all tasks"
        onJump={() => onJump("tasks")}
      >
        {top.length === 0 ? (
          <p className="text-fg-soft" style={{ fontSize: 13, padding: "6px 0" }}>
            Nothing open. Add one in Tasks.
          </p>
        ) : (
          top.map((t) => (
            <TaskRow key={t.id} t={t} today={today} onToggle={toggle} />
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

      <Block eyebrow="Today">
        <div
          className="flex items-baseline"
          style={{
            gap: 22,
            flexWrap: "wrap",
            padding: "4px 0",
          }}
        >
          {visibleStats.map((s) => (
            <div
              key={s.label}
              className="flex items-baseline"
              style={{ gap: 6 }}
            >
              <span
                className="t-num"
                style={{
                  fontSize: 22,
                  fontWeight: 500,
                  letterSpacing: "-0.015em",
                  color: s.tone ?? "var(--fg)",
                }}
              >
                {s.value}
              </span>
              <span
                className="t-mono"
                style={{ fontSize: 11, color: "var(--fg-soft)" }}
              >
                {s.label}
              </span>
            </div>
          ))}
        </div>
      </Block>
    </div>
  );
}
