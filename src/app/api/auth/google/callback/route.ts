import { NextResponse } from "next/server";
import { exchangeCode } from "@/lib/google";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const err = url.searchParams.get("error");
  if (err) {
    return NextResponse.redirect(new URL(`/?google_error=${err}`, url));
  }
  if (!code) {
    return NextResponse.redirect(new URL("/?google_error=no_code", url));
  }
  try {
    await exchangeCode(code);
    return NextResponse.redirect(new URL("/?google=connected", url));
  } catch (e) {
    return NextResponse.redirect(
      new URL(`/?google_error=${encodeURIComponent((e as Error).message)}`, url),
    );
  }
}
