import { NextResponse } from "next/server";
import { getInbox } from "@/lib/gmail";
import { clearError, recordError, status } from "@/lib/google";

export const dynamic = "force-dynamic";

export async function GET() {
  const s = status();
  if (!s.configured)
    return NextResponse.json({ error: "not configured", ...s }, { status: 200 });
  if (!s.connected)
    return NextResponse.json({ error: "not connected", ...s }, { status: 200 });
  try {
    const inbox = await getInbox({ max: 50 });
    clearError();
    return NextResponse.json({ messages: inbox.messages, ...status() });
  } catch (e) {
    const msg = (e as Error).message;
    recordError(msg);
    return NextResponse.json({ error: msg, ...status() }, { status: 500 });
  }
}
