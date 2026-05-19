import { NextResponse } from "next/server";
import { microCached } from "@/lib/micro";
import { recentErrors } from "@/lib/errors";

export const dynamic = "force-dynamic";

type Cluster = {
  title: string;
  ids: string[];
  rootCauseGuess: string;
  suggestedFix: string;
};

type ClustersResult = { clusters: Cluster[] };

function bucketKey(errorCount: number, latestTs: number): string {
  // Re-cluster only when set changes — key off count + most-recent ts.
  return `${errorCount}-${latestTs}`;
}

export async function GET() {
  const errs = recentErrors(40);
  if (errs.length === 0) {
    return NextResponse.json({ clusters: [] });
  }
  if (errs.length < 3) {
    return NextResponse.json({ clusters: [] });
  }

  const latest = errs[0]?.ts ?? 0;
  const cacheKey = bucketKey(errs.length, latest);

  const lines = errs.map(
    (e) =>
      `${e.id} | ${e.source} | ${e.message.slice(0, 200)}${e.context ? ` | ctx=${e.context.slice(0, 200)}` : ""}`,
  );

  const prompt = [
    "Cluster these error log entries by likely shared root cause. Skip clusters of size 1 unless the error is critical.",
    "",
    "Errors (id | source | message | ctx):",
    ...lines,
    "",
    "For each cluster, output: a short title (3-7 words), the list of ids belonging to the cluster, a one-sentence root-cause guess, and a one-line suggested fix (code change, retry, config tweak, etc).",
    'Reply JSON: {"clusters": [{"title": "...", "ids": ["..."], "rootCauseGuess": "...", "suggestedFix": "..."}]}',
    "Output JSON only.",
  ].join("\n");

  try {
    const { data, cached } = await microCached<ClustersResult>({
      source: "error-clusters",
      cacheKey,
      ttlMs: 10 * 60_000,
      persist: false,
      maxTokens: 1500,
      model: "claude-sonnet-4-6",
      system:
        "You analyze server error logs for a personal dashboard. Reply only with JSON.",
      prompt,
    });

    const validIds = new Set(errs.map((e) => e.id));
    const clusters = (data.clusters ?? [])
      .map((c) => ({
        ...c,
        ids: (c.ids ?? []).filter((id) => validIds.has(id)),
      }))
      .filter((c) => c.ids.length >= 2);

    return NextResponse.json({ clusters, cached });
  } catch (e) {
    return NextResponse.json(
      { error: (e as Error).message, clusters: [] },
      { status: 200 },
    );
  }
}
