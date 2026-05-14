import path from "node:path";
import { env } from "./config";

export class VaultPathError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "VaultPathError";
  }
}

// Resolve `segments` relative to `root` and assert the joined path stays
// inside `root`. Use whenever model- or user-supplied strings are joined onto
// a trusted root (vault, KB category, Tasks dir).
export function safeJoin(root: string, ...segments: string[]): string {
  const absRoot = path.resolve(root);
  for (const s of segments) {
    if (typeof s !== "string") {
      throw new VaultPathError("path segment must be a string");
    }
    if (path.isAbsolute(s)) {
      throw new VaultPathError(`absolute path segment not allowed: ${s}`);
    }
    if (s.includes("\0")) {
      throw new VaultPathError("path segment contains null byte");
    }
  }
  const full = path.resolve(absRoot, ...segments);
  const rel = path.relative(absRoot, full);
  if (rel === ".." || rel.startsWith(".." + path.sep) || path.isAbsolute(rel)) {
    throw new VaultPathError(
      `path escapes root: ${segments.join("/")}`,
    );
  }
  return full;
}

export function safeVaultJoin(...segments: string[]): string {
  return safeJoin(env.VAULT_PATH, ...segments);
}
