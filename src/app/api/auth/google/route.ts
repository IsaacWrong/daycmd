import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import {
  authUrl,
  googleConfigured,
  OAUTH_STATE_COOKIE,
  OAUTH_STATE_MAX_AGE_SECONDS,
} from "@/lib/google";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!googleConfigured()) {
    return NextResponse.json(
      { error: "google not configured" },
      { status: 400 },
    );
  }
  const state = randomUUID();
  const res = NextResponse.redirect(authUrl(state));
  res.cookies.set({
    name: OAUTH_STATE_COOKIE,
    value: state,
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: OAUTH_STATE_MAX_AGE_SECONDS,
    // Local dev runs on http://localhost — `secure` would prevent the cookie
    // from being set, so leave it off (we're localhost-only by design).
  });
  return res;
}
