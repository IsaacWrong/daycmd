"use client";

import { useEffect, useRef, useState } from "react";
import { usePoll, useDebouncedCallback } from "@/lib/hooks";

type Daily = { path: string; content: string; exists: boolean; mtime: number };
type SaveStatus = "idle" | "saving" | "saved" | "error" | "conflict";

export function DailyNoteCard() {
  const { data, error, refresh } = usePoll<Daily>("/api/obsidian/daily");
  const [draft, setDraft] = useState<string | null>(null);
  const [status, setStatus] = useState<SaveStatus>("idle");
  const lastServer = useRef<string>("");
  const lastMtime = useRef<number>(0);
  const dirtyRef = useRef<boolean>(false);
  const [conflictContent, setConflictContent] = useState<string | null>(null);

  useEffect(() => {
    if (!data) return;
    if (draft === null) {
      lastServer.current = data.content;
      lastMtime.current = data.mtime;
      setDraft(data.content);
      return;
    }
    if (data.content === lastServer.current) return;
    if (!dirtyRef.current) {
      // No local edits pending — adopt external change.
      lastServer.current = data.content;
      lastMtime.current = data.mtime;
      setDraft(data.content);
    }
    // else: local edits pending, defer — conflict surfaces on next save.
  }, [data, draft]);

  const doSave = async (content: string) => {
    setStatus("saving");
    try {
      const res = await fetch("/api/obsidian/daily", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ content, mtime: lastMtime.current }),
      });
      if (res.status === 409) {
        const body = (await res.json()) as {
          current: { content: string; mtime: number };
        };
        setConflictContent(body.current.content);
        setStatus("conflict");
        return;
      }
      if (!res.ok) throw new Error(await res.text());
      const body = (await res.json()) as { mtime: number };
      lastServer.current = content;
      lastMtime.current = body.mtime;
      dirtyRef.current = false;
      setStatus("saved");
      setTimeout(
        () => setStatus((s) => (s === "saved" ? "idle" : s)),
        1500,
      );
      refresh();
    } catch {
      setStatus("error");
    }
  };

  const saveDebounced = useDebouncedCallback((c: string) => {
    void doSave(c);
  }, 600);

  const flush = () => {
    if (!dirtyRef.current || draft === null) return;
    void doSave(draft);
  };

  const onChange = (v: string) => {
    setDraft(v);
    dirtyRef.current = v !== lastServer.current;
    if (dirtyRef.current) saveDebounced(v);
  };

  const reloadFromConflict = () => {
    if (conflictContent === null) return;
    lastServer.current = conflictContent;
    setDraft(conflictContent);
    dirtyRef.current = false;
    setConflictContent(null);
    setStatus("idle");
    refresh();
  };

  const overwriteConflict = () => {
    if (draft === null) return;
    // Adopt server's mtime so PATCH passes the unchanged check, then save.
    lastMtime.current = data?.mtime ?? 0;
    setConflictContent(null);
    void doSave(draft);
  };

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

      {status === "conflict" && conflictContent !== null && (
        <div className="mb-3 rounded-md border border-amber-700/60 bg-amber-950/40 p-3 text-xs text-amber-200">
          <p className="mb-2">
            Note changed externally (agent or another writer). Your unsaved
            edits weren&apos;t written.
          </p>
          <div className="flex gap-2">
            <button
              onClick={reloadFromConflict}
              className="rounded bg-amber-700/60 px-2 py-1 hover:bg-amber-700"
            >
              Discard mine, load latest
            </button>
            <button
              onClick={overwriteConflict}
              className="rounded bg-red-800/60 px-2 py-1 hover:bg-red-800"
            >
              Overwrite with mine
            </button>
          </div>
        </div>
      )}

      <textarea
        value={draft ?? ""}
        onChange={(e) => onChange(e.target.value)}
        onBlur={flush}
        spellCheck={false}
        className="w-full h-[520px] bg-transparent text-sm text-zinc-200 font-mono resize-none focus:outline-none placeholder:text-zinc-600"
        placeholder={data === null ? "Loading…" : "Start writing…"}
      />
    </section>
  );
}
