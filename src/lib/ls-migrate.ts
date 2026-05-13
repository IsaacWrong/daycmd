/**
 * One-shot localStorage key migration. If `oldKey` exists and `newKey` does
 * not, copy the value and delete the old entry. Idempotent. Safe to call
 * on every component mount.
 */
export function migrateKey(oldKey: string, newKey: string): void {
  if (typeof window === "undefined") return;
  try {
    const oldVal = localStorage.getItem(oldKey);
    if (oldVal === null) return;
    const newVal = localStorage.getItem(newKey);
    if (newVal === null) {
      localStorage.setItem(newKey, oldVal);
    }
    localStorage.removeItem(oldKey);
  } catch {
    // never throw from migration
  }
}

/**
 * Migrate all entries whose key starts with `oldPrefix` to the same suffix
 * under `newPrefix`. Used when individual key names aren't known up front
 * (e.g. per-category agent threads).
 */
export function migratePrefix(oldPrefix: string, newPrefix: string): void {
  if (typeof window === "undefined") return;
  try {
    const moves: Array<[string, string]> = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith(oldPrefix)) {
        moves.push([k, newPrefix + k.slice(oldPrefix.length)]);
      }
    }
    for (const [from, to] of moves) {
      const val = localStorage.getItem(from);
      if (val === null) continue;
      if (localStorage.getItem(to) === null) {
        localStorage.setItem(to, val);
      }
      localStorage.removeItem(from);
    }
  } catch {}
}
