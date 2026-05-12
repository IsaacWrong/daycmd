import fs from "node:fs/promises";
import path from "node:path";
import { format } from "date-fns";
import { env } from "./config";

const TASKS_DIR = () => path.join(env.VAULT_PATH, "Tasks");

const PRIORITY_GLYPH: Record<string, string> = {
  highest: "🔺",
  high: "⏫",
  medium: "🔼",
  low: "🔽",
  lowest: "⏬",
};

export async function appendTask(input: {
  file?: string;
  text: string;
  due?: string;
  start?: string;
  scheduled?: string;
  priority?: "highest" | "high" | "medium" | "low" | "lowest";
}): Promise<{ path: string; line: number }> {
  const filename = (input.file ?? "Inbox").replace(/\.md$/, "") + ".md";
  const filePath = path.join(TASKS_DIR(), filename);
  await fs.mkdir(TASKS_DIR(), { recursive: true });

  let body = "";
  try {
    body = await fs.readFile(filePath, "utf8");
  } catch {
    body = "";
  }

  const parts: string[] = ["- [ ]", input.text.trim()];
  if (input.priority) parts.push(PRIORITY_GLYPH[input.priority]);
  if (input.due) parts.push(`📅 ${input.due}`);
  if (input.start) parts.push(`🛫 ${input.start}`);
  if (input.scheduled) parts.push(`⏳ ${input.scheduled}`);
  const taskLine = parts.join(" ");

  const next = body.endsWith("\n") || body === "" ? body + taskLine + "\n" : body + "\n" + taskLine + "\n";
  await fs.writeFile(filePath, next, "utf8");

  const lineIndex = next.split("\n").findIndex((l) => l === taskLine);
  return {
    path: path.relative(env.VAULT_PATH, filePath),
    line: lineIndex,
  };
}

export async function markTaskDone(input: {
  file: string;
  text: string;
}): Promise<{ ok: true; matched: number } | { ok: false; error: string }> {
  const filename = input.file.replace(/\.md$/, "") + ".md";
  const filePath = filename.startsWith(env.VAULT_PATH)
    ? filename
    : path.join(TASKS_DIR(), filename);
  let body: string;
  try {
    body = await fs.readFile(filePath, "utf8");
  } catch {
    return { ok: false, error: `cannot read ${filePath}` };
  }
  const today = format(new Date(), "yyyy-MM-dd");
  const lines = body.split("\n");
  let matched = 0;
  const needle = input.text.trim().toLowerCase();
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    const m = l.match(/^(\s*[-*+]\s+)\[ \](\s+)(.*)$/);
    if (!m) continue;
    if (!m[3].toLowerCase().includes(needle)) continue;
    lines[i] = `${m[1]}[x]${m[2]}${m[3]} ✅ ${today}`;
    matched++;
  }
  if (matched === 0) return { ok: false, error: `no open task matched: ${input.text}` };
  await fs.writeFile(filePath, lines.join("\n"), "utf8");
  return { ok: true, matched };
}
