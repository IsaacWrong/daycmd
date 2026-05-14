import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { format } from "date-fns";
import { db } from "./db";
import { env } from "./config";
import {
  appendLog,
  readAllLogs,
  rewriteOwnLog,
  readStateSync,
  writeStateSync,
  getDeviceId,
} from "./vault-state";

export type ErrorRow = {
  id: string;
  ts: number;
  source: string;
  message: string;
  context: string | null;
  resolved_at: number | null;
};

type StoredError = {
  id: string;
  ts: number;
  source: string;
  message: string;
  context: string | null;
};

const TABLE = "error_log";
const RESOLUTIONS_KEY = "error-resolutions";

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

let _migrated = false;
function migrateFromDb(): void {
  if (_migrated) return;
  _migrated = true;
  type DbRow = {
    id: number;
    ts: number;
    source: string;
    message: string;
    context: string | null;
    resolved_at: number | null;
  };
  let rows: DbRow[] = [];
  try {
    rows = db
      .prepare(
        "SELECT id, ts, source, message, context, resolved_at FROM error_log ORDER BY ts ASC",
      )
      .all() as DbRow[];
  } catch {
    return;
  }
  if (rows.length === 0) return;
  const resolutions = (readStateSync<Record<string, number>>(RESOLUTIONS_KEY)) ?? {};
  for (const r of rows) {
    const id = randomUUID();
    appendLog(TABLE, {
      id,
      ts: r.ts,
      source: r.source,
      message: r.message,
      context: r.context,
    } as StoredError);
    if (r.resolved_at) resolutions[id] = r.resolved_at;
  }
  try {
    writeStateSync(RESOLUTIONS_KEY, resolutions);
  } catch {}
  try {
    db.prepare("DELETE FROM error_log").run();
  } catch {}
}

function loadResolutions(): Record<string, number> {
  return (readStateSync<Record<string, number>>(RESOLUTIONS_KEY)) ?? {};
}

function loadAll(): ErrorRow[] {
  migrateFromDb();
  const resolutions = loadResolutions();
  return readAllLogs<StoredError>(TABLE).map((r) => ({
    id: r.id,
    ts: r.ts,
    source: r.source,
    message: r.message,
    context: r.context,
    resolved_at: resolutions[r.id] ?? null,
  }));
}

export function logError(source: string, message: string, context?: unknown): void {
  const ts = Date.now();
  const record: StoredError = {
    id: randomUUID(),
    ts,
    source,
    message: message.slice(0, 4000),
    context: context ? JSON.stringify(context).slice(0, 4000) : null,
  };
  try {
    appendLog(TABLE, record);
  } catch {
    // never throw from logger
  }
  vaultAppend(ts, source, message, context);
}

export function recentErrors(limit = 20, includeResolved = false): ErrorRow[] {
  const all = loadAll().sort((a, b) => b.ts - a.ts);
  const filtered = includeResolved ? all : all.filter((r) => r.resolved_at === null);
  return filtered.slice(0, limit);
}

export function resolveError(id: string): boolean {
  const resolutions = loadResolutions();
  if (resolutions[id]) return false;
  resolutions[id] = Date.now();
  writeStateSync(RESOLUTIONS_KEY, resolutions);
  return true;
}

export function unresolveError(id: string): boolean {
  const resolutions = loadResolutions();
  if (!resolutions[id]) return false;
  delete resolutions[id];
  writeStateSync(RESOLUTIONS_KEY, resolutions);
  return true;
}

export function clearErrors(): void {
  // Only clears this device's log; other devices still have their own copies
  // until they sync the cleared state. Safer than nuking a shared file.
  rewriteOwnLog<StoredError>(TABLE, () => false);
  try {
    writeStateSync(RESOLUTIONS_KEY, {});
  } catch {}
}

/**
 * Rewrite every per-day Errors/{yyyy-MM-dd}.md file from the unified log.
 * Overwrites existing files so the vault is an exact mirror of the log.
 */
export function backfillErrorsToVault(): { files: string[]; rows: number } {
  if (!ensureDir()) return { files: [], rows: 0 };
  const rows = loadAll().sort((a, b) => a.ts - b.ts);
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

// Re-exported so other modules can attribute records to the writing device
// without pulling vault-state directly.
export { getDeviceId };
