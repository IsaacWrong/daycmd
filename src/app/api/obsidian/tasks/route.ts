import { NextResponse } from "next/server";
import { getAllTasks } from "@/lib/obsidian";
import { markTaskDone } from "@/lib/tasks-writer";

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
