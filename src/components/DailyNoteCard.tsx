"use client";

import { useEffect, useRef, useState } from "react";
import { usePoll, useDebouncedCallback } from "@/lib/hooks";

type Daily = { path: string; content: string; exists: boolean };

export function DailyNoteCard() {
  const { data, error, refresh } = usePoll<Daily>("/api/obsidian/daily");
  const [draft, setDraft] = useState<string | null>(null);
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">(
    "idle",
  );
  const lastServer = useRef<string>("");

  useEffect(() => {
    if (!data) return;
    if (data.content !== lastServer.current && draft === null) {
      lastServer.current = data.content;
      setDraft(data.content);
    } else if (data.content !== lastServer.current && draft === data.content) {
      lastServer.current = data.content;
    }
  }, [data, draft]);

  const save = useDebouncedCallback(async (content: string) => {
    setStatus("saving");
    try {
      const res = await fetch("/api/obsidian/daily", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ content }),
      });
      if (!res.ok) throw new Error(await res.text());
      lastServer.current = content;
      setStatus("saved");
      setTimeout(() => setStatus("idle"), 1500);
      refresh();
    } catch {
      setStatus("error");
    }
  }, 600);

  return (
    <section className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-5 min-h-[240px] lg:col-span-2 lg:row-span-2">
      <header className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-medium uppercase tracking-wider text-zinc-400">
          Daily Note
        </h2>
        <span className="text-xs text-zinc-500">
          {status === "saving" && "Saving…"}
          {status === "saved" && "Saved"}
          {status === "error" && "Save failed"}
          {status === "idle" && data?.exists === false && "New file"}
        </span>
      </header>

      {error && <p className="text-sm text-red-400 mb-2">{error}</p>}

      <textarea
        value={draft ?? ""}
        onChange={(e) => {
          setDraft(e.target.value);
          save(e.target.value);
        }}
        spellCheck={false}
        className="w-full h-[520px] bg-transparent text-sm text-zinc-200 font-mono resize-none focus:outline-none placeholder:text-zinc-600"
        placeholder={data === null ? "Loading…" : "Start writing…"}
      />
    </section>
  );
}
