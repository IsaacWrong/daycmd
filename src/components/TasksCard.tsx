"use client";

import { usePoll } from "@/lib/hooks";
import type { ObsidianTask, Priority } from "@/lib/tasks-parser";

const PRIORITY_GLYPH: Record<NonNullable<Priority>, string> = {
  highest: "🔺",
  high: "⏫",
  medium: "🔼",
  low: "🔽",
  lowest: "⏬",
};

function sourceLabel(file: string): string {
  const name = file.split("/").pop() ?? file;
  return name.replace(/\.md$/, "");
}

function dueBadge(due: string | null): string | null {
  if (!due) return null;
  const today = new Date().toISOString().slice(0, 10);
  if (due < today) return "overdue";
  if (due === today) return "today";
  return due;
}

export function TasksCard() {
  const { data, error } = usePoll<{ tasks: ObsidianTask[] }>(
    "/api/obsidian/tasks",
  );

  const open = (data?.tasks ?? []).filter((t) => !t.done && !t.cancelled);
  const grouped = new Map<string, ObsidianTask[]>();
  for (const t of open) {
    const key = sourceLabel(t.file);
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key)!.push(t);
  }

  return (
    <section className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-5 min-h-[240px] lg:col-span-2">
      <header className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-medium uppercase tracking-wider text-zinc-400">
          Tasks
        </h2>
        <span className="text-xs text-zinc-500">{open.length} open</span>
      </header>

      {error && <p className="text-sm text-red-400">{error}</p>}
      {!data && !error && <p className="text-sm text-zinc-500">Loading…</p>}

      <div className="space-y-4">
        {[...grouped.entries()].map(([group, items]) => (
          <div key={group}>
            <h3 className="text-xs font-semibold text-zinc-300 mb-1.5">
              {group}{" "}
              <span className="text-zinc-500 font-normal">({items.length})</span>
            </h3>
            <ul className="space-y-1">
              {items.slice(0, 8).map((t) => {
                const badge = dueBadge(t.due);
                const overdue = badge === "overdue";
                const today = badge === "today";
                return (
                  <li
                    key={t.id}
                    className="flex items-baseline gap-2 text-sm text-zinc-200"
                  >
                    <span className="text-zinc-600">☐</span>
                    {t.priority && (
                      <span className="text-xs">
                        {PRIORITY_GLYPH[t.priority]}
                      </span>
                    )}
                    <span className="flex-1 truncate">{t.text}</span>
                    {badge && (
                      <span
                        className={
                          "text-xs px-1.5 py-0.5 rounded shrink-0 " +
                          (overdue
                            ? "bg-red-950 text-red-300"
                            : today
                              ? "bg-amber-950 text-amber-300"
                              : "bg-zinc-800 text-zinc-400")
                        }
                      >
                        {badge}
                      </span>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>
    </section>
  );
}
