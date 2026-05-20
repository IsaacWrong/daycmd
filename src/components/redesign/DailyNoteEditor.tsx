"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { format } from "date-fns";
import dynamic from "next/dynamic";
import { apiFetch } from "@/lib/fetch-client";

// CodeMirror 6 lives behind a dynamic import so the editor chunk is only
// shipped when this modal actually opens.
const ObsidianEditor = dynamic(
  () => import("./ObsidianEditor").then((m) => m.ObsidianEditor),
  { ssr: false },
);

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
  const ghostTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const ghostContextRef = useRef<string>("");
  const [ghost, setGhost] = useState<string>("");
  const [ghostBusy, setGhostBusy] = useState(false);
  const [ghostEnabled, setGhostEnabled] = useState(false);

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
    function onWikilink(e: Event) {
      const detail = (e as CustomEvent<{ target: string; alias?: string }>).detail;
      if (!detail?.target) return;
      const file = encodeURIComponent(detail.target);
      window.location.href = `obsidian://open?file=${file}`;
    }
    window.addEventListener("obsidian:open-wikilink", onWikilink);
    return () => window.removeEventListener("obsidian:open-wikilink", onWikilink);
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
      let res = await apiFetch("/api/obsidian/daily", {
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
        res = await apiFetch("/api/obsidian/daily", {
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

    // Ghost completion: clear stale suggestion + schedule a fresh one when idle.
    setGhost("");
    if (ghostTimer.current) clearTimeout(ghostTimer.current);
    if (!ghostEnabled) return;
    if (next.trim().length < 30) return;
    ghostContextRef.current = next;
    ghostTimer.current = setTimeout(() => {
      void requestGhost();
    }, 2200);
  }

  async function requestGhost() {
    if (ghostBusy) return;
    const ctx = ghostContextRef.current;
    if (!ctx || ctx.trim().length < 30) return;
    setGhostBusy(true);
    try {
      const res = await apiFetch("/api/micro/ghost", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ context: ctx }),
      });
      const j = (await res.json()) as { continuation?: string; error?: string };
      // Only apply if content hasn't drifted since request fired.
      if (ghostContextRef.current === ctx && j.continuation) {
        setGhost(j.continuation);
      }
    } catch {
      // swallow — ghost is opportunistic
    } finally {
      setGhostBusy(false);
    }
  }

  function acceptGhost() {
    if (!ghost) return;
    const sep =
      content.length === 0 || /\s$/.test(content) ? "" : " ";
    const next = `${content}${sep}${ghost}`;
    setContent(next);
    setGhost("");
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => void save(), SAVE_DEBOUNCE_MS);
  }

  function dismissGhost() {
    setGhost("");
    if (ghostTimer.current) clearTimeout(ghostTimer.current);
  }

  function toggleGhost() {
    setGhostEnabled((prev) => {
      const next = !prev;
      try {
        localStorage.setItem("daycmd.daily.ghost", next ? "1" : "0");
      } catch {}
      if (!next) {
        setGhost("");
        if (ghostTimer.current) clearTimeout(ghostTimer.current);
      }
      return next;
    });
  }

  useEffect(() => {
    try {
      setGhostEnabled(localStorage.getItem("daycmd.daily.ghost") === "1");
    } catch {}
  }, []);

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
            onClick={toggleGhost}
            className="t-mono"
            title={ghostEnabled ? "AI continuations on — click to disable" : "Suggest sentence continuations while typing"}
            style={{
              background: ghostEnabled
                ? "oklch(from var(--c-agent) l c h / 0.14)"
                : "transparent",
              border: `1px solid ${ghostEnabled ? "oklch(from var(--c-agent) l c h / 0.32)" : "var(--rule)"}`,
              borderRadius: 6,
              padding: "2px 8px",
              fontSize: 10,
              color: ghostEnabled ? "var(--c-agent)" : "var(--fg-soft)",
              cursor: "pointer",
              letterSpacing: "0.04em",
            }}
          >
            ✦ ghost
          </button>
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
        <ObsidianEditor value={content} onChange={onChange} autoFocus />
        {ghostEnabled && (ghost || ghostBusy) && (
          <div
            style={{
              marginTop: 8,
              padding: "8px 12px",
              borderRadius: 8,
              border: "1px solid oklch(from var(--c-agent) l c h / 0.22)",
              background: "oklch(from var(--c-agent) l c h / 0.05)",
              display: "flex",
              alignItems: "center",
              gap: 10,
              fontSize: 13,
            }}
          >
            <span style={{ color: "var(--c-agent)", fontSize: 12 }}>✦</span>
            <span
              className="flex-1"
              style={{
                color: ghost ? "var(--fg-soft)" : "var(--fg-soft)",
                fontStyle: ghost ? "italic" : "normal",
                opacity: ghostBusy && !ghost ? 0.6 : 1,
              }}
            >
              {ghost || "thinking…"}
            </span>
            {ghost && (
              <>
                <button
                  type="button"
                  onClick={acceptGhost}
                  className="t-mono"
                  style={{
                    background: "transparent",
                    border: "1px solid var(--rule)",
                    borderRadius: 4,
                    padding: "2px 8px",
                    fontSize: 10,
                    color: "var(--c-good)",
                    cursor: "pointer",
                    letterSpacing: "0.04em",
                  }}
                  title="Append to note"
                >
                  ✓ accept
                </button>
                <button
                  type="button"
                  onClick={dismissGhost}
                  className="t-mono"
                  style={{
                    background: "transparent",
                    border: "1px solid var(--rule)",
                    borderRadius: 4,
                    padding: "2px 8px",
                    fontSize: 10,
                    color: "var(--fg-soft)",
                    cursor: "pointer",
                    letterSpacing: "0.04em",
                  }}
                >
                  dismiss
                </button>
              </>
            )}
          </div>
        )}
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
