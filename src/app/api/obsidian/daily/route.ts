import { NextResponse } from "next/server";
import { readDailyNote, writeDailyNoteIfUnchanged } from "@/lib/obsidian";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const note = await readDailyNote();
    return NextResponse.json(note);
  } catch (err) {
    return NextResponse.json(
      { error: (err as Error).message },
      { status: 500 },
    );
  }
}

export async function PATCH(req: Request) {
  try {
    const { content, mtime } = (await req.json()) as {
      content: string;
      mtime?: number;
    };
    if (typeof content !== "string") {
      return NextResponse.json({ error: "content required" }, { status: 400 });
    }
    const expected = typeof mtime === "number" ? mtime : 0;
    const res = await writeDailyNoteIfUnchanged(content, expected);
    if (!res.ok) {
      return NextResponse.json(
        { error: "conflict", current: res.current },
        { status: 409 },
      );
    }
    return NextResponse.json({ ok: true, mtime: res.mtime });
  } catch (err) {
    return NextResponse.json(
      { error: (err as Error).message },
      { status: 500 },
    );
  }
}
