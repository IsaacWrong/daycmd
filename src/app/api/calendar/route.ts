import { NextResponse } from "next/server";
import { z } from "zod";
import { createEvent, getEvents } from "@/lib/calendar";
import { clearError, recordError, status } from "@/lib/google";

export const dynamic = "force-dynamic";

const CreateSchema = z.object({
  calendarId: z.string().optional(),
  summary: z.string().min(1),
  start: z.string().min(1),
  end: z.string().min(1),
  allDay: z.boolean().optional(),
  description: z.string().optional(),
  location: z.string().optional(),
  attendees: z.array(z.string().email()).optional(),
});

export async function GET(req: Request) {
  const s = status();
  if (!s.configured)
    return NextResponse.json({ error: "not configured", ...s }, { status: 200 });
  if (!s.connected)
    return NextResponse.json({ error: "not connected", ...s }, { status: 200 });

  const url = new URL(req.url);
  const from = url.searchParams.get("from");
  const to = url.searchParams.get("to");

  try {
    // Widen range by ~1 day each side so all-day events anchored in other
    // timezones (or calendars with different TZ) still come through.
    const pad = 36 * 3600 * 1000;
    const wideFrom = from
      ? new Date(new Date(from).getTime() - pad).toISOString()
      : null;
    const wideTo = to
      ? new Date(new Date(to).getTime() + pad).toISOString()
      : null;
    const events =
      wideFrom && wideTo
        ? await getEvents({ from: wideFrom, to: wideTo })
        : await getEvents(36);
    clearError();
    return NextResponse.json({ events, ...status() });
  } catch (e) {
    const msg = (e as Error).message;
    recordError(msg);
    return NextResponse.json({ error: msg, ...status() }, { status: 500 });
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
    clearError();
    return NextResponse.json(r);
  } catch (e) {
    const msg = (e as Error).message;
    recordError(msg);
    const code = /insufficient|forbidden|permission/i.test(msg) ? 403 : 500;
    return NextResponse.json(
      {
        error: msg,
        hint:
          code === 403
            ? "Reconnect Google — calendar write scope missing on stored token."
            : undefined,
      },
      { status: code },
    );
  }
}
