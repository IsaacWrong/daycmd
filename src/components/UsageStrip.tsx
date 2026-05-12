"use client";

import { usePoll } from "@/lib/hooks";
import { Sparkline } from "./Sparkline";

type Bucket = {
  rows: Array<{
    source: string;
    model: string;
    input_tokens: number;
    output_tokens: number;
    cache_read_tokens: number;
    cache_write_tokens: number;
    calls: number;
  }>;
  cost: number;
};

type DailyRow = { date: string; tokens: number; cost: number; calls: number };

type Resp = { today: Bucket; week: Bucket; daily: DailyRow[] };
type BudgetResp = {
  spent: number;
  cap: number;
  ratio: number;
  alertPct: number;
  state: "unlimited" | "ok" | "warning" | "exceeded";
};

function totalTokens(b: Bucket): number {
  return b.rows.reduce(
    (s, r) =>
      s +
      r.input_tokens +
      r.output_tokens +
      r.cache_read_tokens +
      r.cache_write_tokens,
    0,
  );
}

function fmtTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(n);
}

function fmtUsd(n: number): string {
  if (n < 0.01) return `$${n.toFixed(4)}`;
  return `$${n.toFixed(2)}`;
}

export function UsageStrip() {
  const { data } = usePoll<Resp>("/api/usage", 30_000);
  const { data: budget } = usePoll<BudgetResp>("/api/budget", 30_000);
  if (!data) return null;

  const tdyTok = totalTokens(data.today);
  const wkTok = totalTokens(data.week);
  const tdyCalls = data.today.rows.reduce((s, r) => s + r.calls, 0);
  const dailyCosts = (data.daily ?? []).map((d) => d.cost);

  const budgetColor =
    budget?.state === "exceeded"
      ? "#f87171"
      : budget?.state === "warning"
        ? "#fbbf24"
        : "#34d399";

  return (
    <div className="flex gap-3 text-xs text-zinc-400 items-center flex-wrap">
      <span>
        Today:{" "}
        <span className="text-zinc-200 font-mono">{fmtTokens(tdyTok)}</span>{" "}
        tok ·{" "}
        <span className="text-zinc-200 font-mono">{fmtUsd(data.today.cost)}</span>{" "}
        · <span className="font-mono">{tdyCalls}</span> calls
      </span>
      {budget && budget.cap > 0 && (
        <span className="flex items-center gap-1.5">
          <span className="w-16 h-1.5 rounded-full bg-zinc-800 overflow-hidden">
            <span
              className="block h-full rounded-full"
              style={{
                width: `${Math.min(100, budget.ratio * 100)}%`,
                backgroundColor: budgetColor,
              }}
            />
          </span>
          <span className="font-mono text-[11px]" style={{ color: budgetColor }}>
            ${budget.spent.toFixed(2)} / ${budget.cap.toFixed(0)}
          </span>
        </span>
      )}
      <span className="text-zinc-600">|</span>
      <span className="flex items-center gap-1.5">
        7d:{" "}
        <span className="text-zinc-200 font-mono">{fmtTokens(wkTok)}</span>{" "}
        tok ·{" "}
        <span className="text-zinc-200 font-mono">{fmtUsd(data.week.cost)}</span>
        {dailyCosts.length > 0 && (
          <Sparkline values={dailyCosts} color={budgetColor} />
        )}
      </span>
    </div>
  );
}
