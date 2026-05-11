export type Priority = "highest" | "high" | "medium" | "low" | "lowest" | null;

export type ObsidianTask = {
  id: string;
  text: string;
  done: boolean;
  cancelled: boolean;
  due: string | null;
  start: string | null;
  scheduled: string | null;
  doneDate: string | null;
  priority: Priority;
  recurrence: string | null;
  file: string;
  line: number;
  raw: string;
};

const PRIORITY: Record<string, Priority> = {
  "🔺": "highest",
  "⏫": "high",
  "🔼": "medium",
  "🔽": "low",
  "⏬": "lowest",
};

const TASK_RE = /^\s*[-*+]\s+\[(.)\]\s+(.*)$/;
const DATE = /(\d{4}-\d{2}-\d{2})/;

function extractDate(s: string, emoji: string): string | null {
  const re = new RegExp(`${emoji}\\s*${DATE.source}`);
  const m = s.match(re);
  return m ? m[1] : null;
}

export function parseTasks(content: string, file: string): ObsidianTask[] {
  const out: ObsidianTask[] = [];
  const lines = content.split("\n");

  lines.forEach((line, idx) => {
    const m = line.match(TASK_RE);
    if (!m) return;
    const marker = m[1];
    const body = m[2];

    let priority: Priority = null;
    for (const [emoji, p] of Object.entries(PRIORITY)) {
      if (body.includes(emoji)) {
        priority = p;
        break;
      }
    }

    const due = extractDate(body, "📅");
    const start = extractDate(body, "🛫");
    const scheduled = extractDate(body, "⏳");
    const doneDate = extractDate(body, "✅");
    const cancelled = body.includes("❌");
    const recMatch = body.match(/🔁\s*([^📅🛫⏳✅❌🔺⏫🔼🔽⏬]+)/u);

    const text = body
      .replace(/[🔺⏫🔼🔽⏬]/gu, "")
      .replace(/📅\s*\d{4}-\d{2}-\d{2}/gu, "")
      .replace(/🛫\s*\d{4}-\d{2}-\d{2}/gu, "")
      .replace(/⏳\s*\d{4}-\d{2}-\d{2}/gu, "")
      .replace(/✅\s*\d{4}-\d{2}-\d{2}/gu, "")
      .replace(/❌\s*\d{4}-\d{2}-\d{2}/gu, "")
      .replace(/🔁\s*[^📅🛫⏳✅❌🔺⏫🔼🔽⏬]+/gu, "")
      .replace(/\s+/g, " ")
      .trim();

    out.push({
      id: `${file}:${idx}`,
      text,
      done: marker.toLowerCase() === "x",
      cancelled,
      due,
      start,
      scheduled,
      doneDate,
      priority,
      recurrence: recMatch ? recMatch[1].trim() : null,
      file,
      line: idx,
      raw: line,
    });
  });

  return out;
}

const PRIORITY_RANK: Record<NonNullable<Priority>, number> = {
  highest: 0,
  high: 1,
  medium: 2,
  low: 3,
  lowest: 4,
};

export function sortTasks(tasks: ObsidianTask[]): ObsidianTask[] {
  return [...tasks].sort((a, b) => {
    if (a.done !== b.done) return a.done ? 1 : -1;
    const ad = a.due ?? "9999-99-99";
    const bd = b.due ?? "9999-99-99";
    if (ad !== bd) return ad < bd ? -1 : 1;
    const ap = a.priority ? PRIORITY_RANK[a.priority] : 99;
    const bp = b.priority ? PRIORITY_RANK[b.priority] : 99;
    return ap - bp;
  });
}
