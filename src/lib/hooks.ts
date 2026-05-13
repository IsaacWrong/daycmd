"use client";

import { useEffect, useRef, useState } from "react";

const INVALIDATE_EVENT = "poll:invalidate";

export function mutate(url: string): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(INVALIDATE_EVENT, { detail: { url } }));
}

export function usePoll<T>(
  url: string,
  intervalMs = 30_000,
): { data: T | null; error: string | null; refresh: () => void } {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const tick = useRef(0);

  const fetcher = async () => {
    const seq = ++tick.current;
    try {
      const res = await fetch(url, { cache: "no-store" });
      const json = await res.json();
      if (seq !== tick.current) return;
      if (!res.ok) {
        setError(json.error ?? `HTTP ${res.status}`);
      } else {
        setData(json as T);
        setError(null);
      }
    } catch (e) {
      setError((e as Error).message);
    }
  };

  useEffect(() => {
    fetcher();
    const id = setInterval(fetcher, intervalMs);
    function onInvalidate(e: Event) {
      const detail = (e as CustomEvent<{ url: string }>).detail;
      if (detail?.url === url) fetcher();
    }
    window.addEventListener(INVALIDATE_EVENT, onInvalidate);
    return () => {
      clearInterval(id);
      window.removeEventListener(INVALIDATE_EVENT, onInvalidate);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url, intervalMs]);

  return { data, error, refresh: fetcher };
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
