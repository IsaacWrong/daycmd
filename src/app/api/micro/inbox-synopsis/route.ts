import { NextResponse } from "next/server";
import { z } from "zod";
import { microCall, readPersistedMicro, writePersistedMicro } from "@/lib/micro";

export const dynamic = "force-dynamic";

const BodySchema = z.object({
  messages: z
    .array(
      z.object({
        id: z.string(),
        from: z.string(),
        subject: z.string(),
        snippet: z.string().optional().default(""),
      }),
    )
    .max(20),
});

type SynopsisMap = Record<string, string>;

const TTL_MS = 24 * 3600_000;

function cacheKeyFor(id: string, subject: string): string {
  // Include subject hash so reused message ids w/ new subjects bust.
  let hash = 0;
  for (const c of subject) hash = (hash * 31 + c.charCodeAt(0)) | 0;
  return `${id}-${hash}`;
}

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON" }, { status: 400 });
  }
  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid payload" }, { status: 400 });
  }
  const { messages } = parsed.data;
  if (messages.length === 0) {
    return NextResponse.json({ synopsis: {} });
  }

  const synopsis: SynopsisMap = {};
  const toFetch: Array<{ id: string; from: string; subject: string; snippet: string; cacheKey: string }> = [];

  for (const m of messages) {
    const key = cacheKeyFor(m.id, m.subject);
    const cached = readPersistedMicro<{ line: string }>("inbox-synopsis", key);
    if (cached) {
      synopsis[m.id] = cached.line;
    } else {
      toFetch.push({ ...m, cacheKey: key });
    }
  }

  if (toFetch.length === 0) {
    return NextResponse.json({ synopsis, cached: true });
  }

  const lines = toFetch.map(
    (m, i) =>
      `${i + 1}. id=${m.id}\n   From: ${m.from}\n   Subject: ${m.subject}\n   Snippet: ${m.snippet.slice(0, 240)}`,
  );

  const prompt = [
    "For each email below, write a single-line 'why this matters' synopsis. 6-12 words. Plain working voice. Skip pleasantries. State concretely what the email is asking, announcing, or offering. If it's promotional/marketing, say so plainly.",
    "",
    ...lines,
    "",
    'Reply JSON: {"synopsis": {"<id>": "<one-line synopsis>", ...}} — one entry per email.',
  ].join("\n");

  try {
    const data = await microCall<{ synopsis: Record<string, string> }>({
      source: "inbox-synopsis",
      maxTokens: Math.max(400, toFetch.length * 60),
      system:
        "You write terse one-line email synopses for a personal dashboard inbox. Reply only with JSON.",
      prompt,
    });

    for (const m of toFetch) {
      const line = data.synopsis?.[m.id];
      if (line) {
        synopsis[m.id] = line;
        writePersistedMicro("inbox-synopsis", m.cacheKey, { line }, TTL_MS);
      }
    }

    return NextResponse.json({ synopsis });
  } catch (e) {
    return NextResponse.json(
      { error: (e as Error).message, synopsis },
      { status: 200 },
    );
  }
}
