import { NextResponse } from "next/server";
import { resolveError, unresolveError } from "@/lib/errors";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  if (!id) {
    return NextResponse.json({ error: "invalid id" }, { status: 400 });
  }
  const body = (await req.json().catch(() => ({}))) as { resolved?: boolean };
  const resolved = body.resolved !== false;
  const ok = resolved ? resolveError(id) : unresolveError(id);
  return NextResponse.json({ ok });
}
