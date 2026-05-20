"use client";

import { useEffect, useState } from "react";
import { mutate, usePoll } from "@/lib/hooks";
import type { ObsidianTask } from "@/lib/tasks-parser";
import type { GhSummary } from "@/lib/github";
import type { GmailMsg } from "@/lib/gmail";
import type { ErrorRow } from "@/lib/errors";
import type { SectionKey } from "./DashboardNav";
import dynamic from "next/dynamic";
import { apiFetch } from "@/lib/fetch-client";

// react-markdown + remark-gfm (~40 KB gzipped) only renders when the
// morning brief is expanded — defer the chunk until then.
const Markdown = dynamic(
  () => import("@/components/Markdown").then((m) => m.Markdown),
  { ssr: false },
);

type RankResp = { ranked: Array<{ id: string; reason: string }>; error?: string };
type BriefResp = { brief: { ts: number; output: string } | null };
type FocusResp = { focus: string | null; cached?: boolean; error?: string };
type SuggestionTask = {
  file: string;
  line: number;
  text: string;
  due: string | null;
  priority: string | null;
};
type Suggestion = {
  id: string;
  action: "infer-due" | "reschedule" | "split";
  label: string;
  task: SuggestionTask;
};
type SuggestionsResp = { suggestions: Suggestion[] };
const SMART_RANK_KEY = "daycmd.upnext.smart";
const SUGGESTIONS_OPEN_KEY = "daycmd.suggestions.open";
const BRIEF_EXPANDED_KEY = "daycmd.brief.expanded";

type TasksResp = { tasks: ObsidianTask[] };
type GhResp = GhSummary | { error: string };
type GmailResp =
  | { messages: GmailMsg[]; configured: boolean; connected: boolean }
  | { error: string; configured: boolean; connected: boolean };
