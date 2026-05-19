import { NextResponse } from "next/server";
import { z } from "zod";
import { microCall } from "@/lib/micro";

export const dynamic = "force-dynamic";

const BodySchema = z.object({
  text: z.string().min(1),
});

type Result = {
  subtasks: string[];
  reason: string;
};

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON" }, { status: 400 });
  }
  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid payload" }, { status: 400 });
  }
  const { text } = parsed.data;

  const prompt = [
    `Task: "${text}"`,
    "",
    "Break this into 2-5 concrete subtasks that are each independently actionable in under 45 minutes. Skip if the task is already atomic — then return an empty subtasks array and explain in reason.",
    'Each subtask: imperative verb start. No "Plan to..." or "Think about...". Concrete next action only. 4-10 words each.',
    "",
    'Reply JSON: {"subtasks": ["...", "..."], "reason": "<short why or why not>"}',
  ].join("\n");

  try {
    const data = await microCall<Result>({
      source: "task-split",
      maxTokens: 400,
      system: "You break tasks into concrete subtasks. Reply only with JSON.",
      prompt,
    });
    const subtasks = (data.subtasks ?? [])
      .filter((s) => typeof s === "string" && s.trim().length > 0)
      .slice(0, 5);
    return NextResponse.json({ subtasks, reason: data.reason ?? "" });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
