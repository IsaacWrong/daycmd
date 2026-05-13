"use client";

import { useEffect, useRef, useState } from "react";
import type { SkillDef } from "@/lib/skills-defs";
import { migrateKey, migratePrefix } from "@/lib/ls-migrate";

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

let _agentMigrationRun = false;
function migrateAgentKeys(): void {
  if (_agentMigrationRun) return;
  _agentMigrationRun = true;
  migrateKey("ai-os.agent.category", CATEGORY_LS_KEY);
  migratePrefix("ai-os.agent.messages.", "daycmd.agent.messages.");
  migratePrefix("ai-os.agent.container.", "daycmd.agent.container.");
}

function loadMessages(cat: string): Msg[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(MESSAGES_LS_KEY(cat));
    return raw ? (JSON.parse(raw) as Msg[]) : [];
  } catch {
    return [];
  }
}

function saveMessages(cat: string, msgs: Msg[]): void {
  if (typeof window === "undefined") return;
  if (msgs.length === 0) {
    localStorage.removeItem(MESSAGES_LS_KEY(cat));
    return;
  }
  try {
    localStorage.setItem(MESSAGES_LS_KEY(cat), JSON.stringify(msgs));
  } catch {
    const stripped = msgs.map((m) =>
      m.attachments
        ? {
            ...m,
            attachments: m.attachments.map((a) => ({ ...a, data: "" })),
          }
        : m,
    );
    try {
      localStorage.setItem(MESSAGES_LS_KEY(cat), JSON.stringify(stripped));
    } catch {}
  }
}

function loadContainer(cat: string): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(CONTAINER_LS_KEY(cat));
}

function saveContainer(cat: string, id: string | null): void {
  if (typeof window === "undefined") return;
  if (id) localStorage.setItem(CONTAINER_LS_KEY(cat), id);
  else localStorage.removeItem(CONTAINER_LS_KEY(cat));
}

export function useAgent(initialCategory?: string) {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [categories, setCategories] = useState<string[]>([initialCategory ?? "Personal"]);
  const [category, setCategoryState] = useState(initialCategory ?? "Personal");
  const [hydrated, setHydrated] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    migrateAgentKeys();
    let cancelled = false;
    fetch("/api/kb")
      .then((r) => r.json())
      .then((j: { categories: Array<{ name: string }> }) => {
        if (cancelled) return;
        const names = (j.categories ?? []).map((c) => c.name);
        if (names.length) setCategories(names);
        const saved =
          typeof window !== "undefined"
            ? localStorage.getItem(CATEGORY_LS_KEY)
            : null;
        const useCat = initialCategory
          ? initialCategory
          : saved && names.includes(saved)
            ? saved
            : "Personal";
        setCategoryState(useCat);
        setMessages(loadMessages(useCat));
        setHydrated(true);
      })
      .catch(() => {
        if (!cancelled) setHydrated(true);
      });
    return () => {
      cancelled = true;
    };
  }, [initialCategory]);

  function setCategory(c: string) {
    if (c === category) return;
    setCategoryState(c);
    setMessages(loadMessages(c));
    if (typeof window !== "undefined") localStorage.setItem(CATEGORY_LS_KEY, c);
  }

  useEffect(() => {
    if (!hydrated) return;
    saveMessages(category, messages);
  }, [messages, category, hydrated]);

  async function send(content: string, opts: { attachments?: Attachment[]; skill?: SkillDef } = {}) {
    const attachments = opts.attachments ?? [];
    if (!content.trim() && attachments.length === 0) return;
    if (busy) return;
    setError(null);
    const useCategory = opts.skill?.category ?? category;
    const existing = useCategory === category ? messages : loadMessages(useCategory);
    const userMsg: Msg = { role: "user", content };
    if (attachments.length) userMsg.attachments = attachments;
    const next: Msg[] = [
      ...existing,
      userMsg,
      { role: "assistant", content: "", tools: [] },
    ];
    saveMessages(useCategory, next);
    if (useCategory !== category) setCategoryState(useCategory);
    setMessages(next);
    setBusy(true);

    const apiMessages = next.slice(0, -1).map((m) => ({
      role: m.role,
      content: m.content,
      ...(m.attachments ? { attachments: m.attachments } : {}),
    }));
    const containerId = loadContainer(useCategory);

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
            saveContainer(useCategory, String(ev.data));
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
    saveContainer(category, null);
  }

  return { messages, busy, error, categories, category, setCategory, send, stop, clear, hydrated };
}
