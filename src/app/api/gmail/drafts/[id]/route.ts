import { NextResponse } from "next/server";
import { deleteDraft, getDraft } from "@/lib/gmail";
import { status } from "@/lib/google";

export const dynamic = "force-dynamic";

function gateStatus() {
  const s = status();
  if (!s.configured)
    return NextResponse.json({ error: "Google not configured" }, { status: 400 });
  if (!s.connected)
    return NextResponse.json({ error: "Google not connected" }, { status: 401 });
  return null;
}

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const gate = gateStatus();
  if (gate) return gate;
  const { id } = await ctx.params;
  try {
    const draft = await getDraft(id);
    return NextResponse.json({ draft });
  } catch (e) {
    return NextResponse.json(
      { error: (e as Error).message },
      { status: 500 },
    );
  }
}

export async function DELETE(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const gate = gateStatus();
  if (gate) return gate;
  const { id } = await ctx.params;
  try {
    await deleteDraft(id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json(
      { error: (e as Error).message },
      { status: 500 },
    );
  }
}
