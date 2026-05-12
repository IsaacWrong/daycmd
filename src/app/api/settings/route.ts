import { NextResponse } from "next/server";
import { getSettings, updateSettings } from "@/lib/settings";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(getSettings());
}

export async function PATCH(req: Request) {
  const body = (await req.json()) as Partial<{
    budgetDailyUsd: number;
    budgetAlertPct: number;
    defaultCategory: string;
  }>;
  return NextResponse.json(updateSettings(body));
}
