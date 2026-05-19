import fs from "node:fs";
import fsp from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { env } from "./config";

const STATE_SUBDIR = path.join(".obsidian", "daycmd");
// Logs live outside .obsidian/ so Obsidian Sync replicates them without
// requiring the user to enable "Sync all other types of files" under the
// hidden plugin-config folder.
const LOGS_SUBDIR = path.join("daycmd", "logs");
const LEGACY_LOGS_SUBDIR = path.join(".obsidian", "daycmd", "logs");

function stateRoot(): string {
  if (!env.VAULT_PATH) throw new Error("VAULT_PATH not configured");
  return path.join(env.VAULT_PATH, STATE_SUBDIR);
}

// Filesystem-safe device id. Hostnames usually fit /^[A-Za-z0-9._\-]+$/ but
// macOS and Linux allow colons and other characters; sanitise defensively.
function deviceId(): string {
  const raw = os.hostname() || "unknown";
  return raw.replace(/[^A-Za-z0-9._-]+/g, "-").slice(0, 64) || "unknown";
}

function logsRoot(): string {
  if (!env.VAULT_PATH) throw new Error("VAULT_PATH not configured");
  return path.join(env.VAULT_PATH, LOGS_SUBDIR);
}

function legacyLogsRoot(): string | null {
  if (!env.VAULT_PATH) return null;
  return path.join(env.VAULT_PATH, LEGACY_LOGS_SUBDIR);
}

function deviceLogPath(table: string): string {
  if (!/^[A-Za-z0-9._-]+$/.test(table)) throw new Error("invalid log table");
  return path.join(logsRoot(), deviceId(), `${table}.ndjson`);
}

// One-time migration: move this device's logs from the legacy
// .obsidian/daycmd/logs/<device>/ path to <vault>/daycmd/logs/<device>/.
// Each device migrates its own folder independently; Obsidian Sync then
// replicates the new location to peers. Idempotent and best-effort.
let migrationAttempted = false;
function migrateLegacyLogs(): void {
  if (migrationAttempted) return;
  migrationAttempted = true;
  if (!env.VAULT_PATH) return;
  const legacy = legacyLogsRoot();
  if (!legacy) return;
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(legacy, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const oldDir = path.join(legacy, entry.name);
    const newDir = path.join(logsRoot(), entry.name);
    try {
      fs.mkdirSync(path.dirname(newDir), { recursive: true });
      if (!fs.existsSync(newDir)) {
        fs.renameSync(oldDir, newDir);
        continue;
      }
      // Destination already exists — append legacy NDJSON contents into the
      // new files line-by-line, then remove the legacy dir. Order doesn't
      // matter for downstream aggregation (records are grouped by timestamp).
      const files = fs.readdirSync(oldDir, { withFileTypes: true });
      for (const f of files) {
        if (!f.isFile() || !f.name.endsWith(".ndjson")) continue;
        const src = path.join(oldDir, f.name);
        const dst = path.join(newDir, f.name);
        try {
          const data = fs.readFileSync(src, "utf8");
          if (data) {
            const suffix = data.endsWith("\n") ? "" : "\n";
            fs.appendFileSync(dst, `${data}${suffix}`, "utf8");
          }
          fs.unlinkSync(src);
        } catch {
          // best-effort: skip files we can't read or write
        }
      }
      try {
        fs.rmdirSync(oldDir);
      } catch {
        // non-empty or permission issue — leave behind
      }
    } catch {
      // best-effort — never let migration crash a request
    }
  }
}

// Reject anything that escapes the state root or smells like a traversal attempt.
function resolveKey(key: string): string {
  if (!key || typeof key !== "string") throw new Error("invalid state key");
  if (!/^[A-Za-z0-9._\-/]+$/.test(key)) throw new Error("invalid state key");
  if (key.includes("..")) throw new Error("invalid state key");
  const root = stateRoot();
  const file = path.join(root, `${key}.json`);
  const rel = path.relative(root, file);
  if (rel.startsWith("..") || path.isAbsolute(rel)) throw new Error("invalid state key");
  return file;
}

