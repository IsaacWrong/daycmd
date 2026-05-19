import { NextResponse } from "next/server";
import { microCached } from "@/lib/micro";
import { getAllTasks } from "@/lib/obsidian";

export const dynamic = "force-dynamic";

type TodayLine = { line: string };

const TODAY_LINE_VERSION = "v3";

function todayKey(): string {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  const bucket = Math.floor(now.getHours() * 2 + now.getMinutes() / 30);
  return `${TODAY_LINE_VERSION}-${yyyy}${mm}${dd}-${bucket}`;
}

const PRIORITY_RANK: Record<string, number> = {
  highest: 0,
  high: 1,
  medium: 2,
  low: 3,
  lowest: 4,
};

export async function GET() {
  const today = new Date().toISOString().slice(0, 10);
  const tasks = await getAllTasks().catch(() => []);

  const openTasks = tasks.filter((t) => !t.done && !t.cancelled);
  const overdue = openTasks.filter((t) => t.due && t.due < today).length;
  const dueToday = openTasks.filter((t) => t.due === today).length;
  const highPri = openTasks.filter(
    (t) => t.priority === "high" || t.priority === "highest",
  ).length;

  const topTask = openTasks
    .slice()
    .sort((a, b) => {
      const aOver = a.due && a.due < today ? 0 : a.due === today ? 1 : 2;
      const bOver = b.due && b.due < today ? 0 : b.due === today ? 1 : 2;
      if (aOver !== bOver) return aOver - bOver;
      const ap = a.priority ? PRIORITY_RANK[a.priority] : 5;
      const bp = b.priority ? PRIORITY_RANK[b.priority] : 5;
      return ap - bp;
    })[0];

  const topTaskLine = topTask
    ? `Top task: "${topTask.text.slice(0, 80)}" (due ${topTask.due ?? "—"}, priority ${topTask.priority ?? "—"})`
    : "No open tasks";

  const summary = [
    `Open tasks: ${openTasks.length} (overdue ${overdue}, due today ${dueToday}, high-pri ${highPri})`,
    topTaskLine,
  ].join("\n");

  try {
    const { data, cached } = await microCached<TodayLine>({
      source: "today-line",
      cacheKey: todayKey(),
      ttlMs: 30 * 60_000,
      persist: true,
      maxTokens: 120,
      system:
        'You write an ultra-terse task-status line for a personal dashboard masthead. Hard limit: 10 words max. No calendar references. No greetings. Just task signal — counts + the one thing worth doing first. Plain working voice. Output JSON: {"line": string}. No prose outside JSON.',
      prompt: `Signals:\n${summary}\n\nReturn an under-10-word line about tasks only. Example shapes: "2 overdue, 3 high-pri — start with the Sun reply." or "Light task load — knock out the faucet replacement."`,
    });
    return NextResponse.json({ line: data.line, cached });
  } catch (e) {
    return NextResponse.json(
      { error: (e as Error).message, line: null },
      { status: 200 },
    );
  }
}
