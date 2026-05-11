import { NextResponse } from "next/server";
import { getEvents } from "@/lib/calendar";
import { status } from "@/lib/google";

export const dynamic = "force-dynamic";

export async function GET() {
  const s = status();
  if (!s.configured)
    return NextResponse.json({ error: "not configured", ...s }, { status: 200 });
  if (!s.connected)
    return NextResponse.json({ error: "not connected", ...s }, { status: 200 });
  try {
    const events = await getEvents(36);
    return NextResponse.json({ events, ...s });
  } catch (e) {
    return NextResponse.json(
      { error: (e as Error).message, ...s },
      { status: 500 },
    );
  }
}