export function readStateSync<T = unknown>(key: string): T | null {
  let file: string;
  try {
    file = resolveKey(key);
  } catch {
    return null;
  }
  try {
    const raw = fs.readFileSync(file, "utf8");
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export async function readState<T = unknown>(key: string): Promise<T | null> {
  let file: string;
  try {
    file = resolveKey(key);
  } catch {
    return null;
  }
  try {
    const raw = await fsp.readFile(file, "utf8");
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export function writeStateSync(key: string, value: unknown): void {
  const file = resolveKey(key);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = `${file}.tmp-${process.pid}-${Date.now()}`;
  fs.writeFileSync(tmp, JSON.stringify(value, null, 2), "utf8");
  fs.renameSync(tmp, file);
}

export async function writeState(key: string, value: unknown): Promise<void> {
  const file = resolveKey(key);
  await fsp.mkdir(path.dirname(file), { recursive: true });
  const tmp = `${file}.tmp-${process.pid}-${Date.now()}`;
  await fsp.writeFile(tmp, JSON.stringify(value, null, 2), "utf8");
  await fsp.rename(tmp, file);
}

export async function deleteState(key: string): Promise<void> {
  const file = resolveKey(key);
  try {
    await fsp.unlink(file);
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code !== "ENOENT") throw e;
  }
}

export function deleteStateSync(key: string): void {
  const file = resolveKey(key);
  try {
    fs.unlinkSync(file);
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code !== "ENOENT") throw e;
  }
}

// Append-only NDJSON logs. Each device writes only to its own file
// (logs/<device>/<table>.ndjson) to avoid Obsidian Sync conflict copies.
// Reads union all device files.

export function appendLog(table: string, record: unknown): void {
  if (!env.VAULT_PATH) return;
  migrateLegacyLogs();
  const file = deviceLogPath(table);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.appendFileSync(file, `${JSON.stringify(record)}\n`, "utf8");
}

export type LogRecord<T> = T & { _device: string };

export function readAllLogs<T = unknown>(table: string): Array<LogRecord<T>> {
  if (!env.VAULT_PATH) return [];
  if (!/^[A-Za-z0-9._-]+$/.test(table)) return [];
  migrateLegacyLogs();
  const root = logsRoot();
  let devices: string[] = [];
  try {
    devices = fs.readdirSync(root, { withFileTypes: true })
      .filter((e) => e.isDirectory())
      .map((e) => e.name);
  } catch {
    return [];
  }
  const out: Array<LogRecord<T>> = [];
  for (const dev of devices) {
    const file = path.join(root, dev, `${table}.ndjson`);
    let raw: string;
    try {
      raw = fs.readFileSync(file, "utf8");
    } catch {
      continue;
    }
    for (const line of raw.split("\n")) {
      if (!line) continue;
      try {
        const obj = JSON.parse(line) as T;
        out.push({ ...obj, _device: dev });
      } catch {
        // skip malformed lines — never let one bad row tank the read
      }
    }
  }
  return out;
}

// Rewrites this device's log file in place with a filtered subset. Use
// sparingly (e.g. clearErrors). Other devices' files are untouched.
export function rewriteOwnLog<T = unknown>(
  table: string,
  predicate: (record: T) => boolean,
): void {
  if (!env.VAULT_PATH) return;
  migrateLegacyLogs();
  const file = deviceLogPath(table);
  let raw: string;
  try {
    raw = fs.readFileSync(file, "utf8");
  } catch {
    return;
  }
  const kept: string[] = [];
  for (const line of raw.split("\n")) {
    if (!line) continue;
    try {
      const obj = JSON.parse(line) as T;
      if (predicate(obj)) kept.push(line);
    } catch {}
  }
  const tmp = `${file}.tmp-${process.pid}-${Date.now()}`;
  fs.writeFileSync(tmp, kept.length ? `${kept.join("\n")}\n` : "", "utf8");
  fs.renameSync(tmp, file);
}

export function getDeviceId(): string {
  return deviceId();
}
