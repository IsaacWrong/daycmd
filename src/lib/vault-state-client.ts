"use client";

import { apiFetch } from "@/lib/fetch-client";

const inflight = new Map<string, Promise<unknown>>();

export async function fetchState<T = unknown>(key: string): Promise<T | null> {
  const existing = inflight.get(key);
  if (existing) return existing as Promise<T | null>;
  const p = (async () => {
    try {
      const res = await fetch(`/api/state/${key}`, { cache: "no-store" });
      if (!res.ok) return null;
      const j = (await res.json()) as { value: T | null };
      return j.value ?? null;
    } catch {
      return null;
    } finally {
      inflight.delete(key);
    }
  })();
  inflight.set(key, p);
  return p;
}

export async function putState(key: string, value: unknown): Promise<boolean> {
  try {
    const res = await apiFetch(`/api/state/${key}`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(value),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export async function deleteRemoteState(key: string): Promise<boolean> {
  try {
    const res = await apiFetch(`/api/state/${key}`, { method: "DELETE" });
    return res.ok;
  } catch {
    return false;
  }
}

const writeTimers = new Map<string, ReturnType<typeof setTimeout>>();
const pendingValues = new Map<string, unknown>();

// Debounced PUT — last value wins per key. Useful for typing-heavy state like
// chat messages where every render would otherwise hit the disk.
export function putStateDebounced(key: string, value: unknown, ms = 400): void {
  pendingValues.set(key, value);
  const existing = writeTimers.get(key);
  if (existing) clearTimeout(existing);
  const t = setTimeout(() => {
    const v = pendingValues.get(key);
    pendingValues.delete(key);
    writeTimers.delete(key);
    void putState(key, v);
  }, ms);
  writeTimers.set(key, t);
}

export function flushStateWrites(): void {
  for (const [key, t] of writeTimers) {
    clearTimeout(t);
    const v = pendingValues.get(key);
    pendingValues.delete(key);
    writeTimers.delete(key);
    void putState(key, v);
  }
}
