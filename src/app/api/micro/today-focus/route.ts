import { NextResponse } from "next/server";
import { microCached } from "@/lib/micro";
import { getAllTasks } from "@/lib/obsidian";
import { getEvents } from "@/lib/calendar";
import { status as googleStatus } from "@/lib/google";

export const dynamic = "force-dynamic";

type Focus = { focus: string };

const FOCUS_VERSION = "v1";

function bucketKey(): string {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const hourBucket = Math.floor(d.getHours() / 2);
  return `${FOCUS_VERSION}-${yyyy}${mm}${dd}-${hourBucket}`;
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
  const gs = googleStatus();

  const [tasks, events] = await Promise.all([
    getAllTasks().catch(() => []),
    gs.configured && gs.connected ? getEvents(24).catch(() => []) : Promise.resolve([]),
  ]);

  const openTasks = tasks.filter((t) => !t.done && !t.cancelled);
  if (openTasks.length === 0) {
    return NextResponse.json({ focus: "No open tasks. Use the breathing room." });
  }

  const ranked = openTasks
    .slice()
    .sort((a, b) => {
      const aOver = a.due && a.due < today ? 0 : a.due === today ? 1 : 2;
      const bOver = b.due && b.due < today ? 0 : b.due === today ? 1 : 2;
      if (aOver !== bOver) return aOver - bOver;
      const ap = a.priority ? PRIORITY_RANK[a.priority] : 5;
      const bp = b.priority ? PRIORITY_RANK[b.priority] : 5;
      return ap - bp;
    })
    .slice(0, 6);

  const taskLines = ranked.map(
    (t) =>
      `- "${t.text.slice(0, 90)}" — due ${t.due ?? "—"}, priority ${t.priority ?? "—"}`,
  );

  const now = Date.now();
  const cutoff = new Date();
  cutoff.setHours(23, 59, 59, 999);
  const remainingToday = events
    .filter(
      (e) =>
        !e.allDay &&
        new Date(e.end).getTime() > now &&
        new Date(e.start).getTime() <= cutoff.getTime(),
    )
    .slice(0, 3)
    .map((e) => {
      const t = new Date(e.start).toLocaleTimeString([], {
        hour: "numeric",
        minute: "2-digit",
      });
      return `- ${t} ${e.summary}`;
    });

  const summary = [
    `Today: ${today}.`,
    `Now: ${new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}.`,
    "",
    "Top open tasks:",
    ...taskLines,
    "",
    remainingToday.length
      ? `Remaining calendar today:\n${remainingToday.join("\n")}`
      : "Calendar clear for the rest of today.",
  ].join("\n");

  try {
    const { data, cached } = await microCached<Focus>({
      source: "today-focus",
      cacheKey: bucketKey(),
      ttlMs: 60 * 60_000,
      persist: true,
      maxTokens: 160,
      system:
        'You name the one thing worth committing to today for a personal dashboard. Single sentence, 8-18 words. Concrete + specific (name the task or person). Plain working voice. No emojis, no headings. Output JSON: {"focus": "..."}',
      prompt: `${summary}\n\nReturn one sentence: today's focus. Pull the actual task or commitment by name. Example shapes: "Clear the AccTax invoice before evening — 7d overdue and blocking momentum." or "Draft the Sun refinance reply; nothing else moves until that's out."`,
    });
    return NextResponse.json({ focus: data.focus, cached });
  } catch (e) {
    return NextResponse.json(
      { error: (e as Error).message, focus: null },
      { status: 200 },
    );
  }
}
