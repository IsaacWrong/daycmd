import { NextResponse } from "next/server";
import { getUsageSummary } from "@/lib/usage";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(getUsageSummary());
}
