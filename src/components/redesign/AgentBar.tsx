"use client";

import { useEffect, useRef, useState } from "react";
import { SKILLS, MODEL_CHOICES, isValidModel, type SkillDef } from "@/lib/skills-defs";
import { Paperclip, Sun } from "./Glyph";
import { useAgent, RUN_SKILL_EVENT, type Attachment } from "./useAgent";

const CHAT_MODEL_LS_KEY = "daycmd.chat.model";
import { fileToAttachment } from "./agent-bar/attachments";
import { ThreadView } from "./agent-bar/ThreadView";
import { SkillStrip } from "./agent-bar/SkillStrip";
import { Bubble } from "./agent-bar/Bubble";

export { SkillStrip } from "./agent-bar/SkillStrip";

type Variant = "wide" | "workspace";

export function AgentBar({
  variant = "wide",
  category,
  focus,
  onToggleFocus,
  open,
  onOpenChange,
}: {
  variant?: Variant;
  category?: string;
  focus: boolean;
  onToggleFocus: () => void;
  open?: boolean;
  onOpenChange?: (v: boolean) => void;
}) {
  const agent = useAgent(category);
  const [input, setInput] = useState("");
  const [catOpen, setCatOpen] = useState(false);
  const [chatModel, setChatModelState] = useState<string>("claude-sonnet-4-6");

  useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = localStorage.getItem(CHAT_MODEL_LS_KEY);
    if (stored && isValidModel(stored)) {
      setChatModelState(stored);
      return;
    }
    fetch("/api/settings")
      .then((r) => r.json())
      .then((s: { defaultChatModel?: string }) => {
        if (s.defaultChatModel && isValidModel(s.defaultChatModel)) {
          setChatModelState(s.defaultChatModel);
        }
      })
      .catch(() => {});
  }, []);

  function setChatModel(m: string) {
    if (!isValidModel(m)) return;
    setChatModelState(m);
    try {
      localStorage.setItem(CHAT_MODEL_LS_KEY, m);
    } catch {}
  }
  const [pending, setPending] = useState<Attachment[]>([]);
  const [attachError, setAttachError] = useState<string | null>(null);
  const [barOpenLocal, setBarOpenLocal] = useState(false);
  const barOpen = open ?? barOpenLocal;
  const setBarOpen = (next: boolean) => {
    setBarOpenLocal(next);
    onOpenChange?.(next);
  };
  const [barMounted, setBarMounted] = useState(barOpen);
  const [barClosing, setBarClosing] = useState(false);
  const [barSettled, setBarSettled] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const catBtnRef = useRef<HTMLButtonElement>(null);
  const catMenuRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const barWrapRef = useRef<HTMLDivElement>(null);
  const bubblesScrollRef = useRef<HTMLDivElement>(null);
  const bubblesBaselineRef = useRef(0);

  useEffect(() => {
    if (variant !== "wide" || !barOpen) return;
    const id = requestAnimationFrame(() => inputRef.current?.focus());
    return () => cancelAnimationFrame(id);
  }, [variant, barOpen]);

  const lastMsg = agent.messages[agent.messages.length - 1];
  const lastContentLen = lastMsg?.content.length ?? 0;
  const lastToolsLen = lastMsg?.tools?.length ?? 0;
  useEffect(() => {
    if (!barOpen) return;
    const el = bubblesScrollRef.current;
    if (!el) return;
    const nearBottom =
      el.scrollHeight - el.scrollTop - el.clientHeight < 200;
    if (!agent.busy || nearBottom) {
      el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
    }
  }, [
    agent.messages.length,
    lastContentLen,
    lastToolsLen,
    agent.busy,
    barOpen,
  ]);

  useEffect(() => {
    if (variant !== "wide") return;
    if (agent.busy && !barOpen) setBarOpen(true);
  }, [agent.busy]);

  useEffect(() => {
    if (variant !== "wide") return;
    if (barOpen) {
      setBarMounted(true);
      setBarClosing(false);
      setBarSettled(false);
      bubblesBaselineRef.current = agent.messages.length;
      return;
    }
    if (!barMounted) return;
    setBarClosing(true);
    setBarSettled(false);
    const id = setTimeout(() => {
      setBarMounted(false);
      setBarClosing(false);
    }, 540);
    return () => clearTimeout(id);
  }, [barOpen, variant]);

  useEffect(() => {
    if (variant !== "wide" || !barOpen) return;
    function onDocMouseDown(e: MouseEvent) {
      const t = e.target as Node;
      if (barWrapRef.current?.contains(t)) return;
      if (catOpen) return;
      setBarOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && !catOpen) setBarOpen(false);
    }
    document.addEventListener("mousedown", onDocMouseDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocMouseDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [variant, barOpen, catOpen]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const meta = e.metaKey || e.ctrlKey;
      if (meta && e.key.toLowerCase() === "j") {
        e.preventDefault();
        setBarOpen(!barOpen);
      }
      // ⌘1..⌘6 — skill hotkeys
      if (meta && /^[1-6]$/.test(e.key)) {
        const idx = parseInt(e.key, 10) - 1;
        const items = category
          ? SKILLS.filter((s) => !s.category || s.category === category)
          : SKILLS;
        const skill = items[idx];
        if (skill) {
          e.preventDefault();
          agent.send(skill.prompt, { skill });
          setBarOpen(true);
        }
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [agent, category]);

  useEffect(() => {
    if (!catOpen) return;
    function onDocClick(e: MouseEvent) {
      const t = e.target as Node;
      if (catMenuRef.current?.contains(t)) return;
      if (catBtnRef.current?.contains(t)) return;
      setCatOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setCatOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [catOpen]);

  useEffect(() => {
    function handler(e: Event) {
      const skill = (e as CustomEvent<SkillDef>).detail;
      if (!skill) return;
      setBarOpen(true);
      agent.send(skill.prompt, { skill });
    }
    window.addEventListener(RUN_SKILL_EVENT, handler);
    return () => window.removeEventListener(RUN_SKILL_EVENT, handler);
  }, [agent]);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!input.trim() && pending.length === 0) return;
    agent.send(input, {
      model: chatModel,
      ...(pending.length ? { attachments: pending } : {}),
    });
    setInput("");
    setPending([]);
    setAttachError(null);
  }

  async function onFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    setAttachError(null);
    const next: Attachment[] = [];
    let rejected = 0;
    for (const f of Array.from(files)) {
      const att = await fileToAttachment(f);
      if (att) next.push(att);
      else rejected++;
    }
    if (rejected > 0) setAttachError(`${rejected} file(s) >20MB skipped`);
    if (next.length) setPending((p) => [...p, ...next]);
  }

  function removeAttachment(idx: number) {
    setPending((p) => p.filter((_, i) => i !== idx));
  }

  function openPicker() {
    fileRef.current?.click();
  }

  const attachmentChips = pending.length > 0 && (
    <div className="flex flex-wrap gap-1.5 mb-1.5">
      {pending.map((a, i) => (
        <span
          key={i}
          className="t-mono"
          style={{
            fontSize: 10.5,
            padding: "2px 6px 2px 8px",
            borderRadius: 4,
            background: "oklch(from var(--c-agent) l c h / 0.16)",
            color: "var(--fg)",
            display: "inline-flex",
            alignItems: "center",
            gap: 4,
            maxWidth: 200,
          }}
          title={a.name}
        >
          <span
            style={{
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {a.kind === "image" ? "🖼" : a.kind === "document" ? "📄" : "📝"} {a.name}
          </span>
          <button
            type="button"
            onClick={() => removeAttachment(i)}
            aria-label={`Remove ${a.name}`}
            style={{
              background: "transparent",
              border: 0,
              color: "var(--fg-soft)",
              cursor: "pointer",
              padding: 0,
              lineHeight: 1,
            }}
          >
            ×
          </button>
        </span>
      ))}
    </div>
  );

  const hiddenFileInput = (
    <input
      ref={fileRef}
      type="file"
      multiple
      style={{ display: "none" }}
      onChange={(e) => {
        void onFiles(e.target.files);
        e.target.value = "";
      }}
    />
  );

  const modelPicker = (
    <select
      value={chatModel}
      onChange={(e) => setChatModel(e.target.value)}
      title="Free-form chat model (skills use their own settings)"
      disabled={agent.busy}
      className="t-mono"
      style={{
        background: "transparent",
        border: "1px solid var(--rule)",
        borderRadius: 4,
        color: "var(--fg-soft)",
        fontSize: 10.5,
        padding: "2px 4px",
        cursor: agent.busy ? "default" : "pointer",
        outline: "none",
      }}
    >
      {MODEL_CHOICES.map((m) => (
        <option key={m.id} value={m.id}>
          {m.label}
        </option>
      ))}
    </select>
  );

  const inputField = (
    <input
      ref={inputRef}
      value={input}
      onChange={(e) => setInput(e.target.value)}
      placeholder={agent.busy ? "Working…" : "Ask anything, or run a skill…"}
      disabled={agent.busy}
      style={{
        flex: 1,
        minWidth: 0,
        background: "transparent",
        border: 0,
        outline: 0,
        fontFamily: "inherit",
        fontSize: 15,
        color: "var(--fg)",
        letterSpacing: "-0.005em",
      }}
    />
  );

  function focusInput(e: React.MouseEvent<HTMLDivElement>) {
    const t = e.target as HTMLElement;
    if (t.closest("button, select, a, input, textarea")) return;
    inputRef.current?.focus();
  }

  if (variant === "workspace") {
    return (
      <div className="flex flex-col flex-1 min-h-0">
        <ThreadView messages={agent.messages} busy={agent.busy} />
        {agent.error && (
          <p className="text-[12px] mt-2" style={{ color: "var(--c-error)" }}>
            {agent.error}
          </p>
        )}
        {hiddenFileInput}
        <form onSubmit={submit} className="mt-3.5">
          {attachmentChips}
          {attachError && (
            <p className="text-[11px] mb-1" style={{ color: "var(--c-error)" }}>
              {attachError}
            </p>
          )}
          <div
            className="glass flex items-center gap-3"
            style={{ padding: "12px 16px", borderRadius: 14, cursor: "text" }}
            onClick={focusInput}
          >
            <span
              className="inline-flex items-center justify-center text-white"
              style={{
                width: 22,
                height: 22,
                borderRadius: 999,
                background: "linear-gradient(135deg, var(--c-agent), oklch(0.65 0.16 35))",
                fontSize: 11,
              }}
            >
              ✦
            </span>
            {inputField}
            {modelPicker}
            {agent.busy ? (
              <button
                type="button"
                onClick={agent.stop}
                className="t-mono text-[11px]"
                style={{
                  padding: "2px 8px",
                  border: "1px solid var(--rule)",
                  borderRadius: 4,
                  background: "transparent",
                  color: "var(--c-error)",
                  cursor: "pointer",
                }}
              >
                stop
              </button>
            ) : (
              <>
                <button
                  type="button"
                  onClick={openPicker}
                  title="Attach files"
                  className="inline-flex items-center text-fg-soft hover:text-fg"
                  style={{
                    background: "transparent",
                    border: 0,
                    padding: 0,
                    cursor: "pointer",
                  }}
                >
                  <Paperclip s={14} />
                </button>
                <span className="kbd">⌘J</span>
              </>
            )}
          </div>
          <div
            className="t-mono mt-1.5 flex justify-between"
            style={{ fontSize: 10, color: "var(--fg-soft)" }}
          >
            <span>
              thread auto-logs to{" "}
              <span className="text-fg">Categories/{agent.category}/raw/</span>
            </span>
            {agent.messages.length > 0 && (
              <button
                type="button"
                onClick={agent.clear}
                className="hover:text-fg"
                style={{ background: "transparent", border: 0, padding: 0, cursor: "pointer" }}
              >
                clear
              </button>
            )}
          </div>
        </form>
      </div>
    );
  }

  // Wide variant — bottom dock with floating agent overlay
  const backdrop = barMounted ? (
    <div
      onClick={() => setBarOpen(false)}
      className={barClosing ? "agent-backdrop-exit" : "agent-backdrop-enter"}
      style={{
        position: "fixed",
        inset: 0,
        background: "oklch(0 0 0 / 0.32)",
        backdropFilter: "blur(10px)",
        WebkitBackdropFilter: "blur(10px)",
        cursor: "pointer",
        pointerEvents: "auto",
      }}
      aria-hidden="true"
    />
  ) : null;

  return (
    <>
      {hiddenFileInput}
      {backdrop}
      <div
        ref={barWrapRef}
        style={{
          position: "relative",
          display: "flex",
          flexDirection: "column",
          alignItems: "stretch",
          justifyContent: "flex-end",
          gap: 12,
          width: "100%",
          minHeight: 0,
          flex: barMounted ? "1 1 auto" : "0 0 auto",
        }}
      >
      {barMounted && agent.messages.length > 0 && (
        <div
          ref={bubblesScrollRef}
          className={`scroll ${barClosing ? "agent-overlay-exit" : "agent-overlay-enter"}`}
          style={{
            flex: "1 1 auto",
            minHeight: 0,
            overflowY: "auto",
            display: "flex",
            flexDirection: "column",
            gap: 12,
            padding: "4px 4px",
          }}
        >
          {agent.messages.map((m, i) => (
            <Bubble
              key={i}
              m={m}
              animate={i >= bubblesBaselineRef.current}
              busy={agent.busy && i === agent.messages.length - 1}
            />
          ))}
        </div>
      )}
      {barMounted && (
        <div
          className={barClosing ? "agent-overlay-exit" : "agent-overlay-enter"}
          style={{
            position: "fixed",
            top: 24,
            right: 56,
            display: "flex",
            alignItems: "center",
            gap: 18,
            fontSize: 11,
            pointerEvents: "auto",
          }}
        >
          {agent.messages.length > 0 && (
            <button
              type="button"
              onClick={() => {
                agent.clear();
                bubblesBaselineRef.current = 0;
              }}
              className="t-mono text-fg-soft hover:text-fg"
              style={{
                background: "transparent",
                border: 0,
                fontSize: 11,
                cursor: "pointer",
                padding: 0,
              }}
              title="Clear conversation"
            >
              clear
            </button>
          )}
          <button
            type="button"
            onClick={() => setBarOpen(false)}
            className="t-mono text-fg-soft hover:text-fg"
            style={{
              background: "transparent",
              border: 0,
              fontSize: 11,
              cursor: "pointer",
              padding: 0,
            }}
          >
            close
          </button>
        </div>
      )}
      {barMounted && (
        <div className={barClosing ? "agent-overlay-exit" : "agent-overlay-enter"}>
          <SkillStrip category={category} />
        </div>
      )}
      {!barOpen && (
        <button
          type="button"
          onClick={() => setBarOpen(true)}
          aria-label="Open agent"
          className="agent-pill-enter"
          style={
            {
              position: barMounted ? "absolute" : "static",
              alignSelf: "flex-end",
              right: 0,
              bottom: 0,
              width: 62,
              height: 62,
              borderRadius: 999,
              padding: 0,
              border: 0,
              cursor: "pointer",
              background:
                "linear-gradient(135deg, var(--c-agent), oklch(0.65 0.16 35))",
              color: "white",
              fontSize: 24,
              fontWeight: 600,
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              boxShadow:
                "inset 0 0 0 1px oklch(1 0 0 / 0.28), 0 14px 32px -12px var(--glass-sh), 0 4px 10px -4px var(--glass-sh)",
              "--agent-pill-delay": barMounted ? "260ms" : "0ms",
            } as React.CSSProperties
          }
        >
          ✦
          {agent.busy && (
            <span
              style={{
                position: "absolute",
                top: 6,
                right: 6,
                width: 9,
                height: 9,
                borderRadius: 999,
                background: "white",
                boxShadow: "0 0 0 2px var(--c-agent)",
              }}
            />
          )}
          {pending.length > 0 && !agent.busy && (
            <span
              className="t-mono"
              style={{
                position: "absolute",
                top: 3,
                right: 3,
                minWidth: 18,
                height: 18,
                borderRadius: 999,
                background: "white",
                color: "var(--c-agent)",
                fontSize: 11,
                fontWeight: 700,
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                padding: "0 4px",
              }}
            >
              {pending.length}
            </span>
          )}
        </button>
      )}
      {barMounted && (
      <form
        onSubmit={submit}
        className={
          barClosing
            ? "agent-bar-exit"
            : barSettled
              ? undefined
              : "agent-bar-enter"
        }
        onAnimationEnd={() => {
          if (!barClosing) setBarSettled(true);
        }}
        style={{ width: "100%" }}
      >
        {attachmentChips}
        {attachError && (
          <p className="text-[11px] mb-1" style={{ color: "var(--c-error)" }}>
            {attachError}
          </p>
        )}
        <div
          className="glass"
          style={{
            borderRadius: 18,
            boxShadow:
              "0 18px 40px -20px oklch(0.20 0.02 260 / 0.35), 0 2px 8px -2px oklch(0.20 0.02 260 / 0.10)",
            cursor: "text",
          }}
          onClick={focusInput}
        >
          <div className="agent-bar">
            <span
              className="inline-flex items-center justify-center text-white"
              style={{
                width: 26,
                height: 26,
                borderRadius: 999,
                background: "linear-gradient(135deg, var(--c-agent), oklch(0.65 0.16 35))",
                fontSize: 12,
                fontWeight: 600,
                boxShadow: "inset 0 0 0 1px oklch(1 0 0 / 0.25)",
              }}
            >
              ✦
            </span>
            <div style={{ position: "relative" }}>
              <button
                ref={catBtnRef}
                type="button"
                onClick={() => setCatOpen((v) => !v)}
                className="text-[13px] font-medium"
                style={{
                  background: "transparent",
                  border: 0,
                  padding: 0,
                  color: "var(--fg)",
                  cursor: "pointer",
                }}
                title="Pick category"
                aria-haspopup="listbox"
                aria-expanded={catOpen}
              >
                {agent.category} <span style={{ opacity: 0.5 }}>▾</span>
              </button>
              {catOpen && (
                <div
                  ref={catMenuRef}
                  role="listbox"
                  className="glass"
                  style={{
                    position: "absolute",
                    bottom: "calc(100% + 8px)",
                    left: 0,
                    minWidth: 180,
                    padding: 4,
                    borderRadius: 10,
                    border: "1px solid var(--rule)",
                    boxShadow: "0 18px 40px -16px oklch(0 0 0 / 0.35)",
                    zIndex: 50,
                    display: "flex",
                    flexDirection: "column",
                    gap: 1,
                  }}
                >
                  {agent.categories.map((c) => {
                    const active = c === agent.category;
                    return (
                      <button
                        key={c}
                        type="button"
                        role="option"
                        aria-selected={active}
                        onClick={() => {
                          agent.setCategory(c);
                          setCatOpen(false);
                        }}
                        className="text-[13px] hover:bg-fg-soft/10"
                        style={{
                          background: active ? "oklch(from var(--fg) l c h / 0.06)" : "transparent",
                          border: 0,
                          padding: "6px 10px",
                          borderRadius: 6,
                          color: active ? "var(--c-agent)" : "var(--fg)",
                          cursor: "pointer",
                          textAlign: "left",
                          width: "100%",
                        }}
                      >
                        {c}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
            <span
              style={{ width: 1, height: 22, background: "var(--rule)", flexShrink: 0 }}
            />
            {inputField}
            <div className="flex items-center gap-2">
              {modelPicker}
              <button
                type="button"
                onClick={openPicker}
                title="Attach files"
                className="inline-flex items-center justify-center text-fg-soft hover:text-fg"
                style={{
                  width: 26,
                  height: 26,
                  background: "transparent",
                  border: 0,
                  cursor: "pointer",
                  position: "relative",
                }}
              >
                <Paperclip s={14} />
                {pending.length > 0 && (
                  <span
                    style={{
                      position: "absolute",
                      top: -2,
                      right: -2,
                      minWidth: 14,
                      height: 14,
                      borderRadius: 999,
                      background: "var(--c-agent)",
                      color: "white",
                      fontSize: 9,
                      fontWeight: 600,
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      padding: "0 3px",
                    }}
                  >
                    {pending.length}
                  </span>
                )}
              </button>
              <button
                type="button"
                onClick={onToggleFocus}
                title="Focus mode"
                className="inline-flex items-center justify-center hover:opacity-80"
                style={{
                  width: 26,
                  height: 26,
                  background: "transparent",
                  border: 0,
                  cursor: "pointer",
                  color: focus ? "var(--c-agent)" : "var(--fg-soft)",
                }}
              >
                <Sun s={14} />
              </button>
              <span className="kbd">⌘J</span>
              {agent.busy && (
                <button
                  type="button"
                  onClick={agent.stop}
                  className="t-mono text-[11px]"
                  style={{
                    padding: "2px 8px",
                    border: "1px solid var(--rule)",
                    borderRadius: 4,
                    background: "transparent",
                    color: "var(--c-error)",
                    cursor: "pointer",
                  }}
                >
                  stop
                </button>
              )}
            </div>
          </div>
        </div>
      </form>
      )}
      </div>
    </>
  );
}

// (compat note removed)
