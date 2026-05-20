"use client";

import { useEffect, useRef, useSyncExternalStore } from "react";

const INVALIDATE_EVENT = "poll:invalidate";

export function mutate(url: string): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(INVALIDATE_EVENT, { detail: { url } }));
}

type CacheEntry<T = unknown> = {
  data: T | undefined;
  error: string | null;
  fetching: boolean;
  subs: Set<() => void>;
};

const cache = new Map<string, CacheEntry>();

function getEntry<T>(key: string): CacheEntry<T> {
  let e = cache.get(key) as CacheEntry<T> | undefined;
  if (!e) {
    e = { data: undefined, error: null, fetching: false, subs: new Set() };
    cache.set(key, e as CacheEntry);
  }
  return e;
}

function notify(entry: CacheEntry) {
  for (const cb of entry.subs) cb();
}

async function fetchInto<T>(key: string, url: string): Promise<void> {
  const entry = getEntry<T>(key);
  if (entry.fetching) return;
  entry.fetching = true;
  try {
    const res = await fetch(url, { cache: "no-store" });
    const json = await res.json();
    if (!res.ok) {
      entry.error = json.error ?? `HTTP ${res.status}`;
    } else {
      entry.data = json as T;
      entry.error = null;
    }
  } catch (e) {
    entry.error = (e as Error).message;
  } finally {
    entry.fetching = false;
    notify(entry);
  }
}

export function setCache<T>(key: string, data: T): void {
  const entry = getEntry<T>(key);
  entry.data = data;
  notify(entry);
}

export function getCache<T>(key: string): T | undefined {
  return getEntry<T>(key).data;
}

export async function mutateCache<T>(
  key: string,
  url: string,
  optimistic: (prev: T | undefined) => T,
  request: () => Promise<T | void>,
): Promise<void> {
  const entry = getEntry<T>(key);
  const prev = entry.data;
  entry.data = optimistic(prev);
  notify(entry);
  try {
    const next = await request();
    if (next !== undefined) {
      entry.data = next as T;
      notify(entry);
    } else {
      void fetchInto<T>(key, url);
    }
  } catch (e) {
    entry.data = prev;
    entry.error = (e as Error).message;
    notify(entry);
    throw e;
  }
}

export function useResource<T>(
  key: string,
  url: string,
): { data: T | undefined; error: string | null; refresh: () => void } {
  const subscribe = (cb: () => void) => {
    const entry = getEntry<T>(key);
    entry.subs.add(cb);
    return () => {
      entry.subs.delete(cb);
    };
  };
  const snapshot = () => getEntry<T>(key).data;
  const errorSnapshot = () => getEntry<T>(key).error;
  const data = useSyncExternalStore(subscribe, snapshot, () => undefined);
  const error = useSyncExternalStore(subscribe, errorSnapshot, () => null);

  useEffect(() => {
    if (getEntry<T>(key).data === undefined) void fetchInto<T>(key, url);
    function onInvalidate(e: Event) {
      const detail = (e as CustomEvent<{ url: string }>).detail;
      if (detail?.url === key || detail?.url === url) void fetchInto<T>(key, url);
    }
    window.addEventListener(INVALIDATE_EVENT, onInvalidate);
    return () => {
      window.removeEventListener(INVALIDATE_EVENT, onInvalidate);
    };
  }, [key, url]);

  return { data, error, refresh: () => void fetchInto<T>(key, url) };
}

export function usePoll<T>(
  url: string,
  intervalMs = 30_000,
): { data: T | null; error: string | null; refresh: () => void } {
  const subscribe = (cb: () => void) => {
    const entry = getEntry<T>(url);
    entry.subs.add(cb);
    return () => {
      entry.subs.delete(cb);
    };
  };
  const snapshot = () =>
    (getEntry<T>(url).data as T | undefined) ?? null;
  const errorSnapshot = () => getEntry<T>(url).error;
  const data = useSyncExternalStore<T | null>(subscribe, snapshot, () => null);
  const error = useSyncExternalStore<string | null>(
    subscribe,
    errorSnapshot,
    () => null,
  );

  useEffect(() => {
    let id: ReturnType<typeof setInterval> | null = null;
    const isVisible = () =>
      typeof document === "undefined" ||
      document.visibilityState === "visible";

    function startInterval() {
      if (id !== null) return;
      id = setInterval(() => void fetchInto<T>(url, url), intervalMs);
    }
    function stopInterval() {
      if (id === null) return;
      clearInterval(id);
      id = null;
    }

    void fetchInto<T>(url, url);
    if (isVisible()) startInterval();

    function onInvalidate(e: Event) {
      const detail = (e as CustomEvent<{ url: string }>).detail;
      if (detail?.url === url) void fetchInto<T>(url, url);
    }
    function onVisibilityChange() {
      if (isVisible()) {
        void fetchInto<T>(url, url);
        startInterval();
      } else {
        stopInterval();
      }
    }
    window.addEventListener(INVALIDATE_EVENT, onInvalidate);
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      stopInterval();
      window.removeEventListener(INVALIDATE_EVENT, onInvalidate);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [url, intervalMs]);

  return { data, error, refresh: () => void fetchInto<T>(url, url) };
}

export function useDebouncedCallback<T extends (...a: never[]) => void>(
  fn: T,
  delay: number,
): T {
  const ref = useRef<ReturnType<typeof setTimeout> | null>(null);
  return ((...args: Parameters<T>) => {
    if (ref.current) clearTimeout(ref.current);
    ref.current = setTimeout(() => fn(...args), delay);
  }) as T;
}
