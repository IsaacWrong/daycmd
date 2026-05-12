import { NextResponse } from "next/server";
import {
  listAutomations,
  createAutomation,
  listRecentRuns,
  readClaudeCodeRoutines,
} from "@/lib/automations";
import { reloadScheduler, schedulerStatus } from "@/lib/scheduler";
import cron from "node-cron";

export const dynamic = "force-dynamic";

export async function GET() {
  const [claudeCodeRoutines] = await Promise.all([readClaudeCodeRoutines()]);
  return NextResponse.json({
    automations: listAutomations(),
    recentRuns: listRecentRuns(10),
    claudeCodeRoutines,
    scheduler: schedulerStatus(),
  });
}

export async function POST(req: Request) {
  const body = (await req.json()) as {
    name?: string;
    cron?: string;
    prompt?: string;
    enabled?: boolean;
    kind?: "agent" | "compile";
    target_category?: string | null;
  };
  if (!body.name || !body.cron) {
    return NextResponse.json(
      { error: "name and cron required" },
      { status: 400 },
    );
  }
  if (!cron.validate(body.cron)) {
    return NextResponse.json(
      { error: `invalid cron expression: ${body.cron}` },
      { status: 400 },
    );
  }
  const kind = body.kind ?? "agent";
  if (kind === "agent" && !body.prompt) {
    return NextResponse.json(
      { error: "prompt required for agent automations" },
      { status: 400 },
    );
  }
  if (kind === "compile" && !body.target_category) {
    return NextResponse.json(
      { error: "target_category required for compile automations" },
      { status: 400 },
    );
  }
  const a = createAutomation({
    name: body.name,
    cron: body.cron,
    prompt: body.prompt,
    enabled: body.enabled,
    kind,
    target_category: body.target_category ?? null,
  });
  reloadScheduler();
  return NextResponse.json({ automation: a });
}
