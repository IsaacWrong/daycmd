"use client";

import { useEffect, useRef, useState } from "react";
import type { SkillDef } from "@/lib/skills-defs";
import { migrateKey, migratePrefix } from "@/lib/ls-migrate";
import {
  fetchState,
  putState,
  putStateDebounced,
  deleteRemoteState,
} from "@/lib/vault-state-client";

export const CATEGORY_LS_KEY = "daycmd.agent.category";
export const RUN_SKILL_EVENT = "daycmd:run-skill";

export type Attachment =
  | { kind: "image"; mediaType: string; data: string; name: string }
  | { kind: "document"; mediaType: string; data: string; name: string }
  | { kind: "text"; data: string; name: string };

export type Msg = {
  role: "user" | "assistant";
  content: string;
  tools?: Array<{ name: string; ok?: boolean }>;
  attachments?: Attachment[];
};

const MESSAGES_LS_KEY = (cat: string) => `daycmd.agent.messages.${cat}`;
const CONTAINER_LS_KEY = (cat: string) => `daycmd.agent.container.${cat}`;

const CATEGORY_STATE_KEY = "agent/category";
const messagesStateKey = (cat: string) => `agent/messages/${cat}`;
const containerStateKey = (cat: string) => `agent/container/${cat}`;

let _agentMigrationRun = false;
function migrateLegacyKeys(): void {
  if (_agentMigrationRun) return;
  _agentMigrationRun = true;
  migrateKey("ai-os.agent.category", CATEGORY_LS_KEY);
  migratePrefix("ai-os.agent.messages.", "daycmd.agent.messages.");
  migratePrefix("ai-os.agent.container.", "daycmd.agent.container.");
}

// One-shot push of any localStorage values into the vault, then clear LS so
// the vault becomes the single source of truth across devices.
async function pushLocalStorageToVault(categories: string[]): Promise<void> {
  if (typeof window === "undefined") return;
  const cat = localStorage.getItem(CATEGORY_LS_KEY);
  if (cat) {
    const remote = await fetchState<string>(CATEGORY_STATE_KEY);
    if (!remote) await putState(CATEGORY_STATE_KEY, cat);
    localStorage.removeItem(CATEGORY_LS_KEY);
  }
  for (const c of categories) {
    const mRaw = localStorage.getItem(MESSAGES_LS_KEY(c));
    if (mRaw) {
      try {
        const parsed = JSON.parse(mRaw) as Msg[];
        const remote = await fetchState<Msg[]>(messagesStateKey(c));
        if (!remote || remote.length === 0) await putState(messagesStateKey(c), parsed);
      } catch {}
      localStorage.removeItem(MESSAGES_LS_KEY(c));
    }
    const cRaw = localStorage.getItem(CONTAINER_LS_KEY(c));
    if (cRaw) {
      const remote = await fetchState<string>(containerStateKey(c));
      if (!remote) await putState(containerStateKey(c), cRaw);
      localStorage.removeItem(CONTAINER_LS_KEY(c));
    }
  }
}

