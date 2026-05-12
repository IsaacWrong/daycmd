import { NextResponse } from "next/server";
import { listAllStats, ensureKbBootstrap, ensureCategory } from "@/lib/kb";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await ensureKbBootstrap();
    const stats = await listAllStats();
    return NextResponse.json({ categories: stats });
  } catch (e) {
    return NextResponse.json(
      { error: (e as Error).message },
      { status: 500 },
    );
  }
}

export async function POST(req: Request) {
  const body = (await req.json()) as { name?: string };
  if (!body.name || !body.name.trim()) {
    return NextResponse.json({ error: "name required" }, { status: 400 });
  }
  try {
    await ensureCategory(body.name.trim());
    return NextResponse.json({ ok: true, name: body.name.trim() });
  } catch (e) {
    return NextResponse.json(
      { error: (e as Error).message },
      { status: 500 },
    );
  }
}
