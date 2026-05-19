import { NextResponse } from "next/server";
import { z } from "zod";
import { microCall } from "@/lib/micro";
import { getEvents } from "@/lib/calendar";
import { status as googleStatus } from "@/lib/google";

export const dynamic = "force-dynamic";

const BodySchema = z.object({
  text: z.string().min(1),
  currentDue: z.string().nullable().optional(),
  estimateMinutes: z.number().optional(),
});

type Result = {
  due: string | null;
  reason: string;
};

function fmtDay(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function dayLabel(d: Date): string {
  return `${d.toLocaleDateString([], { weekday: "short" })} ${fmtDay(d)}`;
}

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON" }, { status: 400 });
  }
  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid payload" }, { status: 400 });
  }
  const { text, currentDue, estimateMinutes } = parsed.data;
  const today = new Date();
  const minutes = estimateMinutes ?? 30;

  let loadByDay: Record<string, number> = {};
  const gs = googleStatus();
  if (gs.configured && gs.connected) {
    try {
      const events = await getEvents(24 * 7);
      for (const e of events) {
        if (e.allDay) continue;
        const start = new Date(e.start);
        const end = new Date(e.end);
        if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) continue;
        const day = fmtDay(start);
        const dur = (end.getTime() - start.getTime()) / 60_000;
        loadByDay[day] = (loadByDay[day] ?? 0) + Math.max(0, dur);
      }
    } catch {
      loadByDay = {};
    }
  }

  const days: string[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    const key = fmtDay(d);
    const dow = d.getDay();
    const isWeekend = dow === 0 || dow === 6;
    const meetingsMin = loadByDay[key] ?? 0;
    days.push(
      `${dayLabel(d)} — meetings: ${Math.round(meetingsMin)}min${isWeekend ? " · weekend" : ""}`,
    );
  }

  const prompt = [
    `Task: "${text}"`,
    `Currently due: ${currentDue ?? "none"}.`,
    `Rough time needed: ${minutes}min.`,
    "",
    "Next 7 days of meeting load:",
    ...days,
    "",
    "Pick the best day in the next 7 days to schedule this. Prefer days w/ less meeting load. If the task is overdue, don't push it too far. Weekdays unless task is clearly personal. Output the picked date YYYY-MM-DD and a 6-12 word reason.",
    'Reply JSON: {"due": "YYYY-MM-DD", "reason": "<short why>"}',
  ].join("\n");

  try {
    const data = await microCall<Result>({
      source: "task-reschedule",
      maxTokens: 200,
      system: "You pick a due date for a task. Reply only with JSON.",
      prompt,
    });
    if (data.due && !/^\d{4}-\d{2}-\d{2}$/.test(data.due)) data.due = null;
    return NextResponse.json(data);
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
