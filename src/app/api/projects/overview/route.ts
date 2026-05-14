import { NextResponse } from "next/server";
import { listProjects, parseLogEntries, computeWeeklyHoursFromBody } from "@/lib/projects";
import { findRepoForName, getRepoStats, type RepoStats } from "@/lib/github";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ProjectOverviewRow = {
  name: string;
  status: string | null;
  archived: boolean;
  started: string | null;
  repo: string | null;
  repoAutoLinked: boolean;
  url: string | null;
  next: string | null;
  weeklyHours: number;
  totalHours: number;
  lastLogDate: string | null;
  logCount: number;
  stats: RepoStats | null;
};

export async function GET() {
  try {
    const projects = await listProjects();
    const rows: ProjectOverviewRow[] = await Promise.all(
      projects.map(async (p) => {
        const entries = parseLogEntries(p.body);
        const totalMinutes = entries.reduce((sum, e) => sum + e.minutes, 0);
        const totalHours = Math.round((totalMinutes / 60) * 100) / 100;
        const lastLogDate =
          entries.length > 0
            ? entries.reduce((a, b) => (a.date > b.date ? a : b)).date
            : null;
        const weeklyHours = computeWeeklyHoursFromBody(p.body);
        let repo: string | null =
          typeof p.frontmatter.repo === "string" && p.frontmatter.repo.length > 0
            ? p.frontmatter.repo
            : null;
        let repoAutoLinked = false;
        if (!repo) {
          const match = await findRepoForName(p.name);
          if (match) {
            repo = match;
            repoAutoLinked = true;
          }
        }
        let stats: RepoStats | null = null;
        if (repo) {
          stats = await getRepoStats(repo, { days: 30 });
        }
        return {
          name: p.name,
          status: p.frontmatter.status ?? null,
          archived: p.frontmatter.archived === true,
          started: p.frontmatter.started ?? null,
          repo,
          repoAutoLinked,
          url: p.frontmatter.url ?? null,
          next: p.frontmatter.next ?? null,
          weeklyHours,
          totalHours,
          lastLogDate,
          logCount: entries.length,
          stats,
        };
      }),
    );

    const active = rows.filter((r) => !r.archived);
    const archived = rows.filter((r) => r.archived);
    const byStatus: Record<string, number> = {};
    for (const r of active) {
      const key = (r.status ?? "unspecified").toLowerCase();
      byStatus[key] = (byStatus[key] ?? 0) + 1;
    }
    const totals = {
      totalCount: rows.length,
      activeCount: active.length,
      archivedCount: archived.length,
      weeklyHoursTotal:
        Math.round(active.reduce((s, r) => s + r.weeklyHours, 0) * 100) / 100,
      totalHoursAllTime:
        Math.round(rows.reduce((s, r) => s + r.totalHours, 0) * 100) / 100,
      commits30dTotal: active.reduce(
        (s, r) => s + (r.stats?.recentCommits ?? 0),
        0,
      ),
      openPRsTotal: active.reduce((s, r) => s + (r.stats?.openPRs ?? 0), 0),
      byStatus,
    };

    return NextResponse.json({ totals, projects: rows });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
