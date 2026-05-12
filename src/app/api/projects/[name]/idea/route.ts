import { NextResponse } from "next/server";
import { z } from "zod";
import { appendIdea } from "@/lib/projects";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Body = z.object({
  text: z.string().min(1).max(2000),
});

export async function POST(
  req: Request,
  ctx: { params: Promise<{ name: string }> },
) {
  const { name } = await ctx.params;
  const decoded = decodeURIComponent(name);
  const body = await req.json();
  const parsed = Body.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid body", issues: parsed.error.issues },
      { status: 400 },
    );
  }
  try {
    const project = await appendIdea(decoded, parsed.data.text);
    return NextResponse.json({ name: project.name, ok: true });
  } catch (err) {
    return NextResponse.json(
      { error: (err as Error).message },
      { status: 500 },
    );
  }
}
