import fs from "node:fs/promises";
import path from "node:path";
import { format } from "date-fns";
import { env } from "./config";
import { parseTasks, sortTasks, type ObsidianTask } from "./tasks-parser";
import { renderTemplate } from "./template-tokens";
import { safeJoin, safeVaultJoin } from "./vault-path";
import {
  sweepTrash,
  trashBeforeOverwrite,
  vaultAppend,
  vaultWrite,
} from "./vault-write";

// Opportunistic trash sweep: 14 days. We piggyback on writeDailyNote so the
// sweep runs at most once per process per UTC day, and only when the agent is
// already touching the vault. Cheaper than a dedicated scheduler tick and
// avoids needing ENABLE_SCHEDULER=1 to gain the safety benefit.
const TRASH_TTL_MS = 14 * 24 * 60 * 60 * 1000;
let lastSweepDay: string | null = null;
function maybeSweep(date: Date): void {
  const day = format(date, "yyyy-MM-dd");
  if (lastSweepDay === day) return;
  lastSweepDay = day;
  // Fire-and-forget — never let a sweep failure block a vault write.
  void sweepTrash(TRASH_TTL_MS).catch(() => {});
}

const VAULT = env.VAULT_PATH;
const TASKS_DIR = safeVaultJoin("Tasks");
const DAILY_DIR = safeVaultJoin("Daily");

async function readDailyNoteConfig(): Promise<{
  folder: string;
  format: string;
  template: string | null;
}> {
  const candidates = [
    path.join(VAULT, ".obsidian", "daily-notes.json"),
    path.join(VAULT, ".obsidian", "plugins", "periodic-notes", "data.json"),
  ];
  for (const p of candidates) {
    try {
      const raw = await fs.readFile(p, "utf8");
      const parsed = JSON.parse(raw) as Record<string, unknown> & {
        daily?: { folder?: string; format?: string; template?: string };
      };
      const daily = parsed.daily ?? parsed;
      return {
        folder: (daily.folder as string) || "Daily",
        format: (daily.format as string) || "YYYY-MM-DD",
        template: (daily.template as string) || null,
      };
    } catch {}
  }
  return { folder: "Daily", format: "YYYY-MM-DD", template: null };
}

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
  await trashBeforeOverwrite(p);
  await vaultWrite(p, content);
  maybeSweep(date);
  const stat = await fs.stat(p);
  return stat.mtimeMs;
}

export async function ensureDailyNote(date = new Date()): Promise<{
  path: string;
  created: boolean;
  mtime: number;
}> {
  const p = dailyNotePath(date);
  try {
    const stat = await fs.stat(p);
    return { path: p, created: false, mtime: stat.mtimeMs };
  } catch {}

  const cfg = await readDailyNoteConfig();
  let body = "";
  if (cfg.template) {
    const templateRel = cfg.template.endsWith(".md") ? cfg.template : `${cfg.template}.md`;
    try {
      const templatePath = safeJoin(VAULT, templateRel);
      const tpl = await fs.readFile(templatePath, "utf8");
      body = renderTemplate(tpl, date, { title: format(date, "yyyy-MM-dd") });
    } catch {
      body = "";
    }
  }
  // New file — no prior contents to trash.
  await vaultWrite(p, body);
  const stat = await fs.stat(p);
  return { path: p, created: true, mtime: stat.mtimeMs };
}

export async function appendToDailyNote(
  text: string,
  date = new Date(),
): Promise<number> {
  const p = dailyNotePath(date);
  let existing = "";
  try {
    existing = await fs.readFile(p, "utf8");
  } catch {}
  const sep = existing && !existing.endsWith("\n") ? "\n" : "";
  await vaultAppend(p, sep + text + "\n");
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
