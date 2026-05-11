import { NextResponse } from "next/server";
import {
  getAutomation,
  updateAutomation,
  deleteAutomation,
  listRuns,
} from "@/lib/automations";
import { reloadScheduler } from "@/lib/scheduler";
import cron from "node-cron";

export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  const a = getAutomation(Number(id));
  if (!a) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json({ automation: a, runs: listRuns(a.id, 10) });
}

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  const body = (await req.json()) as Partial<{
    name: string;
    cron: string;
    prompt: string;
    enabled: boolean;
  }>;
  if (body.cron && !cron.validate(body.cron)) {
    return NextResponse.json(
      { error: `invalid cron: ${body.cron}` },
      { status: 400 },
    );
  }
  const a = updateAutomation(Number(id), body);
  if (!a) return NextResponse.json({ error: "not found" }, { status: 404 });
  reloadScheduler();
  return NextResponse.json({ automation: a });
}

export async function DELETE(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  deleteAutomation(Number(id));
  reloadScheduler();
  return NextResponse.json({ ok: true });
}
