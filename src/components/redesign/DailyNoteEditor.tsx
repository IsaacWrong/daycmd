"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { format } from "date-fns";

type DailyResp = { path: string; content: string; exists: boolean; mtime: number };

type Saved = "idle" | "saving" | "saved" | "error" | "conflict";

const SAVE_DEBOUNCE_MS = 800;

export function DailyNoteEditor({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const [content, setContent] = useState("");
  const [path, setPath] = useState("");
  const [mtime, setMtime] = useState(0);
  const [status, setStatus] = useState<Saved>("idle");
  const [errMsg, setErrMsg] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => setMounted(true), []);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/obsidian/daily", { cache: "no-store" });
      const j = (await res.json()) as DailyResp;
      setContent(j.content ?? "");
      setPath(j.path ?? "");
      setMtime(j.mtime ?? 0);
      setStatus("idle");
      setErrMsg(null);
    } catch (e) {
      setStatus("error");
      setErrMsg((e as Error).message);
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    load();
  }, [open, load]);

  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => textareaRef.current?.focus(), 50);
    return () => clearTimeout(t);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      } else if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        void save(true);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, content, mtime]);

  async function save(force = false): Promise<boolean> {
    setStatus("saving");
    setErrMsg(null);
    const body = JSON.stringify({ content, mtime: force ? 0 : mtime });
    try {
      let res = await fetch("/api/obsidian/daily", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body,
      });
      if (res.status === 409 && force) {
        // Already retried with mtime=0 — surface conflict.
        setStatus("conflict");
        const j = (await res.json()) as { current?: { mtime: number; content: string } };
        if (j.current) {
          setMtime(j.current.mtime);
        }
        return false;
      }
      if (res.status === 409) {
        // Retry once unforced — current file may have changed on disk; reload.
        const j = (await res.json()) as { current?: { mtime: number } };
        if (j.current) setMtime(j.current.mtime);
        // Retry with the freshly read mtime.
        res = await fetch("/api/obsidian/daily", {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ content, mtime: j.current?.mtime ?? 0 }),
        });
      }
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string };
        setStatus("error");
        setErrMsg(j.error ?? `HTTP ${res.status}`);
        return false;
      }
      const j = (await res.json()) as { ok: true; mtime: number };
      setMtime(j.mtime);
      setStatus("saved");
      return true;
    } catch (e) {
      setStatus("error");
      setErrMsg((e as Error).message);
      return false;
    }
  }

  function onChange(next: string) {
    setContent(next);
    setStatus("idle");
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => void save(), SAVE_DEBOUNCE_MS);
  }

  if (!open || !mounted) return null;

  const pathShort = path.split("/").slice(-2).join("/");
  const words = content.trim().split(/\s+/).filter(Boolean).length;
  const today = format(new Date(), "EEEE, MMMM d");

  const statusLabel =
    status === "saving"
      ? "saving…"
      : status === "saved"
        ? "saved"
        : status === "error"
          ? `error · ${errMsg ?? ""}`
          : status === "conflict"
            ? "conflict · reload"
            : "";
  const statusColor =
    status === "saved"
      ? "var(--c-good)"
      : status === "error" || status === "conflict"
        ? "var(--c-error)"
        : "var(--fg-soft)";

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: "oklch(0 0 0 / 0.55)", backdropFilter: "blur(8px)" }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="glass flex flex-col"
        style={{
          width: "min(820px, 92vw)",
          height: "min(82vh, 880px)",
          borderRadius: 20,
          padding: "20px 22px",
          background: "var(--bg-a)",
          border: "1px solid var(--rule)",
        }}
      >
        <header className="flex items-baseline gap-3 mb-3">
          <span className="src-dot src-obsidian" />
          <span className="t-eyebrow">Daily</span>
          <h2
            className="m-0 font-medium"
            style={{ fontSize: 18, letterSpacing: "-0.015em" }}
          >
            {today}
          </h2>
          <span className="flex-1" />
          <span
            className="t-mono"
            style={{ fontSize: 11, color: statusColor }}
            suppressHydrationWarning
          >
            {statusLabel}
          </span>
          <span
            className="t-mono"
            style={{ fontSize: 11, color: "var(--fg-soft)" }}
          >
            {words} words · {pathShort}
          </span>
          <button
            type="button"
            onClick={onClose}
            className="t-mono hover:text-fg"
            style={{
              background: "transparent",
              border: 0,
              fontSize: 11,
              padding: "2px 8px",
              cursor: "pointer",
              color: "var(--fg-soft)",
            }}
            title="Close (Esc)"
          >
            esc
          </button>
        </header>
        <hr className="hr-rule mb-3" />
        <textarea
          ref={textareaRef}
          value={content}
          onChange={(e) => onChange(e.target.value)}
          spellCheck
          className="scroll flex-1 min-h-0 w-full"
          style={{
            background: "transparent",
            border: 0,
            outline: 0,
            resize: "none",
            color: "var(--fg)",
            fontSize: 14.5,
            lineHeight: 1.6,
            letterSpacing: "-0.005em",
            fontFamily: "inherit",
            padding: 4,
            textWrap: "pretty",
          }}
          placeholder="Write…"
        />
        <div
          className="t-mono mt-2 flex justify-between"
          style={{ fontSize: 10, color: "var(--fg-soft)" }}
        >
          <span>autosave · ⌘S forces · Esc closes</span>
          <span>{content.length} chars</span>
        </div>
      </div>
    </div>,
    document.body,
  );
}
