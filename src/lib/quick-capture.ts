import { readDailyNote, writeDailyNote } from "./obsidian";
import { writeRawIngest, listCategories } from "./kb";

type RouteResult = {
  processed: Array<{ tag: string; text: string; category: string; path: string }>;
  unrouted: Array<{ text: string; reason: string }>;
};

function slugMatch(tag: string, categoryName: string): boolean {
  const norm = (s: string) =>
    s.toLowerCase().replace(/[^a-z0-9]+/g, "");
  return norm(tag) === norm(categoryName);
}

export async function routeQuickCapture(): Promise<RouteResult> {
  const note = await readDailyNote();
  if (!note.exists) {
    return { processed: [], unrouted: [] };
  }
  const lines = note.content.split("\n");

  // Find Quick Capture section bounds (## Quick Capture .. next ## or EOF)
  let startIdx = -1;
  for (let i = 0; i < lines.length; i++) {
    if (/^##\s+Quick Capture/i.test(lines[i])) {
      startIdx = i + 1;
      break;
    }
  }
  if (startIdx < 0) return { processed: [], unrouted: [] };
  let endIdx = lines.length;
  for (let i = startIdx; i < lines.length; i++) {
    if (/^##\s+/.test(lines[i])) {
      endIdx = i;
      break;
    }
  }

  const cats = await listCategories();
  const processed: RouteResult["processed"] = [];
  const unrouted: RouteResult["unrouted"] = [];
  const keep: string[] = [];

  const itemRe = /^[\s]*[-*+]?\s*(.+?)\s+#([a-z0-9_-]+)\s*$/i;
  for (let i = startIdx; i < endIdx; i++) {
    const raw = lines[i];
    const m = raw.match(itemRe);
    if (!m) {
      keep.push(raw);
      continue;
    }
    const text = m[1].trim();
    const tag = m[2].trim();
    const match = cats.find((c) => slugMatch(tag, c));
    if (!match) {
      keep.push(raw);
      unrouted.push({ text, reason: `no category for #${tag}` });
      continue;
    }
    try {
      const path = await writeRawIngest({
        category: match,
        title: text.slice(0, 80) || `Quick capture ${new Date().toISOString()}`,
        content: text,
        sourceType: "quick_capture",
      });
      processed.push({ tag, text, category: match, path });
      // remove this line from daily note (don't push to keep)
    } catch (e) {
      keep.push(raw);
      unrouted.push({ text, reason: (e as Error).message });
    }
  }

  if (processed.length > 0) {
    const next = [
      ...lines.slice(0, startIdx),
      ...keep,
      ...lines.slice(endIdx),
    ].join("\n");
    await writeDailyNote(next);
  }

  return { processed, unrouted };
}
