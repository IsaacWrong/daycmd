import { NextResponse } from "next/server";
import { z } from "zod";
import { appendLogEntry, buildTimeEntry } from "@/lib/projects";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Body = z.object({
  start: z.string().datetime(),
  end: z.string().datetime(),
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
    const entry = buildTimeEntry(parsed.data.start, parsed.data.end);
    if (entry.minutes === 0) {
      return NextResponse.json(
        { error: "duration zero", entry },
        { status: 400 },
      );
    }
    const project = await appendLogEntry(decoded, entry);
    return NextResponse.json({
      name: project.name,
      entry,
      weeklyHours: project.frontmatter.weekly_hours,
    });
  } catch (err) {
    return NextResponse.json(
      { error: (err as Error).message },
      { status: 500 },
    );
  }
}
