import { NextResponse } from "next/server";
import { status, disconnect } from "@/lib/google";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(status());
}

export async function DELETE() {
  disconnect();
  return NextResponse.json({ ok: true });
}
