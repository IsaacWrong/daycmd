import { NextResponse } from "next/server";
import { z } from "zod";
import { resolveConfirmation } from "@/lib/agent-tools";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Body = z.object({
  nonce: z.string().min(1),
  approved: z.boolean(),
});

// Confirmation endpoint for destructive agent tools. The agent loop in
// streamAgent emits a `tool_pending` SSE event containing a nonce; the client
// posts the user's approve/deny decision here. We resolve the in-memory
// promise the loop is waiting on. The pending map lives in agent-tools.ts so
// both sides see the same Map instance.
export async function POST(req: Request) {
  let parsed: z.infer<typeof Body>;
  try {
    parsed = Body.parse(await req.json());
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: (e as Error).message },
      { status: 400 },
    );
  }
  const resolved = resolveConfirmation(parsed.nonce, parsed.approved);
  if (!resolved) {
    return NextResponse.json(
      { ok: false, error: "unknown or expired nonce" },
      { status: 404 },
    );
  }
  return NextResponse.json({ ok: true });
}
