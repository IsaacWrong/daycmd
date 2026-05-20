import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Same-origin / CSRF guard for mutating API requests.
//
// daycmd runs on localhost. Without this, any tab the user has open could POST
// to http://localhost:3000/api/... and drive the agent, send Gmail, overwrite
// .env.local, etc. This proxy refuses cross-origin mutations.
//
// Defenses (any one failing → 403):
// 1. If `Origin` is present, it must match the request's own host.
// 2. If `Sec-Fetch-Site` is present, it must be `same-origin` or `none`.
// 3. The request must include the custom `x-daycmd: 1` header. Custom
//    headers force a CORS preflight even for simple form bodies, so an
//    attacker without CORS permission cannot send this header.
//
// NOTE on file name: Next.js 16 renamed `middleware` to `proxy`. The audit
// ticket references `src/middleware.ts`; the file convention has moved on.
// Behavior is identical.
//
const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

function deny(reason: string): NextResponse {
  return NextResponse.json(
    { error: "forbidden", reason },
    { status: 403 },
  );
}

export function proxy(req: NextRequest): NextResponse {
  if (SAFE_METHODS.has(req.method)) return NextResponse.next();

  const host = req.headers.get("host");
  const origin = req.headers.get("origin");
  const fetchSite = req.headers.get("sec-fetch-site");

  // 1. Origin must match host (when present).
  if (origin) {
    try {
      const originHost = new URL(origin).host;
      if (!host || originHost !== host) {
        return deny("origin mismatch");
      }
    } catch {
      return deny("invalid origin");
    }
  }

  // 2. Sec-Fetch-Site, when supplied, must be same-origin or none.
  if (fetchSite && fetchSite !== "same-origin" && fetchSite !== "none") {
    return deny(`sec-fetch-site=${fetchSite}`);
  }

  // 3. Custom header forces a CORS preflight on cross-origin requests.
  if (req.headers.get("x-daycmd") !== "1") {
    return deny("missing x-daycmd header");
  }

  return NextResponse.next();
}

export const config = {
  matcher: "/api/:path*",
};
