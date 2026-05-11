import { db } from "./db";

export type UsageInput = {
  source: string;
  model: string;
  input_tokens?: number;
  output_tokens?: number;
  cache_read_tokens?: number;
  cache_write_tokens?: number;
};

export function recordUsage(u: UsageInput): void {
  db.prepare(
    `INSERT INTO agent_usage (ts, source, model, input_tokens, output_tokens, cache_read_tokens, cache_write_tokens)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    Date.now(),
    u.source,
    u.model,
    u.input_tokens ?? 0,
    u.output_tokens ?? 0,
    u.cache_read_tokens ?? 0,
    u.cache_write_tokens ?? 0,
  );
}

const PRICING: Record<string, { input: number; output: number; cacheRead: number; cacheWrite: number }> = {
  "claude-opus-4-7": { input: 5, output: 25, cacheRead: 0.5, cacheWrite: 6.25 },
  "claude-opus-4-6": { input: 5, output: 25, cacheRead: 0.5, cacheWrite: 6.25 },
  "claude-sonnet-4-6": { input: 3, output: 15, cacheRead: 0.3, cacheWrite: 3.75 },
  "claude-haiku-4-5": { input: 1, output: 5, cacheRead: 0.1, cacheWrite: 1.25 },
};

export type UsageRow = {
  source: string;
  model: string;
  input_tokens: number;
  output_tokens: number;
  cache_read_tokens: number;
  cache_write_tokens: number;
  calls: number;
};

function cost(rows: UsageRow[]): number {
  let total = 0;
  for (const r of rows) {
    const p = PRICING[r.model] ?? PRICING["claude-opus-4-7"];
    total +=
      (r.input_tokens * p.input +
        r.output_tokens * p.output +
        r.cache_read_tokens * p.cacheRead +
        r.cache_write_tokens * p.cacheWrite) /
      1_000_000;
  }
  return total;
}

export function getUsageSummary() {
  const now = Date.now();
  const dayStart = new Date();
  dayStart.setHours(0, 0, 0, 0);
  const todayMs = dayStart.getTime();
  const weekMs = now - 7 * 86400_000;

  const groupQuery = `
    SELECT source, model,
      COALESCE(SUM(input_tokens),0) AS input_tokens,
      COALESCE(SUM(output_tokens),0) AS output_tokens,
      COALESCE(SUM(cache_read_tokens),0) AS cache_read_tokens,
      COALESCE(SUM(cache_write_tokens),0) AS cache_write_tokens,
      COUNT(*) AS calls
    FROM agent_usage WHERE ts >= ? GROUP BY source, model`;

  const today = db.prepare(groupQuery).all(todayMs) as UsageRow[];
  const week = db.prepare(groupQuery).all(weekMs) as UsageRow[];

  return {
    today: { rows: today, cost: cost(today) },
    week: { rows: week, cost: cost(week) },
  };
}
