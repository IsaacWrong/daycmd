import { NextResponse } from "next/server";
import { readStateSync } from "@/lib/vault-state";
import {
  DASHBOARD_BRIEF_NAME,
  listAutomations,
  runAutomation,
} from "@/lib/automations";

export const dynamic = "force-dynamic";

type Stored = { ts: number; output: string };

export async function GET() {
  const stored = readStateSync<Stored>("dashboard/morning-brief");
  if (!stored) return NextResponse.json({ brief: null });
  return NextResponse.json({ brief: stored });
}

export async function POST() {
  const all = listAutomations();
  const brief = all.find((a) => a.name === DASHBOARD_BRIEF_NAME);
  if (!brief) {
    return NextResponse.json(
      { error: "morning brief automation not seeded yet" },
      { status: 404 },
    );
  }
  try {
    const run = await runAutomation(brief.id);
    return NextResponse.json({
      ok: run.ok === 1,
      output: run.output,
      error: run.error,
    });
  } catch (e) {
    return NextResponse.json(
      { error: (e as Error).message },
      { status: 500 },
    );
  }
}
