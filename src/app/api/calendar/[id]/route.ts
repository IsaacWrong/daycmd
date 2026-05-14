import { NextResponse } from "next/server";
import { z } from "zod";
import { cancelEvent, updateEvent } from "@/lib/calendar";
import { status } from "@/lib/google";

export const dynamic = "force-dynamic";

const PatchSchema = z.object({
  calendarId: z.string().optional(),
  summary: z.string().optional(),
  start: z.string().optional(),
  end: z.string().optional(),
  allDay: z.boolean().optional(),
  description: z.string().optional(),
  location: z.string().optional(),
  attendees: z.array(z.string().email()).optional(),
});

function gateStatus() {
  const s = status();
  if (!s.configured)
    return NextResponse.json({ error: "Google not configured" }, { status: 400 });
  if (!s.connected)
    return NextResponse.json({ error: "Google not connected" }, { status: 401 });
  return null;
}

function errResponse(e: unknown) {
  const msg = (e as Error).message;
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

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const gate = gateStatus();
  if (gate) return gate;

  const { id } = await ctx.params;
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON" }, { status: 400 });
  }
  const parsed = PatchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid payload", details: parsed.error.flatten() },
      { status: 400 },
    );
  }
  const { calendarId, ...patch } = parsed.data;
  try {
    const r = await updateEvent({ calendarId, eventId: id, patch });
    return NextResponse.json(r);
  } catch (e) {
    return errResponse(e);
  }
}

export async function DELETE(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const gate = gateStatus();
  if (gate) return gate;

  const { id } = await ctx.params;
  const url = new URL(req.url);
  const calendarId = url.searchParams.get("calendarId") ?? "primary";
  try {
    const r = await cancelEvent(id, calendarId);
    return NextResponse.json(r);
  } catch (e) {
    return errResponse(e);
  }
}
