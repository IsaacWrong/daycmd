"use client";

import { useSyncExternalStore } from "react";

let active = false;
const listeners = new Set<() => void>();

export function setAgentActive(next: boolean): void {
  if (active === next) return;
  active = next;
  for (const fn of listeners) fn();
}

function subscribe(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function getSnapshot(): boolean {
  return active;
}

function getServerSnapshot(): boolean {
  return false;
}

export function useAgentActive(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
