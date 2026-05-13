"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Markdown } from "@/components/Markdown";
import { SKILLS, type SkillDef } from "@/lib/skills-defs";
import { Paperclip, Sun } from "./Glyph";
import { useAgent, RUN_SKILL_EVENT, type Msg } from "./useAgent";

type Variant = "wide" | "workspace";

const HOTKEY_LABELS = ["⌘1", "⌘2", "⌘3", "⌘4", "⌘5", "⌘6"];

function ThreadView({ messages, busy }: { messages: Msg[]; busy: boolean }) {
  const scrollRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages]);
  return (
    <div
      ref={scrollRef}
      className="scroll flex-1 min-h-0 overflow-y-auto pr-1 flex flex-col gap-[18px]"
    >
      {messages.map((m, i) => (
        <div key={i}>
          <div
            className="t-mono uppercase mb-1.5"
            style={{
              fontSize: 10,
              color: m.role === "user" ? "var(--c-agent)" : "var(--fg-soft)",
              letterSpacing: "0.04em",
            }}
          >
            {m.role === "user" ? "you" : "claude"}
          </div>
          {m.tools && m.tools.length > 0 && (
            <div className="flex flex-wrap gap-1 mb-1.5">
              {m.tools.map((t, ti) => (
                <span
                  key={ti}
                  className="t-mono"
                  style={{
                    fontSize: 10,
                    padding: "1px 6px",
                    borderRadius: 4,
                    color:
                      t.ok === undefined
                        ? "var(--fg-soft)"
                        : t.ok
                          ? "var(--c-good)"
                          : "var(--c-error)",
                    background: "oklch(from var(--fg) l c h / 0.04)",
                  }}
                >
                  {t.ok === undefined ? "·" : t.ok ? "✓" : "✗"} {t.name}
                </span>
              ))}
            </div>
          )}
          {m.role === "assistant" ? (
            m.content ? (
              <div
                style={{
                  fontSize: 14.5,
                  lineHeight: 1.55,
                  color: "var(--fg)",
                  letterSpacing: "-0.005em",
                  textWrap: "pretty",
                }}
              >
                <Markdown>{m.content}</Markdown>
              </div>
            ) : busy && i === messages.length - 1 ? (
              <span className="text-fg-soft">…</span>
            ) : null
          ) : (
            <div
              className="whitespace-pre-wrap"
              style={{
                fontSize: 14.5,
                lineHeight: 1.55,
                color: "var(--fg)",
                letterSpacing: "-0.005em",
              }}
            >
              {m.content}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

export function SkillStrip({
  category,
  variant = "row",
}: {
  category?: string;
  variant?: "row" | "workspace";
}) {
  const items = category
    ? SKILLS.filter((s) => !s.category || s.category === category).slice(0, 6)
    : SKILLS.slice(0, 6);

  function run(s: SkillDef) {
    window.dispatchEvent(new CustomEvent<SkillDef>(RUN_SKILL_EVENT, { detail: s }));
  }

  const containerStyle: React.CSSProperties =
    variant === "workspace"
      ? {
          padding: "10px 0",
          borderTop: "1px solid var(--rule)",
          borderBottom: "1px solid var(--rule)",
          marginBottom: 16,
        }
      : {};

  return (
    <div
      className="flex items-center justify-center text-[12px] flex-wrap"
      style={containerStyle}
    >
      {items.map((s, i) => (
        <div key={s.id} className="flex items-center" style={{ flexShrink: 0 }}>
          {i > 0 && (
            <span
              className="inline-block"
              style={{
                width: 1,
                height: 11,
                background: "var(--rule)",
                margin: "0 14px",
                flexShrink: 0,
              }}
            />
          )}
          <button
            type="button"
            onClick={() => run(s)}
            className="inline-flex items-center gap-2 hover:text-fg"
            style={{
              background: "transparent",
              border: 0,
              padding: 0,
              fontSize: 12,
              color: "var(--fg-soft)",
              cursor: "pointer",
              letterSpacing: "-0.005em",
              whiteSpace: "nowrap",
            }}
          >
            {s.label}
            <span
              className="t-mono"
              style={{ fontSize: 10, opacity: 0.6 }}
            >
              {HOTKEY_LABELS[i]}
            </span>
          </button>
        </div>
      ))}
    </div>
  );
}

export function AgentBar({
  variant = "wide",
  category,
  focus,
  onToggleFocus,
}: {
  variant?: Variant;
  category?: string;
  focus: boolean;
  onToggleFocus: () => void;
}) {
  const agent = useAgent(category);
  const [input, setInput] = useState("");
  const [mounted, setMounted] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (expanded) {
      const id = requestAnimationFrame(() => inputRef.current?.focus());
      return () => cancelAnimationFrame(id);
    }
  }, [expanded]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const meta = e.metaKey || e.ctrlKey;
      if (meta && e.key.toLowerCase() === "j") {
        e.preventDefault();
        setExpanded((v) => !v);
      }
      if (e.key === "Escape") setExpanded(false);
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
          setExpanded(true);
        }
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [agent, category]);

  useEffect(() => {
    function handler(e: Event) {
      const skill = (e as CustomEvent<SkillDef>).detail;
      if (!skill) return;
      setExpanded(true);
      agent.send(skill.prompt, { skill });
    }
    window.addEventListener(RUN_SKILL_EVENT, handler);
    return () => window.removeEventListener(RUN_SKILL_EVENT, handler);
  }, [agent]);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!input.trim()) return;
    agent.send(input);
    setInput("");
  }

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
        <form onSubmit={submit} className="mt-3.5">
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

  // Wide variant — bottom dock + ⌘J drawer
  const drawer =
    expanded && mounted
      ? createPortal(
          <div className="fixed inset-0 z-40 flex">
            <div
              className="flex-1"
              style={{ background: "oklch(0 0 0 / 0.5)", backdropFilter: "blur(4px)" }}
              onClick={() => setExpanded(false)}
            />
            <div
              className="w-full flex flex-col"
              style={{
                maxWidth: 760,
                background: "var(--bg-a)",
                borderLeft: "1px solid var(--rule)",
                padding: 24,
                boxShadow: "0 30px 80px -30px oklch(0 0 0 / 0.35)",
              }}
            >
              <header className="flex items-center gap-3 mb-3">
                <span className="t-eyebrow">Agent · {agent.category}</span>
                <span className="flex-1" />
                <select
                  value={agent.category}
                  onChange={(e) => agent.setCategory(e.target.value)}
                  disabled={agent.busy}
                  className="t-mono"
                  style={{
                    background: "transparent",
                    border: "1px solid var(--rule)",
                    color: "var(--fg)",
                    fontSize: 11,
                    padding: "2px 6px",
                    borderRadius: 4,
                  }}
                >
                  {agent.categories.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
                {agent.messages.length > 0 && (
                  <button
                    type="button"
                    onClick={agent.clear}
                    className="t-mono text-fg-soft hover:text-fg"
                    style={{
                      background: "transparent",
                      border: 0,
                      fontSize: 11,
                      cursor: "pointer",
                    }}
                    title="Clear conversation"
                  >
                    clear
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setExpanded(false)}
                  className="t-mono text-fg-soft hover:text-fg"
                  style={{
                    background: "transparent",
                    border: 0,
                    fontSize: 11,
                    cursor: "pointer",
                  }}
                >
                  close
                </button>
              </header>
              <ThreadView messages={agent.messages} busy={agent.busy} />
              {agent.error && (
                <p className="text-[12px] mt-2" style={{ color: "var(--c-error)" }}>
                  {agent.error}
                </p>
              )}
              <form onSubmit={submit} className="mt-3.5">
                <div
                  className="glass flex items-center gap-3"
                  style={{ padding: "12px 16px", borderRadius: 14, cursor: "text" }}
                  onClick={focusInput}
                >
                  {inputField}
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
                    <span className="kbd">⌘J</span>
                  )}
                </div>
              </form>
            </div>
          </div>,
          document.body,
        )
      : null;

  return (
    <>
      <form onSubmit={submit}>
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
            <button
              type="button"
              onClick={() => {
                // cycle to next category for quick switching
                const idx = agent.categories.indexOf(agent.category);
                const next = agent.categories[(idx + 1) % agent.categories.length];
                if (next) agent.setCategory(next);
              }}
              className="text-[13px] font-medium"
              style={{
                background: "transparent",
                border: 0,
                padding: 0,
                color: "var(--fg)",
                cursor: "pointer",
              }}
              title="Click to cycle category"
            >
              {agent.category} <span style={{ opacity: 0.5 }}>▾</span>
            </button>
            <span
              style={{ width: 1, height: 22, background: "var(--rule)", flexShrink: 0 }}
            />
            {inputField}
            <div className="flex items-center gap-2">
              <button
                type="button"
                title="Attach"
                className="inline-flex items-center text-fg-soft hover:text-fg"
                style={{
                  width: 26,
                  height: 26,
                  background: "transparent",
                  border: 0,
                  cursor: "pointer",
                }}
              >
                <Paperclip s={14} />
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
      {drawer}
    </>
  );
}
