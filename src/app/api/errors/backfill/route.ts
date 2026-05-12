import { NextResponse } from "next/server";
import { backfillErrorsToVault } from "@/lib/errors";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  const res = backfillErrorsToVault();
  return NextResponse.json({ ok: true, files: res.files.length, rows: res.rows });
}

export async function GET() {
  return POST();
}
