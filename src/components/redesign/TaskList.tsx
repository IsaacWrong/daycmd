"use client";

import { usePoll } from "@/lib/hooks";
import type { ObsidianTask, Priority } from "@/lib/tasks-parser";
import { Section } from "./Section";

const PRIO_GLYPH: Record<NonNullable<Priority>, string> = {
  highest: "🔺",
  high: "⏫",
  medium: "🔼",
  low: "🔽",
  lowest: "⏬",
};

function fmtDue(due: string | null): string {
  if (!due) return "—";
  const today = new Date().toISOString().slice(0, 10);
  if (due < today) return "overdue";
  if (due === today) return "today";
  return due.slice(5);
}

function TaskRow({ t, onToggle }: { t: ObsidianTask; onToggle: (t: ObsidianTask) => void }) {
  const prioColor =
    t.priority === "highest" || t.priority === "high"
      ? "var(--c-error)"
      : "var(--fg-soft)";
  return (
    <div className="flex items-center gap-3 py-2 text-[14px]">
      <button
        type="button"
        onClick={() => onToggle(t)}
        className={`check ${t.done ? "done" : ""}`}
        aria-label={t.done ? "Mark undone" : "Mark done"}
      />
      <span className="src-dot src-tasks" />
      <span
        className="flex-1 truncate"
        style={{
          letterSpacing: "-0.005em",
          textDecoration: t.done ? "line-through" : "none",
          opacity: t.done ? 0.5 : 1,
        }}
      >
        {t.text}
      </span>
      {t.priority && (
        <span
          className="t-mono text-[11px]"
          style={{ color: prioColor, letterSpacing: "0.04em" }}
        >
          {PRIO_GLYPH[t.priority]}
        </span>
      )}
      <span
        className="t-mono t-num text-[11px] text-fg-soft"
        style={{ minWidth: 56, textAlign: "right" }}
      >
        {fmtDue(t.due)}
      </span>
    </div>
  );
}

export function TaskList({ projectFilter }: { projectFilter?: string }) {
  const { data, refresh } = usePoll<{ tasks: ObsidianTask[] }>(
    "/api/obsidian/tasks",
    60_000,
  );
  const all = data?.tasks ?? [];
  const filtered = projectFilter
    ? all.filter((t) => t.file.toLowerCase().includes(projectFilter.toLowerCase()))
    : all;
  const open = filtered.filter((t) => !t.done && !t.cancelled);
  const today = new Date().toISOString().slice(0, 10);
  const due = open.filter((t) => t.due && t.due <= today).length;
  const later = open.length - due;

  async function toggle(t: ObsidianTask) {
    if (t.done) return;
    try {
      await fetch("/api/obsidian/tasks", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ file: t.file, text: t.text }),
      });
      refresh();
    } catch {}
  }

  return (
    <Section
      eyebrow="Today"
      title="Tasks"
      count={open.length}
      accent="tasks"
      right={
        <span className="t-mono text-[11px] text-fg-soft">
          {due} due · {later} later
        </span>
      }
    >
      {open.slice(0, 6).map((t) => (
        <TaskRow key={t.id} t={t} onToggle={toggle} />
      ))}
      {open.length === 0 && (
        <p className="text-[13px] text-fg-soft py-1">All clear.</p>
      )}
    </Section>
  );
}
