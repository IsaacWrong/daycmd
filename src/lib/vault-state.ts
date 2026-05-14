import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import { env } from "./config";

const STATE_SUBDIR = path.join(".obsidian", "daycmd");

function stateRoot(): string {
  if (!env.VAULT_PATH) throw new Error("VAULT_PATH not configured");
  return path.join(env.VAULT_PATH, STATE_SUBDIR);
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
