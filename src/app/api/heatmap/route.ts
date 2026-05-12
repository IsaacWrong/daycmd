import { NextResponse } from "next/server";
import { listActiveProjects } from "@/lib/projects";
import { getDailyCommitCounts } from "@/lib/github";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

let cache: { ts: number; data: number[] } | null = null;
const TTL_MS = 90_000;

const NO_STORE = { "Cache-Control": "no-store, must-revalidate" };

export async function GET(req: Request) {
  const url = new URL(req.url);
  const fresh = url.searchParams.get("fresh") === "1";
  if (!fresh && cache && Date.now() - cache.ts < TTL_MS) {
    return NextResponse.json({ days: cache.data }, { headers: NO_STORE });
  }
  try {
    const projects = await listActiveProjects();
    const repos = projects
      .map((p) => (typeof p.frontmatter.repo === "string" ? p.frontmatter.repo : ""))
      .filter(Boolean);
    const counts = await getDailyCommitCounts(repos, 14);
    cache = { ts: Date.now(), data: counts };
    return NextResponse.json({ days: counts }, { headers: NO_STORE });
  } catch (err) {
    return NextResponse.json(
      { error: (err as Error).message, days: new Array(14).fill(0) },
      { status: 500, headers: NO_STORE },
    );
  }
}
