import { NextResponse } from "next/server";
import { listThreads } from "@/lib/gmail";
import { status } from "@/lib/google";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const s = status();
  if (!s.configured)
    return NextResponse.json({ error: "not configured", ...s }, { status: 200 });
  if (!s.connected)
    return NextResponse.json({ error: "not connected", ...s }, { status: 200 });

  const url = new URL(req.url);
  const max = Number(url.searchParams.get("max") ?? "50");
  const q = url.searchParams.get("q") ?? undefined;
  const labelIdsParam = url.searchParams.get("labelIds");
  const labelIds = labelIdsParam
    ? labelIdsParam.split(",").filter(Boolean)
    : undefined;

  try {
    const threads = await listThreads({ max, query: q, labelIds });
    return NextResponse.json({ threads, ...s });
  } catch (e) {
    return NextResponse.json(
      { error: (e as Error).message, ...s },
      { status: 500 },
    );
  }
}
