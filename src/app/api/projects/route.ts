import { NextResponse, type NextRequest } from "next/server";
import { listActiveProjects, createProject } from "@/lib/projects";
import { getRepoStats, type RepoStats } from "@/lib/github";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const projects = await listActiveProjects();
    const enriched = await Promise.all(
      projects.map(async (p) => {
        let stats: RepoStats | null = null;
        if (typeof p.frontmatter.repo === "string" && p.frontmatter.repo.length > 0) {
          stats = await getRepoStats(p.frontmatter.repo);
        }
        return {
          name: p.name,
          status: p.frontmatter.status ?? null,
          next: p.frontmatter.next ?? null,
          repo: p.frontmatter.repo ?? null,
          url: p.frontmatter.url ?? null,
          weeklyHours: p.frontmatter.weekly_hours ?? 0,
          stats,
        };
      }),
    );
    return NextResponse.json({ projects: enriched });
  } catch (err) {
    return NextResponse.json(
      { error: (err as Error).message },
      { status: 500 },
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const name = typeof body?.name === "string" ? body.name : "";
    if (!name.trim()) {
      return NextResponse.json({ error: "name required" }, { status: 400 });
    }
    const project = await createProject(name, {
      status: typeof body?.status === "string" ? body.status : undefined,
      repo: typeof body?.repo === "string" ? body.repo : undefined,
      url: typeof body?.url === "string" ? body.url : undefined,
      next: typeof body?.next === "string" ? body.next : undefined,
    });
    return NextResponse.json({ project: { name: project.name } }, { status: 201 });
  } catch (err) {
    const msg = (err as Error).message;
    const status = msg.includes("already exists") ? 409 : 400;
    return NextResponse.json({ error: msg }, { status });
  }
}
