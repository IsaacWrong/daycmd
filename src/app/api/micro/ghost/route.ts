import { NextResponse } from "next/server";
import { z } from "zod";
import { microCall } from "@/lib/micro";

export const dynamic = "force-dynamic";

const BodySchema = z.object({
  context: z.string().min(1).max(8000),
});

type Result = { continuation: string };

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

  const { context } = parsed.data;
  const tail = context.slice(-1500);

  const prompt = [
    "You write a single short sentence to continue someone's daily journal note. The text ends mid-thought; produce the next sentence that fits the writer's voice + topic.",
    "",
    "Rules:",
    "- 8-22 words. One sentence only.",
    "- Match the existing tone exactly. Plain working voice. No emojis unless the existing text uses them.",
    "- Do NOT repeat what was just written.",
    "- Concrete + specific. Skip generalities, life-lessons, motivational phrasing.",
    "- If the text just ended a heading or bullet, continue under that scope.",
    "",
    "Current daily note (continue from the end):",
    "```",
    tail,
    "```",
    "",
    'Reply JSON: {"continuation": "<single sentence>"}',
  ].join("\n");

  try {
    const data = await microCall<Result>({
      source: "ghost",
      maxTokens: 160,
      system: "You produce one-sentence continuations for a personal journal. Reply only with JSON.",
      prompt,
    });
    const cont = (data.continuation ?? "").trim();
    if (!cont) {
      return NextResponse.json({ continuation: "" });
    }
    return NextResponse.json({ continuation: cont });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message, continuation: "" }, { status: 200 });
  }
}
