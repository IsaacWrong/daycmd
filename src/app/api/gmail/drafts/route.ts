import { NextResponse } from "next/server";
import { z } from "zod";
import { listDrafts, upsertComposeDraft, upsertReplyDraft } from "@/lib/gmail";
import { status } from "@/lib/google";

export const dynamic = "force-dynamic";

const ReplyDraftSchema = z.object({
  kind: z.literal("reply"),
  draftId: z.string().optional(),
  threadId: z.string(),
  body: z.string(),
  replyAll: z.boolean().optional(),
});

const ComposeDraftSchema = z.object({
  kind: z.literal("compose"),
  draftId: z.string().optional(),
  to: z.string(),
  cc: z.string().optional(),
  subject: z.string(),
  body: z.string(),
});

const UpsertSchema = z.discriminatedUnion("kind", [
  ReplyDraftSchema,
  ComposeDraftSchema,
]);

export async function GET() {
  const s = status();
  if (!s.configured)
    return NextResponse.json({ error: "not configured", ...s }, { status: 200 });
  if (!s.connected)
    return NextResponse.json({ error: "not connected", ...s }, { status: 200 });
  try {
    const drafts = await listDrafts({ max: 50 });
    return NextResponse.json({ drafts, ...s });
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
  const parsed = UpsertSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid payload", details: parsed.error.flatten() },
      { status: 400 },
    );
  }
  try {
    const r =
      parsed.data.kind === "reply"
        ? await upsertReplyDraft(parsed.data)
        : await upsertComposeDraft(parsed.data);
    return NextResponse.json(r);
  } catch (e) {
    return NextResponse.json(
      { error: (e as Error).message },
      { status: 500 },
    );
  }
}
