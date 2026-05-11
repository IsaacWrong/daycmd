import { NextResponse } from "next/server";
import { getInbox } from "@/lib/gmail";
import { status } from "@/lib/google";

export const dynamic = "force-dynamic";

export async function GET() {
  const s = status();
  if (!s.configured)
    return NextResponse.json({ error: "not configured", ...s }, { status: 200 });
  if (!s.connected)
    return NextResponse.json({ error: "not connected", ...s }, { status: 200 });
  try {
    const messages = await getInbox(10);
    return NextResponse.json({ messages, ...s });
  } catch (e) {
    return NextResponse.json(
      { error: (e as Error).message, ...s },
      { status: 500 },
    );
  }
}
