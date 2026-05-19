import { NextResponse } from "next/server";
import { z } from "zod";
import fs from "node:fs/promises";
import path from "node:path";
import { format, subDays } from "date-fns";
import { microCached } from "@/lib/micro";
import { env } from "@/lib/config";
import { grepWiki, listCategories } from "@/lib/kb";

export const dynamic = "force-dynamic";

const BodySchema = z.object({
  eventId: z.string().min(1),
  summary: z.string(),
  description: z.string().nullable().optional(),
  start: z.string(),
  location: z.string().nullable().optional(),
});

type Brief = {
  bullets: string[];
  wikiHits: Array<{ category: string; path: string }>;
  priorMentions: Array<{ date: string; line: string }>;
};

const STOPWORDS = new Set([
  "the",
  "and",
  "with",
  "for",
  "from",
  "into",
  "your",
  "yours",
  "about",
  "this",
  "that",
  "their",
  "there",
  "meeting",
  "call",
  "sync",
  "weekly",
  "monthly",
  "daily",
  "review",
  "check-in",
  "checkin",
  "discuss",
  "discussion",
  "intro",
  "introduction",
]);

function extractKeywords(summary: string, description: string | null | undefined): string[] {
  const text = `${summary} ${description ?? ""}`;
  const words = text
    .replace(/[^\p{L}\p{N}\s'-]/gu, " ")
    .split(/\s+/)
    .map((w) => w.trim())
    .filter((w) => w.length >= 3 && !STOPWORDS.has(w.toLowerCase()));
  const seen = new Set<string>();
  const out: string[] = [];
  for (const w of words) {
    const k = w.toLowerCase();
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(w);
    if (out.length >= 6) break;
  }
  return out;
}

async function searchWiki(keywords: string[]): Promise<Array<{ category: string; path: string; preview: string }>> {
  if (keywords.length === 0) return [];
  const cats = await listCategories().catch(() => []);
  const hits: Array<{ category: string; path: string; preview: string }> = [];
  for (const cat of cats) {
    for (const kw of keywords.slice(0, 3)) {
      try {
        const results = await grepWiki(cat, kw);
        for (const r of results.slice(0, 2)) {
          hits.push({
            category: cat,
            path: r.path,
            preview: r.snippet.slice(0, 200),
          });
          if (hits.length >= 6) return hits;
        }
      } catch {}
    }
  }
  return hits;
}

async function searchDailyNotes(
  keywords: string[],
): Promise<Array<{ date: string; line: string }>> {
  if (keywords.length === 0 || !env.VAULT_PATH) return [];
  const lower = keywords.map((k) => k.toLowerCase());
  const out: Array<{ date: string; line: string }> = [];
  for (let i = 1; i <= 14; i++) {
    const d = subDays(new Date(), i);
    const date = format(d, "yyyy-MM-dd");
    const p = path.join(env.VAULT_PATH, "Daily", `${date}.md`);
    let content: string;
    try {
      content = await fs.readFile(p, "utf8");
    } catch {
      continue;
    }
    for (const line of content.split("\n")) {
      const lc = line.toLowerCase();
      if (lower.some((k) => lc.includes(k))) {
        out.push({ date, line: line.trim().slice(0, 200) });
        if (out.length >= 5) return out;
        break;
      }
    }
  }
  return out;
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
  const { eventId, summary, description, start, location } = parsed.data;

  const keywords = extractKeywords(summary, description);
  const [wikiResults, priorMentions] = await Promise.all([
    searchWiki(keywords),
    searchDailyNotes(keywords),
  ]);

  if (wikiResults.length === 0 && priorMentions.length === 0) {
    return NextResponse.json<Brief & { cached?: boolean; reason?: string }>({
      bullets: [],
      wikiHits: [],
      priorMentions: [],
      reason: "No vault context found for this event.",
    });
  }

  const cacheKey = `${eventId}-${start.slice(0, 13)}`;

  const wikiBlob = wikiResults
    .map((h) => `- [${h.category}/${h.path}] ${h.preview}`)
    .join("\n");
  const priorBlob = priorMentions
    .map((m) => `- ${m.date}: ${m.line}`)
    .join("\n");

  const prompt = [
    `Event: "${summary}"`,
    description ? `Description: ${description.slice(0, 500)}` : "",
    location ? `Location: ${location}` : "",
    `Starts: ${start}`,
    "",
    wikiBlob ? `Vault wiki matches:\n${wikiBlob}` : "No wiki matches.",
    "",
    priorBlob ? `Mentions in prior daily notes:\n${priorBlob}` : "No daily-note mentions.",
    "",
    "Produce a tight prep card. 2-4 bullets only — what to know going in. Each bullet 6-14 words. Skip greetings/agenda generalities. Pull specifics from the matches when possible. If matches are weak, say one bullet like 'Limited prior context.'",
    'Reply JSON: {"bullets": ["...", "..."]} — no other fields.',
  ]
    .filter(Boolean)
    .join("\n");

  try {
    const { data, cached } = await microCached<{ bullets: string[] }>({
      source: "event-brief",
      cacheKey,
      ttlMs: 6 * 3600_000,
      persist: true,
      maxTokens: 400,
      system:
        "You produce concise meeting prep cards from vault context. Reply only with JSON.",
      prompt,
    });

    return NextResponse.json({
      bullets: data.bullets ?? [],
      wikiHits: wikiResults.map((h) => ({ category: h.category, path: h.path })),
      priorMentions,
      cached,
    });
  } catch (e) {
    return NextResponse.json(
      {
        error: (e as Error).message,
        bullets: [],
        wikiHits: wikiResults.map((h) => ({ category: h.category, path: h.path })),
        priorMentions,
      },
      { status: 200 },
    );
  }
}
