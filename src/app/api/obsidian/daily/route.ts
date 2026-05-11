import { NextResponse } from "next/server";
import { readDailyNote, writeDailyNote } from "@/lib/obsidian";

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
    const { content } = (await req.json()) as { content: string };
    if (typeof content !== "string") {
      return NextResponse.json({ error: "content required" }, { status: 400 });
    }
    await writeDailyNote(content);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json(
      { error: (err as Error).message },
      { status: 500 },
    );
  }
}
