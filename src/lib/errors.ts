import fs from "node:fs";
import path from "node:path";
import { format } from "date-fns";
import { db } from "./db";
import { env } from "./config";

export type ErrorRow = {
  id: number;
  ts: number;
  source: string;
  message: string;
  context: string | null;
  resolved_at: number | null;
};

const ERRORS_DIR = path.join(env.VAULT_PATH, "Errors");

function ensureDir(): boolean {
  try {
    fs.mkdirSync(ERRORS_DIR, { recursive: true });
    return true;
  } catch {
    return false;
  }
}

function vaultAppend(ts: number, source: string, message: string, context?: unknown): void {
  if (!ensureDir()) return;
  const d = new Date(ts);
  const file = path.join(ERRORS_DIR, `${format(d, "yyyy-MM-dd")}.md`);
  const time = format(d, "HH:mm:ss");
  const safeMsg = message.replace(/\r?\n/g, " ").slice(0, 800);
  const ctx = context ? ` · ctx=${JSON.stringify(context).slice(0, 400)}` : "";
  const line = `- \`${time}\` · **${source}** · ${safeMsg}${ctx}\n`;
  try {
    const exists = fs.existsSync(file);
    if (!exists) {
      const header = `# Errors · ${format(d, "yyyy-MM-dd")}\n\n`;
      fs.writeFileSync(file, header + line, "utf8");
    } else {
      fs.appendFileSync(file, line, "utf8");
    }
  } catch {
    // never throw from logger
  }
}

export function logError(source: string, message: string, context?: unknown): void {
  const ts = Date.now();
  try {
    db.prepare(
      "INSERT INTO error_log (ts, source, message, context) VALUES (?, ?, ?, ?)",
    ).run(
      ts,
      source,
      message.slice(0, 4000),
      context ? JSON.stringify(context).slice(0, 4000) : null,
    );
  } catch {
    // never throw from logger
  }
  vaultAppend(ts, source, message, context);
}

export function recentErrors(limit = 20, includeResolved = false): ErrorRow[] {
  if (includeResolved) {
    return db
      .prepare("SELECT * FROM error_log ORDER BY ts DESC LIMIT ?")
      .all(limit) as ErrorRow[];
  }
  return db
    .prepare(
      "SELECT * FROM error_log WHERE resolved_at IS NULL ORDER BY ts DESC LIMIT ?",
    )
    .all(limit) as ErrorRow[];
}

export function resolveError(id: number): boolean {
  const info = db
    .prepare(
      "UPDATE error_log SET resolved_at = ? WHERE id = ? AND resolved_at IS NULL",
    )
    .run(Date.now(), id);
  return info.changes > 0;
}

export function unresolveError(id: number): boolean {
  const info = db
    .prepare("UPDATE error_log SET resolved_at = NULL WHERE id = ?")
    .run(id);
  return info.changes > 0;
}

export function clearErrors(): void {
  db.prepare("DELETE FROM error_log").run();
}

/**
 * Rewrite every per-day Errors/{yyyy-MM-dd}.md file from the DB.
 * Overwrites existing files so the vault is an exact mirror of error_log.
 */
export function backfillErrorsToVault(): { files: string[]; rows: number } {
  if (!ensureDir()) return { files: [], rows: 0 };
  const rows = db
    .prepare("SELECT * FROM error_log ORDER BY ts ASC")
    .all() as ErrorRow[];
  const byDay = new Map<string, string[]>();
  for (const r of rows) {
    const d = new Date(r.ts);
    const day = format(d, "yyyy-MM-dd");
    const time = format(d, "HH:mm:ss");
    const safeMsg = (r.message || "").replace(/\r?\n/g, " ").slice(0, 800);
    const ctx = r.context ? ` · ctx=${r.context.slice(0, 400)}` : "";
    const line = `- \`${time}\` · **${r.source}** · ${safeMsg}${ctx}`;
    if (!byDay.has(day)) byDay.set(day, []);
    byDay.get(day)!.push(line);
  }
  const files: string[] = [];
  for (const [day, lines] of byDay) {
    const body = `# Errors · ${day}\n\n${lines.join("\n")}\n`;
    const file = path.join(ERRORS_DIR, `${day}.md`);
    try {
      fs.writeFileSync(file, body, "utf8");
      files.push(file);
    } catch {}
  }
  return { files, rows: rows.length };
}
