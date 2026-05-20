import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { env } from "./config";

// Atomic vault write helpers + soft-delete trash.
//
// Why this exists: the agent owns destructive operations against the user's
// Obsidian vault — overwriting daily notes, deleting wiki pages, rewriting
// project frontmatter. A crash mid-`fs.writeFile` truncates the file, and
// `fs.unlink` is irreversible. These helpers wrap both operations behind a
// tmp-then-rename pattern (atomic on POSIX + NTFS) and copy prior contents to
// `<vault>/.daycmd/trash/` before any overwrite or delete so the user has a
// recovery window.
//
// Path-safety guarantee: callers must pass paths already validated through
// `safeJoin` from `vault-path.ts` (the audit's path-safety story is solid).
// We still defensively assert the destination is inside `VAULT_PATH` so a
// future caller that forgets `safeJoin` can't write outside the vault.

const TRASH_SUBDIR = path.join(".daycmd", "trash");

function trashRoot(): string {
  if (!env.VAULT_PATH) throw new Error("VAULT_PATH not configured");
  return path.join(env.VAULT_PATH, TRASH_SUBDIR);
}

function assertUnderVault(absPath: string): void {
  if (!env.VAULT_PATH) throw new Error("VAULT_PATH not configured");
  const root = path.resolve(env.VAULT_PATH);
  const full = path.resolve(absPath);
  const rel = path.relative(root, full);
  if (rel === ".." || rel.startsWith(".." + path.sep) || path.isAbsolute(rel)) {
    throw new Error(`vault-write: path escapes vault root: ${absPath}`);
  }
}

function trashName(absPath: string): string {
  // ISO timestamp with colons + dots swapped for dashes so it's portable to
  // case-insensitive filesystems and Windows. Format:
  // 2026-05-20T01-23-45-678Z--daily-2026-05-20.md
  const iso = new Date().toISOString().replace(/[:.]/g, "-");
  return `${iso}--${path.basename(absPath)}`;
}

/** Atomic write: write to tmp, fsync, rename over destination. */
export async function vaultWrite(
  absPath: string,
  contents: string | Buffer,
): Promise<void> {
  assertUnderVault(absPath);
  await fs.mkdir(path.dirname(absPath), { recursive: true });
  const tmp = `${absPath}.tmp-${crypto.randomUUID()}`;
  let handle: fs.FileHandle | null = null;
  try {
    handle = await fs.open(tmp, "w");
    await handle.writeFile(contents);
    // fsync before rename so the data is durable before the directory entry
    // flips. Without this a power-loss can leave the new name pointing at an
    // empty inode on some filesystems.
    await handle.sync();
    await handle.close();
    handle = null;
    await fs.rename(tmp, absPath);
  } catch (err) {
    if (handle) {
      try {
        await handle.close();
      } catch {
        // ignore close errors during cleanup
      }
    }
    // Best-effort tmp cleanup. If the tmp file doesn't exist (e.g. open
    // failed) the unlink is a no-op.
    try {
      await fs.unlink(tmp);
    } catch {
      // ignore — tmp may not exist
    }
    throw err;
  }
}

/**
 * Atomic append by read-modify-write under tmp-rename. Avoid for very large
 * files — this rewrites the whole file each call.
 */
export async function vaultAppend(
  absPath: string,
  contents: string,
): Promise<void> {
  assertUnderVault(absPath);
  let existing = "";
  try {
    existing = await fs.readFile(absPath, "utf8");
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== "ENOENT") throw err;
  }
  await vaultWrite(absPath, existing + contents);
}

/**
 * Destructive-write wrapper. Before overwriting an existing file (or
 * deleting), copy the current contents to
 * `<vault>/.daycmd/trash/<ISO>-<basename>`. Returns the trash path. For new
 * files (no prior contents), no trash is created and `null` is returned.
 */
export async function trashBeforeOverwrite(
  absPath: string,
): Promise<string | null> {
  assertUnderVault(absPath);
  let contents: Buffer;
  try {
    contents = await fs.readFile(absPath);
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw err;
  }
  const trashDir = trashRoot();
  await fs.mkdir(trashDir, { recursive: true });
  const dest = path.join(trashDir, trashName(absPath));
  // Use vaultWrite for the copy so the trash entry itself is durable.
  await vaultWrite(dest, contents);
  return dest;
}

/** Delete with trash copy. */
export async function vaultDelete(absPath: string): Promise<void> {
  assertUnderVault(absPath);
  await trashBeforeOverwrite(absPath);
  try {
    await fs.unlink(absPath);
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== "ENOENT") throw err;
  }
}

/**
 * TTL sweep of `<vault>/.daycmd/trash/` — remove items older than `maxAgeMs`.
 * Safe to call concurrently from multiple processes (tolerates races: a
 * concurrent unlink of the same file just yields ENOENT, which we swallow).
 */
export async function sweepTrash(
  maxAgeMs: number,
): Promise<{ removed: number }> {
  const dir = trashRoot();
  let entries: Array<{ name: string; isFile: boolean; isDirectory: boolean }>;
  try {
    const raw = await fs.readdir(dir, { withFileTypes: true });
    entries = raw.map((e) => ({
      name: e.name,
      isFile: e.isFile(),
      isDirectory: e.isDirectory(),
    }));
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return { removed: 0 };
    throw err;
  }
  const cutoff = Date.now() - maxAgeMs;
  let removed = 0;
  for (const entry of entries) {
    const p = path.join(dir, entry.name);
    let mtimeMs = 0;
    try {
      const st = await fs.stat(p);
      mtimeMs = st.mtimeMs;
    } catch {
      // Race: another process deleted it between readdir and stat. Skip.
      continue;
    }
    if (mtimeMs > cutoff) continue;
    try {
      if (entry.isDirectory) {
        await fs.rm(p, { recursive: true, force: true });
      } else {
        await fs.unlink(p);
      }
      removed++;
    } catch (err) {
      // ENOENT means a concurrent sweep already removed it — count nothing
      // and move on. Any other error is unexpected; rethrow.
      if ((err as NodeJS.ErrnoException).code !== "ENOENT") throw err;
    }
  }
  return { removed };
}
