import { NextResponse } from "next/server";
import { readState, writeState, deleteState } from "@/lib/vault-state";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ key: string[] }> };

function joinKey(parts: string[]): string {
  return parts.join("/");
}

export async function GET(_req: Request, ctx: Ctx) {
  const { key } = await ctx.params;
  try {
    const value = await readState(joinKey(key));
    return NextResponse.json({ value });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}

export async function PUT(req: Request, ctx: Ctx) {
  const { key } = await ctx.params;
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON" }, { status: 400 });
  }
  try {
    await writeState(joinKey(key), body);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}

export async function DELETE(_req: Request, ctx: Ctx) {
  const { key } = await ctx.params;
  try {
    await deleteState(joinKey(key));
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}
