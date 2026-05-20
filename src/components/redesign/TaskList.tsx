"use client";

import { useEffect, useRef, useState } from "react";
import { mutate, usePoll } from "@/lib/hooks";
import type { ObsidianTask, Priority } from "@/lib/tasks-parser";
import { Section } from "./Section";
import { apiFetch } from "@/lib/fetch-client";

const PRIO_GLYPH: Record<NonNullable<Priority>, string> = {
  highest: "🔺",
  high: "⏫",
  medium: "🔼",
  low: "🔽",
  lowest: "⏬",
};

export function formatTaskForEdit(t: ObsidianTask): string {
  const parts: string[] = [t.text];
  if (t.priority) parts.push(`!${t.priority}`);
  if (t.due) parts.push(`📅 ${t.due}`);
  return parts.join(" ");
}

function fmtDue(due: string | null): string {
  if (!due) return "—";
  const today = new Date().toISOString().slice(0, 10);
  if (due < today) return "overdue";
  if (due === today) return "today";
  return due.slice(5);
}

type AiSuggestion =
  | { kind: "due"; due: string | null; priority: string | null; reason: string }
  | { kind: "split"; subtasks: string[]; reason: string }
  | { kind: "reschedule"; due: string | null; reason: string }
  | { kind: "error"; message: string }
  | { kind: "loading"; action: "due" | "split" | "reschedule" };

