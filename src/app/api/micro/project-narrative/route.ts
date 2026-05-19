import { NextResponse } from "next/server";
import { microCached } from "@/lib/micro";
import { readProject } from "@/lib/projects";
import { findRepoForName, getRepoStats } from "@/lib/github";

export const dynamic = "force-dynamic";

type Narrative = { narrative: string };

function bucketKey(name: string): string {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `v1-${name}-${yyyy}${mm}${dd}-${Math.floor(d.getHours() / 6)}`;
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const name = url.searchParams.get("name");
  if (!name) {
    return NextResponse.json({ error: "name required" }, { status: 400 });
  }

  let weeklyHours = 0;
  let frontmatterStatus = "";
  let repoStats: Awaited<ReturnType<typeof getRepoStats>> | null = null;
  try {
    const project = await readProject(name);
    const wh = (project.frontmatter as Record<string, unknown>).weekly_hours;
    if (typeof wh === "number") weeklyHours = wh;
    frontmatterStatus =
      typeof project.frontmatter.status === "string"
        ? project.frontmatter.status
        : "";
    const repo =
      (typeof project.frontmatter.repo === "string"
        ? project.frontmatter.repo
        : "") || (await findRepoForName(name).catch(() => null)) || "";
    if (repo) repoStats = await getRepoStats(repo, { days: 30 }).catch(() => null);
  } catch {
    return NextResponse.json({ error: "project not found" }, { status: 404 });
  }

  const signals: string[] = [];
  signals.push(`Project: ${name}`);
  if (frontmatterStatus) signals.push(`Status: ${frontmatterStatus}`);
  signals.push(`Week hours logged: ${weeklyHours.toFixed(1)}h`);
  if (repoStats) {
    signals.push(`Open PRs: ${repoStats.openPRs}`);
    signals.push(`Commits last 30d: ${repoStats.recentCommits}`);
    if (repoStats.lastCommit) {
      signals.push(`Last commit: ${repoStats.lastCommit.message}`);
    }
  } else {
    signals.push("No connected repo or activity available.");
  }

  const prompt = [
    "Write a 1-2 sentence w/w narrative for a project dashboard. Plain working voice. Reference the actual numbers. Skip generalities. If signals are sparse, say so plainly.",
    "",
    "Signals:",
    ...signals,
    "",
    'Reply JSON: {"narrative": "<1-2 sentences>"}',
  ].join("\n");

  try {
    const { data, cached } = await microCached<Narrative>({
      source: "project-narrative",
      cacheKey: bucketKey(name),
      ttlMs: 6 * 3600_000,
      persist: true,
      maxTokens: 240,
      system:
        "You write concise project status narratives. Reply only with JSON.",
      prompt,
    });
    return NextResponse.json({ narrative: data.narrative, cached });
  } catch (e) {
    return NextResponse.json(
      { error: (e as Error).message, narrative: null },
      { status: 200 },
    );
  }
}
