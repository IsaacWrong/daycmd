import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export type AnalyticsProjectStats = {
  dau: number;
  dauDelta: string;
  sessionsPerUser: number;
  retentionD7: number;
  crashFree: number;
  dauTrend: number[];
};

function mockStats(name: string): AnalyticsProjectStats {
  let seed = 0;
  for (let i = 0; i < name.length; i++) seed = (seed * 31 + name.charCodeAt(i)) >>> 0;
  const rand = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 2 ** 32;
  };
  const base = 300 + Math.floor(rand() * 400);
  const trend = Array.from({ length: 14 }, (_, i) =>
    Math.max(0, base + i * 25 + Math.floor(rand() * 80) - 30),
  );
  return {
    dau: trend[trend.length - 1],
    dauDelta: "+4.1%",
    sessionsPerUser: 3.4,
    retentionD7: 42,
    crashFree: 99.7,
    dauTrend: trend,
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
