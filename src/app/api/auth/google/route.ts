import { NextResponse } from "next/server";
import { authUrl, googleConfigured } from "@/lib/google";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!googleConfigured()) {
    return NextResponse.json(
      { error: "google not configured" },
      { status: 400 },
    );
  }
  return NextResponse.redirect(authUrl());
}
