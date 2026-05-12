"use client";

import { useEffect, useRef, useState } from "react";

type ProjectOpt = { name: string };

export function IdeaModal() {
  const [open, setOpen] = useState(false);
  const [projects, setProjects] = useState<ProjectOpt[]>([]);
  const [target, setTarget] = useState<string>("__unfiled__");
  const [text, setText] = useState("");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const meta = e.metaKey || e.ctrlKey;
      if (meta && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen(true);
      }
      if (e.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (!open) return;
    setErr(null);
    setText("");
    inputRef.current?.focus();
    (async () => {
      try {
        const res = await fetch("/api/projects");
        const json = await res.json();
        if (Array.isArray(json.projects)) {
          setProjects(json.projects.map((p: { name: string }) => ({ name: p.name })));
          const last = localStorage.getItem("idea:lastTarget");
          if (last) setTarget(last);
        }
      } catch {}
    })();
  }, [open]);

  async function submit() {
    const trimmed = text.trim();
    if (!trimmed) return;
    setSaving(true);
    setErr(null);
    try {
      const url =
        target === "__unfiled__"
          ? "/api/ideas/unfiled"
          : `/api/projects/${encodeURIComponent(target)}/idea`;
      const res = await fetch(url, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ text: trimmed }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error ?? `HTTP ${res.status}`);
      }
      localStorage.setItem("idea:lastTarget", target);
      setOpen(false);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-[20vh] bg-black/60 backdrop-blur-sm"
      onClick={() => setOpen(false)}
    >
      <div
        className="w-full max-w-xl bg-zinc-900 border border-zinc-700 rounded-xl p-4 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm text-zinc-300 uppercase tracking-wider">Capture idea</h2>
          <span className="text-xs text-zinc-500">⌘↵ to save · esc to close</span>
        </div>

        <select
          value={target}
          onChange={(e) => setTarget(e.target.value)}
          className="w-full mb-2 bg-zinc-800 text-zinc-100 border border-zinc-700 rounded px-2 py-1 text-sm outline-none"
        >
          <option value="__unfiled__">Inbox (unfiled)</option>
          {projects.map((p) => (
            <option key={p.name} value={p.name}>
              {p.name}
            </option>
          ))}
        </select>

        <textarea
          ref={inputRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
              e.preventDefault();
              submit();
            }
          }}
          placeholder="What's the idea?"
          rows={4}
          className="w-full bg-zinc-800 text-zinc-100 border border-zinc-700 rounded px-2 py-1.5 text-sm outline-none resize-none"
        />

        {err && <p className="text-xs text-red-400 mt-2">{err}</p>}

        <div className="flex justify-end gap-2 mt-3">
          <button
            onClick={() => setOpen(false)}
            className="text-xs px-2 py-1 rounded bg-zinc-800 text-zinc-300 border border-zinc-700"
          >
            Cancel
          </button>
          <button
            onClick={submit}
            disabled={saving || !text.trim()}
            className="text-xs px-3 py-1 rounded bg-emerald-700 text-emerald-50 border border-emerald-600 disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}
