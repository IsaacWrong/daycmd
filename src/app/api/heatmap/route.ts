import { NextResponse } from "next/server";
import { listActiveProjects } from "@/lib/projects";
import { getDailyCommitCounts } from "@/lib/github";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

let cache: { ts: number; data: number[] } | null = null;
const TTL_MS = 10 * 60_000;

export async function GET() {
  if (cache && Date.now() - cache.ts < TTL_MS) {
    return NextResponse.json({ days: cache.data });
  }
  try {
    const projects = await listActiveProjects();
    const repos = projects
      .map((p) => (typeof p.frontmatter.repo === "string" ? p.frontmatter.repo : ""))
      .filter(Boolean);
    const counts = await getDailyCommitCounts(repos, 14);
    cache = { ts: Date.now(), data: counts };
    return NextResponse.json({ days: counts });
  } catch (err) {
    return NextResponse.json(
      { error: (err as Error).message, days: new Array(14).fill(0) },
      { status: 500 },
    );
  }
}
