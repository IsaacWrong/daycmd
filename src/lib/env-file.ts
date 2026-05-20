import fs from "node:fs/promises";
import path from "node:path";

function envPath(): string {
  return path.join(process.cwd(), ".env.local");
}

export type EnvKey =
  | "VAULT_PATH"
  | "ANTHROPIC_API_KEY"
  | "GITHUB_TOKEN"
  | "GOOGLE_CLIENT_ID"
  | "GOOGLE_CLIENT_SECRET"
  | "GOOGLE_REDIRECT_URI";

export const SECRET_KEYS: ReadonlySet<EnvKey> = new Set([
  "ANTHROPIC_API_KEY",
  "GITHUB_TOKEN",
  "GOOGLE_CLIENT_SECRET",
]);

async function readEnvFile(): Promise<string> {
  try {
    return await fs.readFile(envPath(), "utf8");
  } catch {
    return "";
  }
}

function quoteIfNeeded(value: string): string {
  // Quote values that contain whitespace, `#`, or quotes themselves.
  if (/[\s#'"]/.test(value)) {
    return `"${value.replace(/"/g, '\\"')}"`;
  }
  return value;
}

/**
 * Merge updates into .env.local. Keys present in `updates` replace existing
 * lines (preserving order); new keys are appended. Empty-string values *clear*
 * the line. Atomic write via temp file + rename.
 *
 * Throws if any value contains \r, \n, or \0 — these would allow an attacker
 * to inject additional env lines (e.g. overwriting GOOGLE_REDIRECT_URI).
 */
export async function updateEnvFile(
  updates: Partial<Record<EnvKey, string>>,
): Promise<void> {
  for (const [key, value] of Object.entries(updates)) {
    if (value === undefined) continue;
    if (/[\r\n\0]/.test(value)) {
      throw new Error(
        `value for ${key} must not contain newline or NUL characters`,
      );
    }
  }
  const existing = await readEnvFile();
  const lines = existing.split(/\r?\n/);
  const seen = new Set<string>();
  const next: string[] = [];

  for (const line of lines) {
    const m = line.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*=/);
    if (!m) {
      next.push(line);
      continue;
    }
    const key = m[1] as EnvKey;
    if (key in updates) {
      seen.add(key);
      const value = updates[key];
      if (value !== undefined && value !== "") {
        next.push(`${key}=${quoteIfNeeded(value)}`);
      }
      // empty value → drop the line
    } else {
      next.push(line);
    }
  }

  for (const [key, value] of Object.entries(updates)) {
    if (seen.has(key) || value === undefined || value === "") continue;
    next.push(`${key}=${quoteIfNeeded(value)}`);
  }

  // Trim trailing blank lines and ensure final newline.
  while (next.length && next[next.length - 1].trim() === "") next.pop();
  const body = next.join("\n") + "\n";

  const target = envPath();
  const tmp = `${target}.tmp.${process.pid}`;
  await fs.writeFile(tmp, body, "utf8");
  await fs.rename(tmp, target);
}

export type VaultPathCheck = { ok: boolean; reason?: string };

export async function validateVaultPath(p: string): Promise<VaultPathCheck> {
  const trimmed = p.trim();
  if (!trimmed) return { ok: false, reason: "path is empty" };
  if (!path.isAbsolute(trimmed)) {
    return { ok: false, reason: "path must be absolute" };
  }
  let stat;
  try {
    stat = await fs.stat(trimmed);
  } catch {
    return { ok: false, reason: "directory not found on disk" };
  }
  if (!stat.isDirectory()) {
    return { ok: false, reason: "path exists but is not a directory" };
  }
  try {
    const obsidianStat = await fs.stat(path.join(trimmed, ".obsidian"));
    if (obsidianStat.isDirectory()) return { ok: true };
  } catch {
    // fall through to looser check
  }
  const markers = ["Tasks", "Daily", "Projects"];
  for (const marker of markers) {
    try {
      const s = await fs.stat(path.join(trimmed, marker));
      if (s.isDirectory()) return { ok: true };
    } catch {
      // keep looking
    }
  }
  return {
    ok: false,
    reason:
      "directory has no .obsidian/, Tasks/, Daily/, or Projects/ — doesn't look like your vault",
  };
}

export type EnvStatus = {
  vaultPath: { present: boolean; valid: boolean; reason?: string };
  anthropicKey: { present: boolean };
  githubToken: { present: boolean };
  googleClient: { present: boolean };
  // True when the *running* process saw both required vars at boot.
  ready: boolean;
};

export async function getEnvStatus(): Promise<EnvStatus> {
  const vp = (process.env.VAULT_PATH ?? "").trim();
  let valid = false;
  let reason: string | undefined;
  if (vp) {
    try {
      const stat = await fs.stat(vp);
      if (!stat.isDirectory()) {
        reason = "path exists but is not a directory";
      } else {
        valid = true;
      }
    } catch {
      reason = "directory not found on disk";
    }
  }
  const anth = !!(process.env.ANTHROPIC_API_KEY ?? "").trim();
  const gh = !!(process.env.GITHUB_TOKEN ?? "").trim();
  const goog = !!(
    process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
  );
  return {
    vaultPath: { present: !!vp, valid, reason },
    anthropicKey: { present: anth },
    githubToken: { present: gh },
    googleClient: { present: goog },
    ready: !!vp && valid && anth,
  };
}
