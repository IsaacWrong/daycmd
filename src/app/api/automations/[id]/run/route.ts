import { NextResponse } from "next/server";
import { runAutomation } from "@/lib/automations";

export const dynamic = "force-dynamic";

export async function POST(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  try {
    const run = await runAutomation(Number(id));
    return NextResponse.json({ run });
  } catch (e) {
    return NextResponse.json(
      { error: (e as Error).message },
      { status: 500 },
    );
  }
}
