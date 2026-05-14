import { env } from "./config";

export type PosthogStats = {
  source: "posthog";
  dau: number;
  dauDelta: string;
  sessionsPerUser: number;
  retentionD7: number;
  crashFree: number;
  dauTrend: number[];
};

type QueryResponse = {
  results?: Array<Array<string | number | null>>;
  error?: string;
};

async function runQuery(projectId: string, hogql: string): Promise<QueryResponse> {
  const base = env.POSTHOG_BASE_URL.replace(/\/$/, "");
  const res = await fetch(`${base}/api/projects/${projectId}/query/`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.POSTHOG_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      query: { kind: "HogQLQuery", query: hogql },
    }),
    cache: "no-store",
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`PostHog ${res.status}: ${text.slice(0, 200)}`);
  }
  return (await res.json()) as QueryResponse;
}

export async function getPosthogStats(
  projectId: string,
): Promise<PosthogStats | { error: string }> {
  if (!env.POSTHOG_API_KEY) return { error: "POSTHOG_API_KEY not set" };
  if (!projectId) return { error: "posthog_project_id missing" };

  const trendQuery = `
    SELECT toDate(timestamp) AS day, count(DISTINCT distinct_id) AS dau
    FROM events
    WHERE event = '$pageview'
      AND timestamp >= now() - INTERVAL 14 DAY
    GROUP BY day
    ORDER BY day ASC
  `;
  const sessionsQuery = `
    SELECT count() AS sessions, count(DISTINCT person_id) AS users
    FROM sessions
    WHERE min_timestamp >= now() - INTERVAL 7 DAY
  `;

  try {
    const [trendRes, sessRes] = await Promise.all([
      runQuery(projectId, trendQuery),
      runQuery(projectId, sessionsQuery).catch(() => ({ results: [] } as QueryResponse)),
    ]);

    const trendRows = trendRes.results ?? [];
    const buckets = new Map<string, number>();
    for (const row of trendRows) {
      const day = String(row[0] ?? "");
      const dau = Number(row[1] ?? 0);
      if (day) buckets.set(day, dau);
    }
    const dauTrend: number[] = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    for (let i = 13; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const key = d.toISOString().slice(0, 10);
      dauTrend.push(buckets.get(key) ?? 0);
    }
    const dau = dauTrend[dauTrend.length - 1] ?? 0;
    const prev = dauTrend[dauTrend.length - 2] ?? 0;
    const dauDelta =
      prev > 0
        ? `${dau >= prev ? "+" : ""}${(((dau - prev) / prev) * 100).toFixed(1)}%`
        : dau > 0
          ? "+new"
          : "0%";

    const sessRow = (sessRes.results ?? [])[0] ?? [0, 0];
    const sessions = Number(sessRow[0] ?? 0);
    const users = Number(sessRow[1] ?? 0);
    const sessionsPerUser = users > 0 ? Math.round((sessions / users) * 10) / 10 : 0;

    return {
      source: "posthog",
      dau,
      dauDelta,
      sessionsPerUser,
      retentionD7: 0,
      crashFree: 100,
      dauTrend,
    };
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) };
  }
}
