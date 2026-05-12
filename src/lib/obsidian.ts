import fs from "node:fs/promises";
import path from "node:path";
import { format } from "date-fns";
import { env } from "./config";
import { parseTasks, sortTasks, type ObsidianTask } from "./tasks-parser";

const VAULT = env.VAULT_PATH;
const TASKS_DIR = path.join(VAULT, "Tasks");
const DAILY_DIR = path.join(VAULT, "Daily");

async function listMarkdown(dir: string): Promise<string[]> {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  return entries
    .filter((e) => e.isFile() && e.name.endsWith(".md"))
    .map((e) => path.join(dir, e.name));
}

export async function getAllTasks(): Promise<ObsidianTask[]> {
  const files = await listMarkdown(TASKS_DIR);
  const all: ObsidianTask[] = [];
  for (const f of files) {
    const content = await fs.readFile(f, "utf8");
    const rel = path.relative(VAULT, f);
    all.push(...parseTasks(content, rel));
  }
  return sortTasks(all);
}

export function dailyNotePath(date = new Date()): string {
  return path.join(DAILY_DIR, `${format(date, "yyyy-MM-dd")}.md`);
}

export async function readDailyNote(date = new Date()): Promise<{
  path: string;
  content: string;
  exists: boolean;
  mtime: number;
}> {
  const p = dailyNotePath(date);
  try {
    const [content, stat] = await Promise.all([
      fs.readFile(p, "utf8"),
      fs.stat(p),
    ]);
    return { path: p, content, exists: true, mtime: stat.mtimeMs };
  } catch {
    return { path: p, content: "", exists: false, mtime: 0 };
  }
}

export async function writeDailyNote(
  content: string,
  date = new Date(),
): Promise<number> {
  const p = dailyNotePath(date);
  await fs.mkdir(path.dirname(p), { recursive: true });
  await fs.writeFile(p, content, "utf8");
  const stat = await fs.stat(p);
  return stat.mtimeMs;
}

export async function appendToDailyNote(
  text: string,
  date = new Date(),
): Promise<number> {
  const p = dailyNotePath(date);
  await fs.mkdir(path.dirname(p), { recursive: true });
  let existing = "";
  try {
    existing = await fs.readFile(p, "utf8");
  } catch {}
  const sep = existing && !existing.endsWith("\n") ? "\n" : "";
  const next = existing + sep + text + "\n";
  await fs.writeFile(p, next, "utf8");
  const stat = await fs.stat(p);
  return stat.mtimeMs;
}

export async function writeDailyNoteIfUnchanged(
  content: string,
  expectedMtime: number,
  date = new Date(),
): Promise<{ ok: true; mtime: number } | { ok: false; current: { content: string; mtime: number } }> {
  const p = dailyNotePath(date);
  let currentMtime = 0;
  try {
    const stat = await fs.stat(p);
    currentMtime = stat.mtimeMs;
  } catch {
    currentMtime = 0;
  }
  // Allow small tolerance for filesystem mtime precision.
  if (expectedMtime > 0 && Math.abs(currentMtime - expectedMtime) > 1) {
    const current = await readDailyNote(date);
    return { ok: false, current: { content: current.content, mtime: current.mtime } };
  }
  if (expectedMtime === 0 && currentMtime > 0) {
    // Caller thinks file doesn't exist but it does — conflict.
    const current = await readDailyNote(date);
    return { ok: false, current: { content: current.content, mtime: current.mtime } };
  }
  const mtime = await writeDailyNote(content, date);
  return { ok: true, mtime };
}
