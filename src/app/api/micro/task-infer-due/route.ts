import { NextResponse } from "next/server";
import { z } from "zod";
import { microCall } from "@/lib/micro";

export const dynamic = "force-dynamic";

const BodySchema = z.object({
  text: z.string().min(1),
});

type Result = {
  due: string | null;
  priority: "highest" | "high" | "medium" | "low" | "lowest" | null;
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
  const today = new Date().toISOString().slice(0, 10);

  const prompt = [
    `Today is ${today}.`,
    `Task text: "${text}"`,
    "",
    "Infer a sensible due date (YYYY-MM-DD) and priority from the task text. If the text has no time signal at all, set due to null. Priority: highest/high/medium/low/lowest, or null if no signal.",
    "",
    'Reply JSON: {"due": "YYYY-MM-DD" | null, "priority": "..." | null, "reason": "<short why>"}',
  ].join("\n");

  try {
    const data = await microCall<Result>({
      source: "task-infer-due",
      maxTokens: 200,
      system: "You infer task metadata. Reply only with JSON.",
      prompt,
    });
    if (data.due && !/^\d{4}-\d{2}-\d{2}$/.test(data.due)) {
      data.due = null;
    }
    return NextResponse.json(data);
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
