import { NextResponse } from "next/server";
import { recentErrors, clearErrors } from "@/lib/errors";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({ errors: recentErrors(30) });
}

export async function DELETE() {
  clearErrors();
  return NextResponse.json({ ok: true });
}
