import { NextResponse } from "next/server";
import { getTodaySpendUsd } from "@/lib/usage";
import { getSettings } from "@/lib/settings";

export const dynamic = "force-dynamic";

export async function GET() {
  const settings = getSettings();
  const spent = getTodaySpendUsd();
  const cap = settings.budgetDailyUsd;
  return NextResponse.json({
    spent,
    cap,
    ratio: cap > 0 ? Math.min(1, spent / cap) : 0,
    alertPct: settings.budgetAlertPct,
    state: cap === 0 ? "unlimited" : spent >= cap ? "exceeded" : spent / cap >= settings.budgetAlertPct ? "warning" : "ok",
  });
}