type ErrorsResp = { errors: ErrorRow[] };
type UsageResp = {
  today: { cost: number };
  month: { cost: number };
  daily: { date: string; cost?: number; tokens: number }[];
  vaultConfigured?: boolean;
};
type HeatResp = { days: number[] };
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
  const daily = usePoll<DailyResp>("/api/obsidian/daily", 60_000).data;

  const today = new Date().toISOString().slice(0, 10);
  const allTasks = tasks?.tasks ?? [];

  const focus = usePoll<FocusResp>("/api/micro/today-focus", 30 * 60_000).data;
  const [focusBusy, setFocusBusy] = useState(false);
  async function refreshFocus() {
    setFocusBusy(true);
    try {
      // Bust cache by hitting endpoint directly is fine; cache is server-side bucketed.
      // To force re-gen, append cache-bust param; harmless since the route ignores params.
      await fetch(`/api/micro/today-focus?t=${Date.now()}`, { cache: "no-store" });
      mutate("/api/micro/today-focus");
    } finally {
      setFocusBusy(false);
    }
  }

  const suggestionsResp = usePoll<SuggestionsResp>(
    "/api/micro/today-suggestions",
    15 * 60_000,
  ).data;
  const suggestions = suggestionsResp?.suggestions ?? [];
  const [suggestionsOpen, setSuggestionsOpen] = useState(false);
  useEffect(() => {
    try {
      const stored = localStorage.getItem(SUGGESTIONS_OPEN_KEY);
      if (stored !== null) setSuggestionsOpen(stored === "1");
    } catch {}
  }, []);
  function toggleSuggestionsOpen() {
    setSuggestionsOpen((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(SUGGESTIONS_OPEN_KEY, next ? "1" : "0");
      } catch {}
      return next;
    });
  }

  const brief = usePoll<BriefResp>("/api/micro/morning-brief", 30 * 60_000).data;
  const [briefBusy, setBriefBusy] = useState(false);
  const [briefExpanded, setBriefExpanded] = useState(false);
  useEffect(() => {
    try {
      setBriefExpanded(localStorage.getItem(BRIEF_EXPANDED_KEY) === "1");
    } catch {}
  }, []);
  function toggleBriefExpanded() {
    setBriefExpanded((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(BRIEF_EXPANDED_KEY, next ? "1" : "0");
      } catch {}
      return next;
    });
  }
  async function runBrief() {
    setBriefBusy(true);
    try {
      await apiFetch("/api/micro/morning-brief", { method: "POST" });
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
      const res = await apiFetch("/api/obsidian/tasks", {
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
  const noteWords = daily?.exists
    ? daily.content.trim().split(/\s+/).filter(Boolean).length
    : 0;
  const todaySpend = usage?.today.cost ?? 0;

  const monthSpend = usage?.month?.cost ?? 0;

  const stats: {
    label: string;
    value: string;
    tone?: string;
    jump?: SectionKey;
    footnote?: string;
  }[] = [];
  stats.push({ label: "closed", value: String(closedToday), tone: "var(--c-tasks)", jump: "tasks" });
  stats.push({ label: "commits", value: String(commitsToday), tone: "var(--c-github)", jump: "github" });
  stats.push({ label: "note words", value: String(noteWords), tone: "var(--c-obsidian)", jump: "note" });
  stats.push({
    label: "ai spend",
    value: `$${todaySpend.toFixed(2)}`,
    tone: "var(--c-agent)",
    footnote: `$${monthSpend.toFixed(2)} this month`,
  });
  const visibleStats = stats.slice(0, 4);

  // Client-side alerts — only show when conditions trigger. No AI cost.
  const alertsHud: string[] = [];
  if (overdueCount >= 3) {
    alertsHud.push(`${overdueCount} overdue tasks — momentum slipping.`);
  }
  const nowHr = new Date().getHours();
  if (nowHr < 11 && allTasks.some((t) => t.priority === "high" || t.priority === "highest")) {
    const hi = allTasks.filter(
      (t) => (t.priority === "high" || t.priority === "highest") && !t.done && !t.cancelled,
    ).length;
    if (hi > 0 && overdueCount < 3) {
      alertsHud.push(`Quiet morning — best window for the ${hi} high-pri task${hi === 1 ? "" : "s"}.`);
    }
  }
  if (openErrors >= 5) {
    alertsHud.push(`${openErrors} open errors — worth a sweep.`);
  }

  const [busySuggestion, setBusySuggestion] = useState<string | null>(null);
  const [suggestionResult, setSuggestionResult] = useState<
    Record<string, { kind: "ok" | "error"; message: string }>
  >({});

  async function applySuggestion(s: Suggestion) {
    setBusySuggestion(s.id);
    try {
      let inferDue: string | null = null;
      let inferPriority: string | null = null;
      let subtasks: string[] = [];

      if (s.action === "infer-due") {
        const r = await apiFetch("/api/micro/task-infer-due", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ text: s.task.text }),
        });
        const j = (await r.json()) as {
          due: string | null;
          priority: string | null;
          error?: string;
        };
        if (j.error) throw new Error(j.error);
        inferDue = j.due;
        inferPriority = j.priority;
      } else if (s.action === "reschedule") {
        const r = await apiFetch("/api/micro/task-reschedule", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ text: s.task.text, currentDue: s.task.due }),
        });
        const j = (await r.json()) as { due: string | null; error?: string };
        if (j.error) throw new Error(j.error);
        inferDue = j.due;
      } else {
        const r = await apiFetch("/api/micro/task-split", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ text: s.task.text }),
        });
        const j = (await r.json()) as { subtasks: string[]; error?: string };
        if (j.error) throw new Error(j.error);
        subtasks = j.subtasks ?? [];
      }

      if (s.action === "split") {
        if (subtasks.length === 0) {
          setSuggestionResult((p) => ({
            ...p,
            [s.id]: { kind: "error", message: "Task already atomic — nothing to split." },
          }));
          return;
        }
        const file = s.task.file.split("/").pop()?.replace(/\.md$/, "");
        for (const text of subtasks) {
          const res = await apiFetch("/api/obsidian/tasks", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
              text,
              file,
              due: s.task.due ?? undefined,
              priority: s.task.priority ?? undefined,
            }),
          });
          if (!res.ok) {
            const j = (await res.json().catch(() => ({}))) as { error?: string };
            throw new Error(j.error ?? `HTTP ${res.status}`);
          }
        }
        mutate("/api/obsidian/tasks");
        mutate("/api/micro/today-suggestions");
        setSuggestionResult((p) => ({
          ...p,
          [s.id]: { kind: "ok", message: `Created ${subtasks.length} subtasks.` },
        }));
      } else {
        if (!inferDue) {
          setSuggestionResult((p) => ({
            ...p,
            [s.id]: { kind: "error", message: "No date signal in this task." },
          }));
          return;
        }
        const res = await apiFetch("/api/obsidian/tasks", {
          method: "PUT",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            file: s.task.file,
            line: s.task.line,
            originalText: s.task.text,
            text: s.task.text,
            due: inferDue,
            priority: inferPriority ?? s.task.priority ?? undefined,
          }),
        });
        if (!res.ok) {
          const j = (await res.json().catch(() => ({}))) as { error?: string };
          throw new Error(j.error ?? `HTTP ${res.status}`);
        }
        mutate("/api/obsidian/tasks");
        mutate("/api/micro/today-suggestions");
        setSuggestionResult((p) => ({
          ...p,
          [s.id]: { kind: "ok", message: `Due → ${inferDue}.` },
        }));
      }
    } catch (e) {
      setSuggestionResult((p) => ({
        ...p,
        [s.id]: { kind: "error", message: (e as Error).message },
      }));
    } finally {
      setBusySuggestion(null);
    }
  }

  const vaultMissing = !!usage && usage.vaultConfigured === false;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 44 }}>
      {vaultMissing && (
        <div
          className="t-mono"
          style={{
            fontSize: 11,
            color: "var(--c-error)",
            padding: "8px 10px",
            border: "1px dashed var(--c-error)",
            borderRadius: 4,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 8,
          }}
        >
          <span>
            VAULT_PATH not set — AI spend, tasks, and notes won&apos;t persist or
            sync. Configure in <code>.env.local</code> and restart the server.
          </span>
          <a
            href="/settings"
            style={{ color: "var(--c-agent)", whiteSpace: "nowrap" }}
          >
            settings →
          </a>
        </div>
      )}
      {/* Focus card — compact AI surface */}
      <section
        className="dimmable"
        style={{
          marginTop: -4,
          border: "1px solid oklch(from var(--c-agent) l c h / 0.18)",
          borderRadius: 10,
          padding: "12px 18px",
          background: "oklch(from var(--c-agent) l c h / 0.03)",
        }}
      >
        <div className="flex items-baseline gap-2.5">
          <span style={{ color: "var(--c-agent)", fontSize: 14, lineHeight: 1.2 }}>
            ✦
          </span>
          <div className="flex-1 min-w-0">
            {focus?.focus ? (
              <p
                style={{
                  fontSize: 15,
                  lineHeight: 1.45,
                  color: "var(--fg)",
                  letterSpacing: "-0.005em",
                }}
              >
                {focus.focus}
              </p>
            ) : (
              <p
                className="text-fg-soft"
                style={{ fontSize: 13, lineHeight: 1.45 }}
              >
                {focus?.error ?? "Picking today's focus…"}
              </p>
            )}
          </div>
          <span className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={refreshFocus}
              disabled={focusBusy}
              title="Re-pick focus"
              className="t-mono"
              style={{
                background: "transparent",
                border: "1px solid var(--rule)",
                borderRadius: 6,
                padding: "2px 8px",
                fontSize: 10,
                color: focusBusy ? "var(--fg-soft)" : "var(--c-agent)",
                cursor: focusBusy ? "wait" : "pointer",
                letterSpacing: "0.04em",
              }}
            >
              {focusBusy ? "…" : "refresh"}
            </button>
          </span>
        </div>

        {alertsHud.length > 0 && (
          <div
            style={{
              marginTop: 10,
              paddingTop: 8,
              borderTop: "1px solid oklch(from var(--c-agent) l c h / 0.12)",
              display: "flex",
              flexDirection: "column",
              gap: 4,
            }}
          >
            {alertsHud.map((a, i) => (
              <div
                key={i}
                className="t-mono"
                style={{
                  fontSize: 11,
                  color: "var(--fg-soft)",
                  letterSpacing: "0.01em",
                }}
              >
                <span style={{ color: "var(--c-error)", marginRight: 6 }}>!</span>
                {a}
              </div>
            ))}
          </div>
        )}

        {(suggestions.length > 0 || brief?.brief) && (
          <div
            style={{
              marginTop: 10,
              paddingTop: 8,
              borderTop: "1px solid oklch(from var(--c-agent) l c h / 0.12)",
              display: "flex",
              alignItems: "center",
              gap: 8,
              flexWrap: "wrap",
            }}
          >
            {suggestions.length > 0 && (
              <button
                type="button"
                onClick={toggleSuggestionsOpen}
                className="t-mono"
                style={{
                  background: suggestionsOpen
                    ? "oklch(from var(--c-agent) l c h / 0.14)"
                    : "transparent",
                  border: `1px solid ${suggestionsOpen ? "oklch(from var(--c-agent) l c h / 0.32)" : "var(--rule)"}`,
                  borderRadius: 6,
                  padding: "2px 8px",
                  fontSize: 10,
                  color: suggestionsOpen ? "var(--c-agent)" : "var(--fg-soft)",
                  cursor: "pointer",
                  letterSpacing: "0.04em",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 4,
                }}
              >
                <span style={{ fontSize: 11, lineHeight: 1 }}>✦</span>
                {suggestionsOpen ? "hide" : "suggested"} ({suggestions.length})
              </button>
            )}
            <button
              type="button"
              onClick={toggleBriefExpanded}
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
              {briefExpanded ? "− full brief" : brief?.brief ? "+ full brief" : "+ run full brief"}
            </button>
            {brief?.brief && (
              <span
                className="t-mono text-fg-soft"
                style={{ fontSize: 10 }}
                title={new Date(brief.brief.ts).toLocaleString()}
              >
                brief {briefIsToday ? "today" : "stale"} ·{" "}
                {new Date(brief.brief.ts).toLocaleString([], {
                  month: "short",
                  day: "numeric",
                  hour: "numeric",
                  minute: "2-digit",
                })}
              </span>
            )}
          </div>
        )}

        {suggestionsOpen && suggestions.length > 0 && (
          <div
            style={{
              marginTop: 10,
              display: "flex",
              flexDirection: "column",
              gap: 6,
            }}
          >
            {suggestions.map((s) => {
              const result = suggestionResult[s.id];
              const busy = busySuggestion === s.id;
              return (
                <div
                  key={s.id}
                  className="flex items-center gap-3"
                  style={{
                    fontSize: 12,
                    padding: "4px 0",
                  }}
                >
                  <span
                    className="t-mono"
                    style={{
                      fontSize: 9,
                      color: "var(--c-agent)",
                      letterSpacing: "0.08em",
                      width: 60,
                      flexShrink: 0,
                    }}
                  >
                    {s.action === "infer-due"
                      ? "DUE"
                      : s.action === "reschedule"
                        ? "WHEN"
                        : "SPLIT"}
                  </span>
                  <span
                    className="flex-1 truncate"
                    style={{ color: "var(--fg)" }}
                    title={s.task.text}
                  >
                    {s.label}
                  </span>
                  {result && (
                    <span
                      className="t-mono"
                      style={{
                        fontSize: 10,
                        color:
                          result.kind === "ok"
                            ? "var(--c-good)"
                            : "var(--c-error)",
                      }}
                    >
                      {result.message}
                    </span>
                  )}
                  {!result && (
                    <button
                      type="button"
                      onClick={() => applySuggestion(s)}
                      disabled={busy}
                      className="t-mono"
                      style={{
                        background: "transparent",
                        border: "1px solid var(--rule)",
                        borderRadius: 4,
                        padding: "2px 8px",
                        fontSize: 10,
                        color: busy ? "var(--fg-soft)" : "var(--c-good)",
                        cursor: busy ? "wait" : "pointer",
                        letterSpacing: "0.04em",
                      }}
                    >
                      {busy ? "…" : "✓ apply"}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {briefExpanded && (
          <div
            style={{
              marginTop: 10,
              paddingTop: 10,
              borderTop: "1px solid oklch(from var(--c-agent) l c h / 0.12)",
            }}
          >
            {!brief?.brief && (
              <div className="flex items-center gap-2">
                <p
                  className="text-fg-soft"
                  style={{ fontSize: 12, flex: 1 }}
                >
                  No brief yet today. Runs daily at 8am.
                </p>
                <button
                  type="button"
                  onClick={runBrief}
                  disabled={briefBusy}
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
                  {briefBusy ? "running…" : "run now"}
                </button>
              </div>
            )}
            {brief?.brief && (
              <>
                <div
                  className="flex items-center gap-2"
                  style={{ marginBottom: 6 }}
                >
                  <span
                    className="t-eyebrow"
                    style={{
                      color: "var(--c-agent)",
                      letterSpacing: "0.08em",
                    }}
                  >
                    Full Brief
                  </span>
                  <button
                    type="button"
                    onClick={runBrief}
                    disabled={briefBusy}
                    className="t-mono ml-auto"
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
                    {briefBusy ? "running…" : "refresh"}
                  </button>
                </div>
                <div style={{ fontSize: 12.5 }}>
                  <Markdown>{brief.brief.output}</Markdown>
                </div>
              </>
            )}
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
            alignItems: "start",
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
              {s.footnote && (
                <span
                  className="t-mono"
                  style={{
                    fontSize: 9.5,
                    letterSpacing: "0.04em",
                    color: "var(--fg-soft)",
                    opacity: 0.7,
                    marginTop: 1,
                  }}
                >
                  {s.footnote}
                </span>
              )}
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
