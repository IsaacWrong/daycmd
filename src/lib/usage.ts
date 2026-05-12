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

  // 7-day daily breakdown (oldest → newest)
  type DayRow = {
    day: string;
    model: string;
    input_tokens: number;
    output_tokens: number;
    cache_read_tokens: number;
    cache_write_tokens: number;
    calls: number;
  };
  const sevenDays = db
    .prepare(
      `SELECT
        strftime('%Y-%m-%d', ts / 1000, 'unixepoch', 'localtime') AS day,
        model,
        COALESCE(SUM(input_tokens),0) AS input_tokens,
        COALESCE(SUM(output_tokens),0) AS output_tokens,
        COALESCE(SUM(cache_read_tokens),0) AS cache_read_tokens,
        COALESCE(SUM(cache_write_tokens),0) AS cache_write_tokens,
        COUNT(*) AS calls
      FROM agent_usage
      WHERE ts >= ?
      GROUP BY day, model
      ORDER BY day ASC`,
    )
    .all(weekMs) as DayRow[];

  // Build daily series with cost rollup
  const dayMap = new Map<
    string,
    { tokens: number; cost: number; calls: number }
  >();
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now - i * 86400_000);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    dayMap.set(key, { tokens: 0, cost: 0, calls: 0 });
  }
  for (const r of sevenDays) {
    const cur = dayMap.get(r.day);
    if (!cur) continue;
    const tokens =
      r.input_tokens + r.output_tokens + r.cache_read_tokens + r.cache_write_tokens;
    const pricing = pricingFor(r.model);
    const dollars =
      (r.input_tokens * pricing.input +
        r.output_tokens * pricing.output +
        r.cache_read_tokens * pricing.cacheRead +
        r.cache_write_tokens * pricing.cacheWrite) /
      1_000_000;
    dayMap.set(r.day, {
      tokens: cur.tokens + tokens,
      cost: cur.cost + dollars,
      calls: cur.calls + r.calls,
    });
  }
  const daily = Array.from(dayMap.entries()).map(([date, v]) => ({
    date,
    ...v,
  }));

  return {
    today: { rows: today, cost: cost(today) },
    week: { rows: week, cost: cost(week) },
    daily,
  };
}

function pricingFor(model: string) {
  return PRICING[model] ?? PRICING["claude-opus-4-7"];
}

export function getTodaySpendUsd(): number {
  const dayStart = new Date();
  dayStart.setHours(0, 0, 0, 0);
  const rows = db
    .prepare(
      `SELECT model,
        COALESCE(SUM(input_tokens),0) AS input_tokens,
        COALESCE(SUM(output_tokens),0) AS output_tokens,
        COALESCE(SUM(cache_read_tokens),0) AS cache_read_tokens,
        COALESCE(SUM(cache_write_tokens),0) AS cache_write_tokens,
        COUNT(*) AS calls,
        '' AS source
      FROM agent_usage WHERE ts >= ? GROUP BY model`,
    )
    .all(dayStart.getTime()) as UsageRow[];
  return cost(rows);
}