function TaskRow({
  t,
  onToggle,
  onEdit,
  onSplit,
}: {
  t: ObsidianTask;
  onToggle: (t: ObsidianTask) => void;
  onEdit: (t: ObsidianTask, draft: string) => Promise<{ ok: boolean; error?: string }>;
  onSplit: (t: ObsidianTask, subtasks: string[]) => Promise<{ ok: boolean; error?: string }>;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [ai, setAi] = useState<AiSuggestion | null>(null);
  const [aiBusy, setAiBusy] = useState(false);

  useEffect(() => {
    if (editing) {
      requestAnimationFrame(() => inputRef.current?.select());
    }
  }, [editing]);

  function startEdit() {
    if (t.done) return;
    setDraft(formatTaskForEdit(t));
    setError(null);
    setEditing(true);
  }

  async function commit() {
    if (busy) return;
    if (!draft.trim() || draft.trim() === formatTaskForEdit(t)) {
      setEditing(false);
      return;
    }
    setBusy(true);
    const res = await onEdit(t, draft);
    setBusy(false);
    if (res.ok) {
      setEditing(false);
    } else {
      setError(res.error ?? "save failed");
    }
  }

  async function runAi(action: "due" | "split" | "reschedule") {
    setAi({ kind: "loading", action });
    setAiBusy(true);
    try {
      if (action === "due") {
        const res = await apiFetch("/api/micro/task-infer-due", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ text: t.text }),
        });
        const json = (await res.json()) as
          | { due: string | null; priority: string | null; reason: string }
          | { error: string };
        if ("error" in json) setAi({ kind: "error", message: json.error });
        else setAi({ kind: "due", ...json });
      } else if (action === "split") {
        const res = await apiFetch("/api/micro/task-split", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ text: t.text }),
        });
        const json = (await res.json()) as
          | { subtasks: string[]; reason: string }
          | { error: string };
        if ("error" in json) setAi({ kind: "error", message: json.error });
        else setAi({ kind: "split", ...json });
      } else {
        const res = await apiFetch("/api/micro/task-reschedule", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ text: t.text, currentDue: t.due }),
        });
        const json = (await res.json()) as
          | { due: string | null; reason: string }
          | { error: string };
        if ("error" in json) setAi({ kind: "error", message: json.error });
        else setAi({ kind: "reschedule", ...json });
      }
    } catch (e) {
      setAi({ kind: "error", message: (e as Error).message });
    } finally {
      setAiBusy(false);
    }
  }

  async function acceptDue(due: string) {
    setAiBusy(true);
    try {
      const draftStr = `${t.text}${t.priority ? ` !${t.priority}` : ""} 📅 ${due}`;
      const res = await onEdit(t, draftStr);
      if (res.ok) setAi(null);
      else setAi({ kind: "error", message: res.error ?? "save failed" });
    } finally {
      setAiBusy(false);
    }
  }

  async function acceptSplit(subtasks: string[]) {
    setAiBusy(true);
    try {
      const res = await onSplit(t, subtasks);
      if (res.ok) setAi(null);
      else setAi({ kind: "error", message: res.error ?? "split failed" });
    } finally {
      setAiBusy(false);
    }
  }

  const prioColor =
    t.priority === "highest" || t.priority === "high"
      ? "var(--c-error)"
      : "var(--fg-soft)";

  if (editing) {
    return (
      <div className="flex items-center gap-3 py-2.5 text-[14px]">
        <button
          type="button"
          className={`check ${t.done ? "done" : ""}`}
          aria-hidden
          tabIndex={-1}
          style={{ opacity: 0.4, cursor: "default" }}
        />
        <span className="src-dot src-tasks" />
        <input
          ref={inputRef}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              void commit();
            } else if (e.key === "Escape") {
              e.preventDefault();
              setEditing(false);
              setError(null);
            }
          }}
          onBlur={() => {
            if (!busy) void commit();
          }}
          disabled={busy}
          style={{
            flex: 1,
            minWidth: 0,
            background: "transparent",
            border: 0,
            outline: 0,
            color: "var(--fg)",
            fontFamily: "inherit",
            fontSize: 14,
            letterSpacing: "-0.005em",
            borderBottom: "1px solid var(--c-tasks)",
          }}
        />
        {error && (
          <span
            className="t-mono text-[10px]"
            style={{ color: "var(--c-error)" }}
          >
            {error}
          </span>
        )}
        <span className="t-mono text-[10px] text-fg-soft">⏎ save · esc</span>
      </div>
    );
  }

  const aiBtnStyle: React.CSSProperties = {
    background: "transparent",
    border: 0,
    padding: "0 4px",
    fontSize: 10,
    color: "var(--fg-soft)",
    cursor: aiBusy ? "wait" : "pointer",
    letterSpacing: "0.04em",
    fontFamily:
      "ui-monospace, SFMono-Regular, 'SF Mono', Menlo, Consolas, monospace",
  };

  return (
    <div className="group">
      <div className="flex items-center gap-3 py-2 text-[14px]">
        <button
          type="button"
          onClick={() => onToggle(t)}
          className={`check ${t.done ? "done" : ""}`}
          aria-label={t.done ? "Mark undone" : "Mark done"}
        />
        <span className="src-dot src-tasks" />
        <button
          type="button"
          onClick={startEdit}
          disabled={t.done}
          className="flex-1 truncate text-left"
          title="Click to edit"
          style={{
            background: "transparent",
            border: 0,
            padding: 0,
            fontFamily: "inherit",
            fontSize: 14,
            letterSpacing: "-0.005em",
            color: "var(--fg)",
            textDecoration: t.done ? "line-through" : "none",
            opacity: t.done ? 0.5 : 1,
            cursor: t.done ? "default" : "text",
          }}
        >
          {t.text}
        </button>
        {!t.done && (
          <span
            className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
            aria-label="AI task actions"
          >
            <button
              type="button"
              onClick={() => runAi("due")}
              disabled={aiBusy}
              title="Infer due date + priority"
              style={aiBtnStyle}
            >
              ✦ due
            </button>
            <button
              type="button"
              onClick={() => runAi("split")}
              disabled={aiBusy}
              title="Break into subtasks"
              style={aiBtnStyle}
            >
              ✦ split
            </button>
            <button
              type="button"
              onClick={() => runAi("reschedule")}
              disabled={aiBusy}
              title="Suggest a better day"
              style={aiBtnStyle}
            >
              ✦ when
            </button>
          </span>
        )}
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
      {ai && (
        <div
          style={{
            padding: "6px 10px 8px 44px",
            borderLeft: "1px solid oklch(from var(--c-agent) l c h / 0.18)",
            marginLeft: 8,
            marginBottom: 4,
            fontSize: 11.5,
            lineHeight: 1.5,
            color: "var(--fg-soft)",
          }}
        >
          {ai.kind === "loading" && <span>✦ thinking…</span>}
          {ai.kind === "error" && (
            <span style={{ color: "var(--c-error)" }}>{ai.message}</span>
          )}
          {ai.kind === "due" && (
            <div className="flex items-center gap-2">
              <span style={{ color: "var(--c-agent)" }}>✦</span>
              <span>
                {ai.due ? <strong>{ai.due}</strong> : <em>no due signal</em>}
                {ai.priority && (
                  <span className="t-mono" style={{ marginLeft: 6, fontSize: 10 }}>
                    !{ai.priority}
                  </span>
                )}
                <span style={{ marginLeft: 8 }}>— {ai.reason}</span>
              </span>
              <span className="ml-auto flex gap-1.5">
                {ai.due && (
                  <button
                    type="button"
                    onClick={() => acceptDue(ai.due!)}
                    disabled={aiBusy}
                    className="t-mono"
                    style={{
                      background: "transparent",
                      border: "1px solid var(--rule)",
                      borderRadius: 4,
                      padding: "2px 8px",
                      fontSize: 10,
                      color: "var(--c-good)",
                      cursor: aiBusy ? "wait" : "pointer",
                    }}
                  >
                    ✓ apply
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setAi(null)}
                  className="t-mono"
                  style={{
                    background: "transparent",
                    border: "1px solid var(--rule)",
                    borderRadius: 4,
                    padding: "2px 8px",
                    fontSize: 10,
                    color: "var(--fg-soft)",
                    cursor: "pointer",
                  }}
                >
                  dismiss
                </button>
              </span>
            </div>
          )}
          {ai.kind === "reschedule" && (
            <div className="flex items-center gap-2">
              <span style={{ color: "var(--c-agent)" }}>✦</span>
              <span>
                {ai.due ? <strong>{ai.due}</strong> : <em>no date</em>}
                <span style={{ marginLeft: 8 }}>— {ai.reason}</span>
              </span>
              <span className="ml-auto flex gap-1.5">
                {ai.due && (
                  <button
                    type="button"
                    onClick={() => acceptDue(ai.due!)}
                    disabled={aiBusy}
                    className="t-mono"
                    style={{
                      background: "transparent",
                      border: "1px solid var(--rule)",
                      borderRadius: 4,
                      padding: "2px 8px",
                      fontSize: 10,
                      color: "var(--c-good)",
                      cursor: aiBusy ? "wait" : "pointer",
                    }}
                  >
                    ✓ reschedule
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setAi(null)}
                  className="t-mono"
                  style={{
                    background: "transparent",
                    border: "1px solid var(--rule)",
                    borderRadius: 4,
                    padding: "2px 8px",
                    fontSize: 10,
                    color: "var(--fg-soft)",
                    cursor: "pointer",
                  }}
                >
                  dismiss
                </button>
              </span>
            </div>
          )}
          {ai.kind === "split" && (
            <div>
              <div className="flex items-center gap-2" style={{ marginBottom: 4 }}>
                <span style={{ color: "var(--c-agent)" }}>✦</span>
                <span>{ai.reason}</span>
                <span className="ml-auto flex gap-1.5">
                  {ai.subtasks.length > 0 && (
                    <button
                      type="button"
                      onClick={() => acceptSplit(ai.subtasks)}
                      disabled={aiBusy}
                      className="t-mono"
                      style={{
                        background: "transparent",
                        border: "1px solid var(--rule)",
                        borderRadius: 4,
                        padding: "2px 8px",
                        fontSize: 10,
                        color: "var(--c-good)",
                        cursor: aiBusy ? "wait" : "pointer",
                      }}
                    >
                      ✓ create {ai.subtasks.length}
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setAi(null)}
                    className="t-mono"
                    style={{
                      background: "transparent",
                      border: "1px solid var(--rule)",
                      borderRadius: 4,
                      padding: "2px 8px",
                      fontSize: 10,
                      color: "var(--fg-soft)",
                      cursor: "pointer",
                    }}
                  >
                    dismiss
                  </button>
                </span>
              </div>
              {ai.subtasks.length > 0 && (
                <ul style={{ margin: 0, paddingLeft: 16, listStyle: "disc" }}>
                  {ai.subtasks.map((s, i) => (
                    <li key={i} style={{ color: "var(--fg)" }}>
                      {s}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

type Bucket = "overdue" | "today" | "upcoming" | "someday";

function bucketOf(due: string | null, today: string): Bucket {
  if (!due) return "someday";
  if (due < today) return "overdue";
  if (due === today) return "today";
  return "upcoming";
}

const BUCKET_ORDER: Bucket[] = ["overdue", "today", "upcoming", "someday"];
const BUCKET_LABEL: Record<Bucket, string> = {
  overdue: "Overdue",
  today: "Today",
  upcoming: "Upcoming",
  someday: "Someday",
};
const BUCKET_COLOR: Record<Bucket, string> = {
  overdue: "var(--c-error)",
  today: "var(--c-tasks)",
  upcoming: "var(--fg-soft)",
  someday: "var(--fg-soft)",
};

export type ParsedDraft = {
  text: string;
  due?: string;
  priority?: NonNullable<Priority>;
  file?: string;
};

const PRIORITY_WORDS: Record<string, NonNullable<Priority>> = {
  highest: "highest",
  high: "high",
  hi: "high",
  med: "medium",
  medium: "medium",
  low: "low",
  lowest: "lowest",
};

export function parseDraft(input: string): ParsedDraft {
  let s = input;
  const out: ParsedDraft = { text: "" };

  const dueIso = s.match(/(?:📅\s*|due:)(\d{4}-\d{2}-\d{2})/);
  if (dueIso) {
    out.due = dueIso[1];
    s = s.replace(dueIso[0], "");
  } else if (/(^|\s)(today|tomorrow)(\s|$)/i.test(s)) {
    const m = s.match(/(^|\s)(today|tomorrow)(\s|$)/i)!;
    const d = new Date();
    if (m[2].toLowerCase() === "tomorrow") d.setDate(d.getDate() + 1);
    out.due = d.toISOString().slice(0, 10);
    s = s.replace(m[0], " ");
  }

  const prio = s.match(/(?:^|\s)!(highest|high|hi|med|medium|low|lowest)(?=\s|$)/i);
  if (prio) {
    out.priority = PRIORITY_WORDS[prio[1].toLowerCase()];
    s = s.replace(prio[0], "");
  }

  const file = s.match(/(?:^|\s)@([\w.-]+)(?=\s|$)/);
  if (file) {
    out.file = file[1];
    s = s.replace(file[0], "");
  }

  out.text = s.replace(/\s+/g, " ").trim();
  return out;
}

function NewTaskRow({ projectFilter }: { projectFilter?: string }) {
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const draft = parseDraft(input);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!draft.text || busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await apiFetch("/api/obsidian/tasks", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          text: draft.text,
          due: draft.due,
          priority: draft.priority,
          file: draft.file ?? projectFilter,
        }),
      });
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string };
        setError(j.error ?? `HTTP ${res.status}`);
        return;
      }
      setInput("");
      mutate("/api/obsidian/tasks");
      inputRef.current?.focus();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const chips: string[] = [];
  if (draft.due) chips.push(`📅 ${draft.due}`);
  if (draft.priority) chips.push(`!${draft.priority}`);
  if (draft.file ?? projectFilter) chips.push(`@${draft.file ?? projectFilter}`);

  return (
    <form
      onSubmit={submit}
      className="flex items-center gap-3 py-2.5 text-[14px]"
      style={{ borderTop: "1px dashed var(--rule)", marginTop: 10, paddingTop: 12 }}
    >
      <span
        className="inline-flex items-center justify-center"
        style={{
          width: 14,
          height: 14,
          border: "1.4px dashed var(--fg-soft)",
          borderRadius: 4,
          color: "var(--fg-soft)",
          fontSize: 11,
          lineHeight: 1,
        }}
      >
        +
      </span>
      <span className="src-dot src-tasks" />
      <input
        ref={inputRef}
        value={input}
        onChange={(e) => setInput(e.target.value)}
        placeholder='New task — try "Ship invoice today !high @Inbox"'
        disabled={busy}
        style={{
          flex: 1,
          minWidth: 0,
          background: "transparent",
          border: 0,
          outline: 0,
          color: "var(--fg)",
          fontFamily: "inherit",
          fontSize: 14,
          letterSpacing: "-0.005em",
        }}
      />
      {chips.length > 0 && (
        <span
          className="t-mono text-[10px]"
          style={{ color: "var(--fg-soft)", whiteSpace: "nowrap" }}
        >
          {chips.join(" · ")}
        </span>
      )}
      <button
        type="submit"
        disabled={!draft.text || busy}
        className="t-mono text-[11px]"
        style={{
          padding: "2px 8px",
          border: "1px solid var(--rule)",
          borderRadius: 4,
          background: "transparent",
          color: draft.text ? "var(--c-tasks)" : "var(--fg-soft)",
          cursor: draft.text && !busy ? "pointer" : "default",
          opacity: draft.text ? 1 : 0.6,
        }}
        title="Add task (Enter)"
      >
        {busy ? "…" : "add"}
      </button>
      {error && (
        <span className="t-mono text-[10px]" style={{ color: "var(--c-error)" }}>
          {error}
        </span>
      )}
    </form>
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

  const grouped: Record<Bucket, ObsidianTask[]> = {
    overdue: [],
    today: [],
    upcoming: [],
    someday: [],
  };
  for (const t of open) grouped[bucketOf(t.due, today)].push(t);

  // Cap visible rows at 8 across buckets, prioritising overdue → today → upcoming.
  let remaining = 8;
  const visible: Record<Bucket, ObsidianTask[]> = {
    overdue: [],
    today: [],
    upcoming: [],
    someday: [],
  };
  for (const b of BUCKET_ORDER) {
    const take = Math.min(grouped[b].length, remaining);
    visible[b] = grouped[b].slice(0, take);
    remaining -= take;
    if (remaining <= 0) break;
  }

  const firstVisible = BUCKET_ORDER.find((b) => visible[b].length > 0);

  async function toggle(t: ObsidianTask) {
    if (t.done) return;
    try {
      const res = await apiFetch("/api/obsidian/tasks", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ file: t.file, text: t.text }),
      });
      if (res.ok) mutate("/api/obsidian/tasks");
      else refresh();
    } catch {
      refresh();
    }
  }

  async function split(
    t: ObsidianTask,
    subtasks: string[],
  ): Promise<{ ok: boolean; error?: string }> {
    try {
      const file = t.file.split("/").pop()?.replace(/\.md$/, "");
      for (const text of subtasks) {
        const res = await apiFetch("/api/obsidian/tasks", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            text,
            file,
            due: t.due ?? undefined,
            priority: t.priority ?? undefined,
          }),
        });
        if (!res.ok) {
          const j = (await res.json().catch(() => ({}))) as { error?: string };
          return { ok: false, error: j.error ?? `HTTP ${res.status}` };
        }
      }
      mutate("/api/obsidian/tasks");
      return { ok: true };
    } catch (e) {
      return { ok: false, error: (e as Error).message };
    }
  }

  async function edit(
    t: ObsidianTask,
    rawDraft: string,
  ): Promise<{ ok: boolean; error?: string }> {
    const parsed = parseDraft(rawDraft);
    if (!parsed.text) return { ok: false, error: "text required" };
    try {
      const res = await apiFetch("/api/obsidian/tasks", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          file: t.file,
          line: t.line,
          originalText: t.text,
          text: parsed.text,
          due: parsed.due,
          priority: parsed.priority,
        }),
      });
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string };
        return { ok: false, error: j.error ?? `HTTP ${res.status}` };
      }
      mutate("/api/obsidian/tasks");
      return { ok: true };
    } catch (e) {
      return { ok: false, error: (e as Error).message };
    }
  }

  const headerRight = (
    <span className="t-mono text-[11px] text-fg-soft">
      {grouped.overdue.length > 0 && (
        <span style={{ color: "var(--c-error)" }}>
          {grouped.overdue.length} overdue
        </span>
      )}
      {grouped.overdue.length > 0 &&
        (grouped.today.length > 0 || grouped.upcoming.length > 0) &&
        " · "}
      {grouped.today.length > 0 && `${grouped.today.length} today`}
      {grouped.today.length > 0 && grouped.upcoming.length > 0 && " · "}
      {grouped.upcoming.length > 0 && `${grouped.upcoming.length} later`}
    </span>
  );

  return (
    <Section
      eyebrow="Today"
      title="Tasks"
      count={open.length}
      accent="tasks"
      right={headerRight}
    >
      {BUCKET_ORDER.map((b) => {
        const items = visible[b];
        if (items.length === 0) return null;
        const hidden = grouped[b].length - items.length;
        return (
          <div
            key={b}
            style={{ marginTop: b === firstVisible ? 0 : 10 }}
          >
            <div
              className="t-mono uppercase mb-1 flex items-center gap-2"
              style={{
                fontSize: 9,
                color: BUCKET_COLOR[b],
                letterSpacing: "0.08em",
              }}
            >
              <span>{BUCKET_LABEL[b]}</span>
              {hidden > 0 && <span className="opacity-70">+{hidden}</span>}
              {b !== firstVisible && (
                <span
                  className="flex-1 self-center"
                  style={{ height: 1, background: "var(--rule)" }}
                />
              )}
            </div>
            {items.map((t) => (
              <TaskRow
                key={t.id}
                t={t}
                onToggle={toggle}
                onEdit={edit}
                onSplit={split}
              />
            ))}
          </div>
        );
      })}
      {open.length === 0 && (
        <p className="text-[13px] text-fg-soft py-1">All clear.</p>
      )}
      <NewTaskRow projectFilter={projectFilter} />
    </Section>
  );
}
