import { NextResponse } from "next/server";
import { getAllTasks } from "@/lib/obsidian";
import type { ObsidianTask } from "@/lib/tasks-parser";

export const dynamic = "force-dynamic";

type Suggestion = {
  id: string;
  action: "infer-due" | "reschedule" | "split";
  label: string;
  task: {
    file: string;
    line: number;
    text: string;
    due: string | null;
    priority: string | null;
  };
};

function asLite(t: ObsidianTask): Suggestion["task"] {
  return {
    file: t.file,
    line: t.line,
    text: t.text,
    due: t.due ?? null,
    priority: t.priority ?? null,
  };
}

export async function GET() {
  const today = new Date().toISOString().slice(0, 10);
  const tasks = await getAllTasks().catch(() => []);
  const open = tasks.filter((t) => !t.done && !t.cancelled);

  const out: Suggestion[] = [];
  const used = new Set<string>();

  // 1. Worst overdue → reschedule.
  const worstOverdue = open
    .filter((t) => t.due && t.due < today)
    .sort((a, b) => (a.due ?? "z").localeCompare(b.due ?? "z"))[0];
  if (worstOverdue) {
    out.push({
      id: `resched-${worstOverdue.id}`,
      action: "reschedule",
      label: `Reschedule "${worstOverdue.text.slice(0, 60)}"`,
      task: asLite(worstOverdue),
    });
    used.add(worstOverdue.id);
  }

  // 2. High-priority no-due → infer-due.
  const noDueHi = open
    .filter(
      (t) =>
        !used.has(t.id) &&
        !t.due &&
        (t.priority === "high" || t.priority === "highest"),
    )[0];
  if (noDueHi) {
    out.push({
      id: `due-${noDueHi.id}`,
      action: "infer-due",
      label: `Set due for "${noDueHi.text.slice(0, 60)}"`,
      task: asLite(noDueHi),
    });
    used.add(noDueHi.id);
  } else {
    // Fallback — any no-due open task at all.
    const anyNoDue = open.filter((t) => !used.has(t.id) && !t.due)[0];
    if (anyNoDue) {
      out.push({
        id: `due-${anyNoDue.id}`,
        action: "infer-due",
        label: `Set due for "${anyNoDue.text.slice(0, 60)}"`,
        task: asLite(anyNoDue),
      });
      used.add(anyNoDue.id);
    }
  }

  // 3. Long-text task → split.
  const longTask = open
    .filter((t) => !used.has(t.id) && t.text.length >= 40)
    .sort((a, b) => b.text.length - a.text.length)[0];
  if (longTask) {
    out.push({
      id: `split-${longTask.id}`,
      action: "split",
      label: `Break down "${longTask.text.slice(0, 60)}"`,
      task: asLite(longTask),
    });
    used.add(longTask.id);
  }

  return NextResponse.json({ suggestions: out.slice(0, 3) });
}