export function useAgent(initialCategory?: string) {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [categories, setCategories] = useState<string[]>([initialCategory ?? "Personal"]);
  const [category, setCategoryState] = useState(initialCategory ?? "Personal");
  const [hydrated, setHydrated] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const messagesCache = useRef<Map<string, Msg[]>>(new Map());
  const containerCache = useRef<Map<string, string | null>>(new Map());

  useEffect(() => {
    migrateLegacyKeys();
    let cancelled = false;
    (async () => {
      let names: string[] = [];
      try {
        const res = await fetch("/api/kb");
        const j = (await res.json()) as { categories: Array<{ name: string }> };
        names = (j.categories ?? []).map((c) => c.name);
      } catch {}
      if (cancelled) return;
      if (names.length) setCategories(names);

      await pushLocalStorageToVault(names.length ? names : [initialCategory ?? "Personal"]);

      const saved = await fetchState<string>(CATEGORY_STATE_KEY);
      const useCat = initialCategory
        ? initialCategory
        : saved && names.includes(saved)
          ? saved
          : "Personal";
      const initialMessages =
        (await fetchState<Msg[]>(messagesStateKey(useCat))) ?? [];
      const initialContainer =
        (await fetchState<string>(containerStateKey(useCat))) ?? null;
      if (cancelled) return;
      messagesCache.current.set(useCat, initialMessages);
      containerCache.current.set(useCat, initialContainer);
      setCategoryState(useCat);
      setMessages(initialMessages);
      setHydrated(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [initialCategory]);

  async function loadMessagesFor(cat: string): Promise<Msg[]> {
    const cached = messagesCache.current.get(cat);
    if (cached) return cached;
    const remote = (await fetchState<Msg[]>(messagesStateKey(cat))) ?? [];
    messagesCache.current.set(cat, remote);
    return remote;
  }

  async function loadContainerFor(cat: string): Promise<string | null> {
    if (containerCache.current.has(cat)) {
      return containerCache.current.get(cat) ?? null;
    }
    const remote = (await fetchState<string>(containerStateKey(cat))) ?? null;
    containerCache.current.set(cat, remote);
    return remote;
  }

  function setCategory(c: string) {
    if (c === category) return;
    setCategoryState(c);
    void putState(CATEGORY_STATE_KEY, c);
    const cached = messagesCache.current.get(c);
    if (cached) {
      setMessages(cached);
    } else {
      setMessages([]);
      void loadMessagesFor(c).then((m) => setMessages(m));
    }
  }

  useEffect(() => {
    if (!hydrated) return;
    messagesCache.current.set(category, messages);
    if (messages.length === 0) {
      void deleteRemoteState(messagesStateKey(category));
    } else {
      putStateDebounced(messagesStateKey(category), messages);
    }
  }, [messages, category, hydrated]);

  async function send(content: string, opts: { attachments?: Attachment[]; skill?: SkillDef } = {}) {
    const attachments = opts.attachments ?? [];
    if (!content.trim() && attachments.length === 0) return;
    if (busy) return;
    setError(null);
    const useCategory = opts.skill?.category ?? category;
    const existing =
      useCategory === category ? messages : await loadMessagesFor(useCategory);
    const userMsg: Msg = { role: "user", content };
    if (attachments.length) userMsg.attachments = attachments;
    const next: Msg[] = [
      ...existing,
      userMsg,
      { role: "assistant", content: "", tools: [] },
    ];
    messagesCache.current.set(useCategory, next);
    putStateDebounced(messagesStateKey(useCategory), next);
    if (useCategory !== category) setCategoryState(useCategory);
    setMessages(next);
    setBusy(true);

    const apiMessages = next.slice(0, -1).map((m) => ({
      role: m.role,
      content: m.content,
      ...(m.attachments ? { attachments: m.attachments } : {}),
    }));
    const containerId = await loadContainerFor(useCategory);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const res = await fetch("/api/agent", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          messages: apiMessages,
          category: useCategory,
          ...(containerId ? { containerId } : {}),
          ...(opts.skill?.model ? { model: opts.skill.model } : {}),
          ...(opts.skill?.effort ? { effort: opts.skill.effort } : {}),
          ...(opts.skill?.maxTokens ? { maxTokens: opts.skill.maxTokens } : {}),
        }),
        signal: controller.signal,
      });
      if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`);

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const lines = buf.split("\n\n");
        buf = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const ev = JSON.parse(line.slice(6)) as { type: string; data: unknown };
          if (ev.type === "text") {
            const delta = ev.data as string;
            setMessages((prev) => {
              if (prev.length === 0) return prev;
              const copy = [...prev];
              const last = copy[copy.length - 1];
              if (!last) return prev;
              copy[copy.length - 1] = { ...last, content: last.content + delta };
              return copy;
            });
          } else if (ev.type === "tool_start") {
            const d = ev.data as { name: string };
            setMessages((prev) => {
              if (prev.length === 0) return prev;
              const copy = [...prev];
              const last = copy[copy.length - 1];
              if (!last) return prev;
              copy[copy.length - 1] = {
                ...last,
                tools: [...(last.tools ?? []), { name: d.name }],
              };
              return copy;
            });
          } else if (ev.type === "tool_result") {
            const d = ev.data as { name: string; ok: boolean };
            setMessages((prev) => {
              if (prev.length === 0) return prev;
              const copy = [...prev];
              const last = copy[copy.length - 1];
              if (!last) return prev;
              const tools = [...(last.tools ?? [])];
              const idx = tools.findIndex((t) => t.name === d.name && t.ok === undefined);
              if (idx >= 0) tools[idx] = { ...tools[idx], ok: d.ok };
              copy[copy.length - 1] = { ...last, tools };
              return copy;
            });
          } else if (ev.type === "container") {
            const id = String(ev.data);
            containerCache.current.set(useCategory, id);
            void putState(containerStateKey(useCategory), id);
          } else if (ev.type === "error") {
            setError(String(ev.data));
          }
        }
      }
    } catch (e) {
      if ((e as Error).name === "AbortError") {
        setMessages((prev) => {
          if (prev.length === 0) return prev;
          const copy = [...prev];
          const last = copy[copy.length - 1];
          if (!last || last.role !== "assistant") return prev;
          copy[copy.length - 1] = {
            ...last,
            content: last.content + (last.content ? "\n\n_[stopped]_" : "_[stopped]_"),
          };
          return copy;
        });
      } else {
        setError((e as Error).message);
      }
    } finally {
      abortRef.current = null;
      setBusy(false);
    }
  }

  function stop() {
    abortRef.current?.abort();
  }

  function clear() {
    setMessages([]);
    containerCache.current.set(category, null);
    void deleteRemoteState(containerStateKey(category));
  }

  return { messages, busy, error, categories, category, setCategory, send, stop, clear, hydrated };
}
