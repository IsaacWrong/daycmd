import { NextResponse } from "next/server";
import { readProject } from "@/lib/projects";
import { getRepoStats } from "@/lib/github";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export type ActivityItem = {
  kind: "github" | "stripe" | "agent" | "analytics";
  text: string;
  at: string;
  url?: string;
};

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ name: string }> },
) {
  const { name } = await ctx.params;
  const decoded = decodeURIComponent(name);
  const items: ActivityItem[] = [];

  try {
    const project = await readProject(decoded);
    const repo = typeof project.frontmatter.repo === "string" ? project.frontmatter.repo : "";
    if (repo) {
      const stats = await getRepoStats(repo);
      if (stats.lastCommit) {
        items.push({
          kind: "github",
          text: `Pushed ${stats.lastCommit.sha} — ${stats.lastCommit.message}`,
          at: stats.lastCommit.date,
          url: stats.lastCommit.url,
        });
      }
      if (stats.openPRs > 0) {
        items.push({
          kind: "github",
          text: `${stats.openPRs} open PR${stats.openPRs > 1 ? "s" : ""} on ${repo}`,
          at: new Date().toISOString(),
        });
      }
    }
  } catch {}

  // Stripe / analytics are still mocked — surface placeholders.
  items.push({
    kind: "stripe",
    text: "MRR check — connect Stripe to populate",
    at: new Date(Date.now() - 6 * 3600_000).toISOString(),
  });
  items.push({
    kind: "analytics",
    text: "DAU check — connect analytics to populate",
    at: new Date(Date.now() - 8 * 3600_000).toISOString(),
  });

  return NextResponse.json({ items });
}
