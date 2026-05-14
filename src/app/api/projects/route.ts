import { NextResponse, type NextRequest } from "next/server";
import { listActiveProjects, createProject } from "@/lib/projects";
import {
  findRepoForName,
  getRepoStats,
  getUserDailyCommitsByRepo,
  type RepoStats,
} from "@/lib/github";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type EnrichedProject = {
  name: string;
  status: string | null;
  next: string | null;
  repo: string | null;
  url: string | null;
  weeklyHours: number;
  stats: RepoStats | null;
};

let _cache: { ts: number; data: EnrichedProject[] } | null = null;
let _inflight: Promise<EnrichedProject[]> | null = null;
const PROJECTS_TTL_MS = 5 * 60_000;

async function compute(): Promise<EnrichedProject[]> {
  const projects = await listActiveProjects();
  const eventsByRepo = await getUserDailyCommitsByRepo(14);
  const enriched = await Promise.all(
      projects.map(async (p) => {
        let repo: string | null =
          typeof p.frontmatter.repo === "string" && p.frontmatter.repo.length > 0
            ? p.frontmatter.repo
            : null;
        if (!repo) repo = await findRepoForName(p.name);
        let stats: RepoStats | null = null;
        if (repo) {
          stats = await getRepoStats(repo, { days: 30 });
          const eventTrend = eventsByRepo.get(repo);
          if (eventTrend) {
            const sum = eventTrend.reduce((a, b) => a + b, 0);
            stats = {
              ...stats,
              dailyTrend: eventTrend,
              recentCommits: Math.max(stats.recentCommits, sum),
            };
          }
        }
        return {
          name: p.name,
          status: p.frontmatter.status ?? null,
          next: p.frontmatter.next ?? null,
          repo,
          url: p.frontmatter.url ?? null,
          weeklyHours: p.frontmatter.weekly_hours ?? 0,
          stats,
        };
      }),
    );
  _cache = { ts: Date.now(), data: enriched };
  return enriched;
}

export async function GET() {
  try {
    if (_cache && Date.now() - _cache.ts < PROJECTS_TTL_MS) {
      return NextResponse.json({ projects: _cache.data });
    }
    if (!_inflight) {
      _inflight = compute().finally(() => {
        _inflight = null;
      });
    }
    const enriched = await _inflight;
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
