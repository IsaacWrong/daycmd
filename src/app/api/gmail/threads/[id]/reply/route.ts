import { NextResponse } from "next/server";
import { z } from "zod";
import { sendReply } from "@/lib/gmail";
import { status } from "@/lib/google";

export const dynamic = "force-dynamic";

const ReplySchema = z.object({
  body: z.string().min(1),
  replyAll: z.boolean().optional(),
});

export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const s = status();
  if (!s.configured)
    return NextResponse.json({ error: "Google not configured" }, { status: 400 });
  if (!s.connected)
    return NextResponse.json({ error: "Google not connected" }, { status: 401 });

  const { id } = await ctx.params;
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON" }, { status: 400 });
  }
  const parsed = ReplySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid payload", details: parsed.error.flatten() },
      { status: 400 },
    );
  }
  try {
    const r = await sendReply({
      threadId: id,
      body: parsed.data.body,
      replyAll: parsed.data.replyAll,
    });
    return NextResponse.json(r);
  } catch (e) {
    return NextResponse.json(
      { error: (e as Error).message },
      { status: 500 },
    );
  }
}
