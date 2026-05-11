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
}> {
  const p = dailyNotePath(date);
  try {
    const content = await fs.readFile(p, "utf8");
    return { path: p, content, exists: true };
  } catch {
    return { path: p, content: "", exists: false };
  }
}

export async function writeDailyNote(
  content: string,
  date = new Date(),
): Promise<void> {
  const p = dailyNotePath(date);
  await fs.mkdir(path.dirname(p), { recursive: true });
  await fs.writeFile(p, content, "utf8");
}
