"use client";

import { useCallback, useEffect, useState } from "react";
import { mutate } from "./hooks";

const STORAGE_KEY = "daycmd:activeTimer";
const CHANGE_EVENT = "daycmd:timer-change";

export type TimerState = {
  project: string;
  startedAt: number | null;
  accumulatedMs: number;
};

function read(): TimerState | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as TimerState;
    if (typeof parsed.project !== "string") return null;
    return parsed;
  } catch {
    return null;
  }
}

function write(state: TimerState | null) {
  if (typeof window === "undefined") return;
  if (state == null) {
    localStorage.removeItem(STORAGE_KEY);
  } else {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }
  window.dispatchEvent(new CustomEvent(CHANGE_EVENT));
}

export function elapsedMs(state: TimerState, now: number = Date.now()): number {
  return state.startedAt != null
    ? state.accumulatedMs + (now - state.startedAt)
    : state.accumulatedMs;
}

export function isRunning(state: TimerState | null): boolean {
  return state != null && state.startedAt != null;
}

export function useActiveTimer() {
  const [state, setState] = useState<TimerState | null>(null);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setState(read());
    setHydrated(true);
    function onChange() {
      setState(read());
    }
    function onStorage(e: StorageEvent) {
      if (e.key === STORAGE_KEY) setState(read());
    }
    window.addEventListener(CHANGE_EVENT, onChange);
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener(CHANGE_EVENT, onChange);
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  const start = useCallback((project: string) => {
    write({ project, startedAt: Date.now(), accumulatedMs: 0 });
  }, []);

  const pause = useCallback(() => {
    const current = read();
    if (!current || current.startedAt == null) return;
    write({
      project: current.project,
      startedAt: null,
      accumulatedMs: current.accumulatedMs + (Date.now() - current.startedAt),
    });
  }, []);

  const resume = useCallback(() => {
    const current = read();
    if (!current || current.startedAt != null) return;
    write({ ...current, startedAt: Date.now() });
  }, []);

  const discard = useCallback(() => {
    write(null);
  }, []);

  const stop = useCallback(async (
    note?: string,
  ): Promise<{ minutes: number } | { error: string }> => {
    const current = read();
    if (!current) return { error: "no active timer" };
    const totalMs = elapsedMs(current);
    if (totalMs < 60_000) {
      write(null);
      return { minutes: 0 };
    }
    const end = Date.now();
    const start = end - totalMs;
    try {
      const res = await fetch(
        `/api/projects/${encodeURIComponent(current.project)}/time`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            start: new Date(start).toISOString(),
            end: new Date(end).toISOString(),
            ...(note?.trim() ? { note: note.trim() } : {}),
          }),
        },
      );
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        return { error: j?.error ?? `Failed (${res.status})` };
      }
      const j = (await res.json()) as { entry?: { minutes: number } };
      write(null);
      const encoded = encodeURIComponent(current.project);
      mutate(`/api/projects/${encoded}`);
      mutate(`/api/projects/${encoded}/activity`);
      mutate(`/api/projects`);
      mutate(`/api/projects/overview`);
      return { minutes: j.entry?.minutes ?? Math.round(totalMs / 60_000) };
    } catch (err) {
      return { error: (err as Error).message };
    }
  }, []);

  return { state, hydrated, start, pause, resume, stop, discard };
}

export function formatElapsed(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (n: number) => n.toString().padStart(2, "0");
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
}
