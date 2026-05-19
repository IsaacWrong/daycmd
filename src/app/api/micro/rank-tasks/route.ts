import { NextResponse } from "next/server";
import { microCached } from "@/lib/micro";
import { getAllTasks } from "@/lib/obsidian";
import { getEvents } from "@/lib/calendar";
import { status as googleStatus } from "@/lib/google";
import type { ObsidianTask } from "@/lib/tasks-parser";

export const dynamic = "force-dynamic";

type RankResult = {
  ranked: Array<{ id: string; reason: string }>;
};

const PRIORITY_RANK: Record<string, number> = {
  highest: 0,
  high: 1,
  medium: 2,
  low: 3,
  lowest: 4,
};

function shortlist(tasks: ObsidianTask[], today: string): ObsidianTask[] {
  return tasks
    .filter((t) => !t.done && !t.cancelled)
    .slice()
    .sort((a, b) => {
      const aOver = a.due && a.due < today ? 0 : a.due === today ? 1 : 2;
      const bOver = b.due && b.due < today ? 0 : b.due === today ? 1 : 2;
      if (aOver !== bOver) return aOver - bOver;
      const ap = a.priority ? PRIORITY_RANK[a.priority] : 5;
      const bp = b.priority ? PRIORITY_RANK[b.priority] : 5;
      if (ap !== bp) return ap - bp;
      return (a.due ?? "z").localeCompare(b.due ?? "z");
    })
    .slice(0, 10);
}

function computeGaps(events: { allDay: boolean; start: string; end: string }[]): string[] {
  const now = new Date();
  const todayEnd = new Date(now);
  todayEnd.setHours(20, 0, 0, 0);
  if (now > todayEnd) return [];

  const blocks = events
    .filter((e) => !e.allDay)
    .map((e) => ({ start: new Date(e.start), end: new Date(e.end) }))
    .filter((b) => b.end > now && b.start < todayEnd)
    .sort((a, b) => a.start.getTime() - b.start.getTime());

  const gaps: { start: Date; end: Date }[] = [];
  let cursor = now;
  for (const b of blocks) {
    if (b.start > cursor) gaps.push({ start: cursor, end: b.start });
    if (b.end > cursor) cursor = b.end;
  }
  if (cursor < todayEnd) gaps.push({ start: cursor, end: todayEnd });

  return gaps
    .filter((g) => g.end.getTime() - g.start.getTime() >= 25 * 60_000)
    .slice(0, 4)
    .map((g) => {
      const mins = Math.round((g.end.getTime() - g.start.getTime()) / 60_000);
      const fmt = (d: Date) =>
        d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
      return `${fmt(g.start)}-${fmt(g.end)} (${mins}m)`;
    });
}

function todayBucketKey(): string {
  const d = new Date();
  return `${d.toISOString().slice(0, 10)}-${Math.floor(d.getHours() * 4 + d.getMinutes() / 15)}`;
}

export async function GET() {
  const today = new Date().toISOString().slice(0, 10);
  const gs = googleStatus();

  const [tasks, events] = await Promise.all([
    getAllTasks().catch(() => []),
    gs.configured && gs.connected ? getEvents(12).catch(() => []) : Promise.resolve([]),
  ]);

  const candidates = shortlist(tasks, today);
  if (candidates.length === 0) {
    return NextResponse.json({ ranked: [] });
  }

  const gaps = computeGaps(events);
  const taskLines = candidates.map(
    (t) =>
      `${t.id} | ${t.text.slice(0, 100)} | due=${t.due ?? "—"} | priority=${t.priority ?? "—"}`,
  );

  const prompt = [
    `Today: ${today}.`,
    `Open calendar gaps today: ${gaps.length ? gaps.join(", ") : "(none — booked solid or end of day)"}.`,
    "",
    "Candidate tasks (id | text | due | priority):",
    ...taskLines,
    "",
    "Pick the top 3 to do next. Prefer overdue and high-priority. If a task fits a specific gap, say so in the reason. Reasons should be 4-8 words.",
    'Reply JSON: {"ranked": [{"id": "<task id>", "reason": "<short>"}, ...]} — exactly 3 entries unless fewer candidates.',
  ].join("\n");

  try {
    const { data, cached } = await microCached<RankResult>({
      source: "rank-tasks",
      cacheKey: todayBucketKey(),
      ttlMs: 15 * 60_000,
      persist: false,
      maxTokens: 500,
      system:
        "You rank tasks for a personal dashboard. Reply only with JSON matching the requested shape.",
      prompt,
    });

    const candidateIds = new Set(candidates.map((c) => c.id));
    const ranked = (data.ranked ?? [])
      .filter((r) => candidateIds.has(r.id))
      .slice(0, 3);

    return NextResponse.json({ ranked, cached });
  } catch (e) {
    return NextResponse.json(
      { error: (e as Error).message, ranked: [] },
      { status: 200 },
    );
  }
}
