import { NextResponse } from "next/server";
import { listOutputs } from "@/lib/kb";

export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ category: string }> },
) {
  const { category } = await ctx.params;
  const decoded = decodeURIComponent(category);
  const files = await listOutputs(decoded, 20);
  return NextResponse.json({ files });
}
