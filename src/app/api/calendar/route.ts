import { NextResponse } from "next/server";
import { z } from "zod";
import { createEvent, getEvents } from "@/lib/calendar";
import { status } from "@/lib/google";

export const dynamic = "force-dynamic";

const CreateSchema = z.object({
  summary: z.string().min(1),
  start: z.string().min(1),
  end: z.string().min(1),
  description: z.string().optional(),
  location: z.string().optional(),
  attendees: z.array(z.string().email()).optional(),
});

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

export async function POST(req: Request) {
  const s = status();
  if (!s.configured)
    return NextResponse.json({ error: "Google not configured" }, { status: 400 });
  if (!s.connected)
    return NextResponse.json({ error: "Google not connected" }, { status: 401 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON" }, { status: 400 });
  }
  const parsed = CreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid payload", details: parsed.error.flatten() },
      { status: 400 },
    );
  }
  try {
    const r = await createEvent(parsed.data);
    return NextResponse.json(r);
  } catch (e) {
    const msg = (e as Error).message;
    const status = /insufficient|forbidden|permission/i.test(msg) ? 403 : 500;
    return NextResponse.json(
      {
        error: msg,
        hint:
          status === 403
            ? "Reconnect Google — calendar write scope missing on stored token."
            : undefined,
      },
      { status },
    );
  }
}
