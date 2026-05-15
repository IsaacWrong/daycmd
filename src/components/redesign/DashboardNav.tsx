"use client";

import Link from "next/link";
import { usePoll } from "@/lib/hooks";
import type { GhSummary } from "@/lib/github";
import type { CalEvent } from "@/lib/calendar";
import type { GmailMsg } from "@/lib/gmail";
import type { ObsidianTask } from "@/lib/tasks-parser";
import type { ErrorRow } from "@/lib/errors";
import type { CategoryStats } from "@/lib/kb";

export type SectionKey =
  | "overview"
  | "tasks"
  | "note"
  | "calendar"
  | "mail"
  | "github"
  | "errors"
  | "knowledge";

export const SECTIONS: ReadonlyArray<{
  key: SectionKey;
  label: string;
  accent: string;
}> = [
  { key: "overview", label: "Overview", accent: "agent" },
  { key: "tasks", label: "Tasks", accent: "tasks" },
  { key: "note", label: "Daily Note", accent: "obsidian" },
  { key: "calendar", label: "Calendar", accent: "calendar" },
  { key: "mail", label: "Mail", accent: "gmail" },
  { key: "github", label: "GitHub", accent: "github" },
  { key: "knowledge", label: "Knowledge", accent: "agent" },
  { key: "errors", label: "Errors", accent: "error" },
];

type CalResp =
  | { events: CalEvent[] }
  | { error: string };
type GmailResp =
  | { messages: GmailMsg[] }
  | { error: string };
type GhResp = GhSummary | { error: string };
type TasksResp = { tasks: ObsidianTask[] };
type DailyResp = { exists: boolean; content: string };
type ErrorsResp = { errors: ErrorRow[] };
type KbResp = { categories: CategoryStats[] };

function useCounts(): Record<SectionKey, number> {
  const tasks = usePoll<TasksResp>("/api/obsidian/tasks", 60_000).data;
  const cal = usePoll<CalResp>("/api/calendar", 60_000).data;
  const mail = usePoll<GmailResp>("/api/gmail", 60_000).data;
  const gh = usePoll<GhResp>("/api/github", 60_000).data;
  const daily = usePoll<DailyResp>("/api/obsidian/daily", 60_000).data;
  const errors = usePoll<ErrorsResp>("/api/errors", 60_000).data;
  const kb = usePoll<KbResp>("/api/kb", 5 * 60_000).data;

  const taskCount = (tasks?.tasks ?? []).filter(
    (t) => !t.done && !t.cancelled,
  ).length;
  const events = cal && "events" in cal ? cal.events : [];
  const calCount = events.length;
  const messages = mail && "messages" in mail ? mail.messages : [];
  const mailCount = messages.filter((m) => m.unread).length;
  const ghCount =
    gh && !("error" in gh)
      ? gh.reviewRequested.length + gh.authored.length
      : 0;
  const noteCount = daily?.exists
    ? daily.content.trim().split(/\s+/).filter(Boolean).length
    : 0;
  const errorCount = errors?.errors?.length ?? 0;
  const kbCount = kb?.categories?.length ?? 0;

  return {
    overview: 0,
    tasks: taskCount,
    note: noteCount,
    calendar: calCount,
    mail: mailCount,
    github: ghCount,
    errors: errorCount,
    knowledge: kbCount,
  };
}

export function DashboardNav({
  selected,
  onSelect,
}: {
  selected: SectionKey;
  onSelect: (k: SectionKey) => void;
}) {
  const counts = useCounts();

  return (
    <div className="flex flex-col h-full">
    <nav className="flex flex-col gap-1">
      {SECTIONS.map((s) => {
        const active = s.key === selected;
        const count = counts[s.key];
        return (
          <button
            key={s.key}
            type="button"
            onClick={() => onSelect(s.key)}
            className="flex items-center gap-2.5 text-left w-full"
            style={{
              background: active
                ? "oklch(from var(--fg) l c h / 0.06)"
                : "transparent",
              border: 0,
              borderRadius: 8,
              padding: "10px 12px",
              cursor: "pointer",
              color: active ? "var(--fg)" : "var(--fg-soft)",
              fontSize: 13,
              letterSpacing: "-0.005em",
              transition: "background 120ms ease, color 120ms ease",
            }}
          >
            <span
              className="src-dot"
              style={{
                width: 6,
                height: 6,
                background: `var(--c-${s.accent})`,
                opacity: active ? 1 : 0.55,
              }}
            />
            <span style={{ fontWeight: active ? 500 : 400 }}>{s.label}</span>
            {s.key !== "overview" && (
              <span
                className="t-mono t-num ml-auto"
                style={{
                  fontSize: 10,
                  color: count > 0 ? `var(--c-${s.accent})` : "var(--fg-soft)",
                  opacity: count > 0 ? 1 : 0.5,
                }}
              >
                {count}
              </span>
            )}
          </button>
        );
      })}
    </nav>

    <div
      style={{
        marginTop: "auto",
        paddingTop: 14,
        borderTop: "1px solid var(--rule)",
      }}
    >
      <Link
        href="/settings"
        className="t-mono text-[12px] text-fg-soft hover:text-fg cursor-pointer"
        style={{ padding: "10px 12px", display: "block" }}
      >
        settings
      </Link>
    </div>
    </div>
  );
}
