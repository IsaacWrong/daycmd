import { NextResponse } from "next/server";
import { getAllTasks } from "@/lib/obsidian";
import { appendTask, editTask, markTaskDone } from "@/lib/tasks-writer";

type Priority = "highest" | "high" | "medium" | "low" | "lowest";
const PRIORITIES: ReadonlySet<Priority> = new Set([
  "highest",
  "high",
  "medium",
  "low",
  "lowest",
]);

function isIsoDate(s: unknown): s is string {
  return typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s);
}

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const tasks = await getAllTasks();
    return NextResponse.json({ tasks });
  } catch (err) {
    return NextResponse.json(
      { error: (err as Error).message },
      { status: 500 },
    );
  }
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as {
      text?: string;
      file?: string;
      due?: string;
      start?: string;
      scheduled?: string;
      priority?: string;
    };
    const text = body.text?.trim();
    if (!text) {
      return NextResponse.json({ error: "text required" }, { status: 400 });
    }
    for (const field of ["due", "start", "scheduled"] as const) {
      const v = body[field];
      if (v !== undefined && v !== "" && !isIsoDate(v)) {
        return NextResponse.json(
          { error: `${field} must be YYYY-MM-DD` },
          { status: 400 },
        );
      }
    }
    let priority: Priority | undefined;
    if (body.priority) {
      if (!PRIORITIES.has(body.priority as Priority)) {
        return NextResponse.json({ error: "invalid priority" }, { status: 400 });
      }
      priority = body.priority as Priority;
    }
    const res = await appendTask({
      text,
      file: body.file || undefined,
      due: body.due || undefined,
      start: body.start || undefined,
      scheduled: body.scheduled || undefined,
      priority,
    });
    return NextResponse.json({ ok: true, path: res.path, line: res.line });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  try {
    const body = (await req.json()) as {
      file?: string;
      line?: number;
      originalText?: string;
      text?: string;
      due?: string;
      start?: string;
      scheduled?: string;
      priority?: string;
    };
    const text = body.text?.trim();
    if (!body.file || typeof body.line !== "number" || !text) {
      return NextResponse.json(
        { error: "file, line, text required" },
        { status: 400 },
      );
    }
    for (const field of ["due", "start", "scheduled"] as const) {
      const v = body[field];
      if (v !== undefined && v !== "" && !isIsoDate(v)) {
        return NextResponse.json(
          { error: `${field} must be YYYY-MM-DD` },
          { status: 400 },
        );
      }
    }
    let priority: Priority | undefined;
    if (body.priority) {
      if (!PRIORITIES.has(body.priority as Priority)) {
        return NextResponse.json({ error: "invalid priority" }, { status: 400 });
      }
      priority = body.priority as Priority;
    }
    const res = await editTask({
      file: body.file,
      line: body.line,
      originalText: body.originalText,
      text,
      due: body.due || undefined,
      start: body.start || undefined,
      scheduled: body.scheduled || undefined,
      priority,
    });
    if (!res.ok) {
      return NextResponse.json({ error: res.error }, { status: res.status ?? 400 });
    }
    return NextResponse.json({ ok: true, line: res.line, raw: res.raw });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const { file, text } = (await req.json()) as { file?: string; text?: string };
    if (!file || !text) {
      return NextResponse.json({ error: "file and text required" }, { status: 400 });
    }
    const res = await markTaskDone({ file, text });
    if (!res.ok) return NextResponse.json({ error: res.error }, { status: 400 });
    return NextResponse.json({ ok: true, matched: res.matched });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
