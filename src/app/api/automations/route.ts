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
  };
  if (!body.name || !body.cron || !body.prompt) {
    return NextResponse.json(
      { error: "name, cron, prompt required" },
      { status: 400 },
    );
  }
  if (!cron.validate(body.cron)) {
    return NextResponse.json(
      { error: `invalid cron expression: ${body.cron}` },
      { status: 400 },
    );
  }
  const a = createAutomation({
    name: body.name,
    cron: body.cron,
    prompt: body.prompt,
    enabled: body.enabled,
  });
  reloadScheduler();
  return NextResponse.json({ automation: a });
}
