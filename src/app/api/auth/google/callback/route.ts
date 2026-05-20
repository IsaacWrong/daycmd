import { NextResponse } from "next/server";
import { exchangeCode, OAUTH_STATE_COOKIE } from "@/lib/google";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const err = url.searchParams.get("error");
  const stateParam = url.searchParams.get("state");
  if (err) {
    return NextResponse.redirect(new URL(`/?google_error=${err}`, url));
  }
  if (!code) {
    return NextResponse.redirect(new URL("/?google_error=no_code", url));
  }

  // CSRF defense: the `state` we set in the cookie must match the value
  // Google echoes back in the query string. If either is missing or
  // mismatched, refuse — the OAuth flow was not initiated by us.
  const cookieHeader = req.headers.get("cookie") ?? "";
  const stateCookie = cookieHeader
    .split(/;\s*/)
    .map((p) => p.split("="))
    .find(([k]) => k === OAUTH_STATE_COOKIE)?.[1];
  if (!stateCookie || !stateParam || stateCookie !== stateParam) {
    return NextResponse.json(
      { error: "oauth state missing or mismatched" },
      { status: 400 },
    );
  }

  try {
    await exchangeCode(code);
    const res = NextResponse.redirect(new URL("/?google=connected", url));
    res.cookies.delete(OAUTH_STATE_COOKIE);
    return res;
  } catch (e) {
    return NextResponse.redirect(
      new URL(`/?google_error=${encodeURIComponent((e as Error).message)}`, url),
    );
  }
}
