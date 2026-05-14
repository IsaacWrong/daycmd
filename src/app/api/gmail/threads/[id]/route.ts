import { NextResponse } from "next/server";
import { z } from "zod";
import { getThread, modifyThread, trashThread } from "@/lib/gmail";
import { status } from "@/lib/google";

export const dynamic = "force-dynamic";

const PatchSchema = z.object({
  addLabels: z.array(z.string()).optional(),
  removeLabels: z.array(z.string()).optional(),
});

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
    const thread = await getThread(id);
    return NextResponse.json({ thread });
  } catch (e) {
    return NextResponse.json(
      { error: (e as Error).message },
      { status: 500 },
    );
  }
}

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const gate = gateStatus();
  if (gate) return gate;
  const { id } = await ctx.params;
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON" }, { status: 400 });
  }
  const parsed = PatchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid payload", details: parsed.error.flatten() },
      { status: 400 },
    );
  }
  try {
    await modifyThread(id, {
      addLabelIds: parsed.data.addLabels,
      removeLabelIds: parsed.data.removeLabels,
    });
    return NextResponse.json({ ok: true });
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
    await trashThread(id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json(
      { error: (e as Error).message },
      { status: 500 },
    );
  }
}
