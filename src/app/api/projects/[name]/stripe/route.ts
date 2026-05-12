import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export type StripeProjectStats = {
  mrr: number;
  mrrDelta: string;
  subscribers: number;
  subscribersDelta: string;
  churn: number;
  trialsActive: number;
  mrrTrend: number[];
};

function mockStats(name: string): StripeProjectStats {
  // Deterministic mock derived from project name.
  let seed = 0;
  for (let i = 0; i < name.length; i++) seed = (seed * 31 + name.charCodeAt(i)) >>> 0;
  const rand = () => {
    seed = (seed * 1103515245 + 12345) >>> 0;
    return (seed / 2 ** 32) * 2 - 1;
  };
  const base = 600 + Math.floor(((seed >>> 8) % 80) * 12);
  const trend = Array.from({ length: 14 }, (_, i) =>
    Math.max(0, base + i * 30 + Math.floor(rand() * 40)),
  );
  return {
    mrr: trend[trend.length - 1],
    mrrDelta: "+8.4%",
    subscribers: Math.floor(trend[trend.length - 1] / 7),
    subscribersDelta: "+12",
    churn: 1.8,
    trialsActive: 23,
    mrrTrend: trend,
  };
}

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ name: string }> },
) {
  const { name } = await ctx.params;
  const decoded = decodeURIComponent(name);
  return NextResponse.json({ source: "mock", ...mockStats(decoded) });
}
