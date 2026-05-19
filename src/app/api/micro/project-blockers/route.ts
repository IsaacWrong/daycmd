import { NextResponse } from "next/server";
import { microCached } from "@/lib/micro";
import { readProject } from "@/lib/projects";
import { findRepoForName, getRepoStats } from "@/lib/github";
import { getAllTasks } from "@/lib/obsidian";

export const dynamic = "force-dynamic";

type Blockers = { line: string };

function bucketKey(name: string): string {
  const d = new Date();
  return `v1-${name}-${d.toISOString().slice(0, 10)}-${Math.floor(d.getHours() * 2 + d.getMinutes() / 30)}`;
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const name = url.searchParams.get("name");
  if (!name) {
    return NextResponse.json({ error: "name required" }, { status: 400 });
  }

  let nextStep = "";
  let status = "";
  let repoStats: Awaited<ReturnType<typeof getRepoStats>> | null = null;
  try {
    const project = await readProject(name);
    nextStep =
      typeof project.frontmatter.next === "string" ? project.frontmatter.next : "";
    status =
      typeof project.frontmatter.status === "string"
        ? project.frontmatter.status
        : "";
    const repo =
      (typeof project.frontmatter.repo === "string"
        ? project.frontmatter.repo
        : "") || (await findRepoForName(name).catch(() => null)) || "";
    if (repo) repoStats = await getRepoStats(repo, { days: 14 }).catch(() => null);
  } catch {
    return NextResponse.json({ error: "project not found" }, { status: 404 });
  }

  const lowerName = name.toLowerCase();
  const tasks = await getAllTasks().catch(() => []);
  const projectTasks = tasks.filter(
    (t) =>
      !t.done &&
      !t.cancelled &&
      (t.file.toLowerCase().includes(lowerName) ||
        t.text.toLowerCase().includes(lowerName)),
  );
  const today = new Date().toISOString().slice(0, 10);
  const overdue = projectTasks.filter((t) => t.due && t.due < today);

  const signals: string[] = [];
  signals.push(`Project: ${name}`);
  if (status) signals.push(`Status: ${status}`);
  if (nextStep) signals.push(`Stated next step: ${nextStep}`);
  signals.push(`Open project-scoped tasks: ${projectTasks.length} (overdue ${overdue.length})`);
  if (projectTasks.length > 0) {
    signals.push(
      "Top open tasks: " +
        projectTasks
          .slice(0, 4)
          .map((t) => `"${t.text.slice(0, 60)}" (due ${t.due ?? "—"})`)
          .join(" | "),
    );
  }
  if (repoStats) {
    signals.push(`Open PRs: ${repoStats.openPRs}`);
    signals.push(`Commits last 14d: ${repoStats.recentCommits}`);
    if (repoStats.lastCommit) {
      const days = Math.round(
        (Date.now() - new Date(repoStats.lastCommit.date).getTime()) / 86400_000,
      );
      signals.push(`Last commit: ${days}d ago — ${repoStats.lastCommit.message}`);
    }
  } else {
    signals.push("No connected repo data.");
  }

  const prompt = [
    "Identify the single most likely blocker to shipping this project. 8-18 words, one sentence. Plain working voice. Reference an actual fact from the signals.",
    "If signals are clean (no overdue, recent commits, low PR count, next step clear) — say so plainly with a 'nothing blocking' shape.",
    "",
    "Signals:",
    ...signals,
    "",
    'Reply JSON: {"line": "<single sentence>"}',
  ].join("\n");

  try {
    const { data, cached } = await microCached<Blockers>({
      source: "project-blockers",
      cacheKey: bucketKey(name),
      ttlMs: 30 * 60_000,
      persist: true,
      maxTokens: 160,
      system: "You diagnose project blockers. Reply only with JSON.",
      prompt,
    });
    return NextResponse.json({ line: data.line, cached });
  } catch (e) {
    return NextResponse.json(
      { error: (e as Error).message, line: null },
      { status: 200 },
    );
  }
}
