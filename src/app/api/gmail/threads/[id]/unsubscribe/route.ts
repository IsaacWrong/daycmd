import { NextResponse } from "next/server";
import { getThread, unsubscribeMessage } from "@/lib/gmail";
import { status } from "@/lib/google";

export const dynamic = "force-dynamic";

export async function POST(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const s = status();
  if (!s.configured)
    return NextResponse.json({ error: "Google not configured" }, { status: 400 });
  if (!s.connected)
    return NextResponse.json({ error: "Google not connected" }, { status: 401 });

  const { id } = await ctx.params;
  try {
    const thread = await getThread(id);
    const target = [...thread.messages]
      .reverse()
      .find((m) => m.hasUnsubscribe);
    if (!target) {
      return NextResponse.json(
        { ok: false, error: "no unsubscribe header on thread" },
        { status: 400 },
      );
    }
    const r = await unsubscribeMessage(target.id);
    return NextResponse.json(r);
  } catch (e) {
    return NextResponse.json(
      { error: (e as Error).message },
      { status: 500 },
    );
  }
}
