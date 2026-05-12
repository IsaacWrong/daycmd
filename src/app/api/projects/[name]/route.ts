import { NextResponse } from "next/server";
import { z } from "zod";
import { readProject, updateFrontmatter } from "@/lib/projects";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Patch = z.object({
  next: z.string().optional(),
  status: z.string().optional(),
  archived: z.boolean().optional(),
});

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ name: string }> },
) {
  const { name } = await ctx.params;
  const decoded = decodeURIComponent(name);
  try {
    const project = await readProject(decoded);
    return NextResponse.json({
      name: project.name,
      frontmatter: project.frontmatter,
      mtime: project.mtime,
    });
  } catch (err) {
    return NextResponse.json(
      { error: (err as Error).message },
      { status: 404 },
    );
  }
}

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ name: string }> },
) {
  const { name } = await ctx.params;
  const decoded = decodeURIComponent(name);
  const body = await req.json();
  const parsed = Patch.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid body", issues: parsed.error.issues },
      { status: 400 },
    );
  }
  try {
    const project = await updateFrontmatter(decoded, parsed.data);
    return NextResponse.json({
      name: project.name,
      frontmatter: project.frontmatter,
    });
  } catch (err) {
    return NextResponse.json(
      { error: (err as Error).message },
      { status: 500 },
    );
  }
}
