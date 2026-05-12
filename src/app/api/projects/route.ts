import { NextResponse } from "next/server";
import { listActiveProjects } from "@/lib/projects";
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
