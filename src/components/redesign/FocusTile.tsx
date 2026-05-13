"use client";

import { useEffect, useRef, useState } from "react";

const POMO_STATE_LS = "ai-os.pomo.state";
const POMO_TODAY_LS = "ai-os.pomo.today";
const POMO_DAY_LS = "ai-os.pomo.day";
const POMO_PROJECT_LS = "ai-os.pomo.project";
const POMO_DUR_MIN = 25;
const GOAL = 6;

type PomoState = { startedAt: number; durationMs: number } | null;

function loadState(): PomoState {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(POMO_STATE_LS);
    return raw ? (JSON.parse(raw) as PomoState) : null;
  } catch {
    return null;
  }
}

function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

function loadTodayCount(): number {
  if (typeof window === "undefined") return 0;
  const day = localStorage.getItem(POMO_DAY_LS);
  if (day !== todayKey()) {
    localStorage.setItem(POMO_DAY_LS, todayKey());
    localStorage.setItem(POMO_TODAY_LS, "0");
    return 0;
  }
  return Number(localStorage.getItem(POMO_TODAY_LS) ?? "0");
}

function formatMS(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export function FocusTile({ defaultProject = "daycmd" }: { defaultProject?: string }) {
  const [state, setState] = useState<PomoState>(null);
  const [today, setToday] = useState(0);
  const [now, setNow] = useState<number>(() => Date.now());
  const [project, setProject] = useState(defaultProject);
  const [editing, setEditing] = useState(false);
  const completedRef = useRef(false);

  useEffect(() => {
    setState(loadState());
    setToday(loadTodayCount());
    const p = localStorage.getItem(POMO_PROJECT_LS);
    if (p) setProject(p);
  }, []);

  useEffect(() => {
    if (!state) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [state]);

  useEffect(() => {
    if (!state) {
      completedRef.current = false;
      return;
    }
    const remaining = state.startedAt + state.durationMs - now;
    if (remaining <= 0 && !completedRef.current) {
      completedRef.current = true;
      const nextCount = today + 1;
      setToday(nextCount);
      localStorage.setItem(POMO_TODAY_LS, String(nextCount));
      localStorage.setItem(POMO_DAY_LS, todayKey());
      setState(null);
      localStorage.removeItem(POMO_STATE_LS);
      if (nextCount > 0 && nextCount % 4 === 0) {
        const note = `Pomodoro ${nextCount} done · ${project}`;
        fetch("/api/obsidian/daily", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ text: note }),
        }).catch(() => {});
      }
    }
  }, [state, now, today, project]);

  function start() {
    const s = { startedAt: Date.now(), durationMs: POMO_DUR_MIN * 60_000 };
    setState(s);
    setNow(Date.now());
    completedRef.current = false;
    localStorage.setItem(POMO_STATE_LS, JSON.stringify(s));
  }

  function stop() {
    setState(null);
    localStorage.removeItem(POMO_STATE_LS);
  }

  function commitProject(value: string) {
    const v = value.trim();
    if (v) {
      setProject(v);
      localStorage.setItem(POMO_PROJECT_LS, v);
    }
    setEditing(false);
  }

  const remaining = state ? state.startedAt + state.durationMs - now : POMO_DUR_MIN * 60_000;
  const label = state ? formatMS(remaining) : `${POMO_DUR_MIN}:00`;

  return (
    <section className="mb-6">
      <div className="flex items-center gap-2 mb-2.5">
        <span className="t-eyebrow" style={{ color: "var(--c-tasks)" }}>
          ● Focus
        </span>
        <span className="flex-1" />
        <span className="t-mono t-num text-[11px] text-fg-soft">
          {today}/{GOAL} pomodoros
        </span>
      </div>
      <hr className="hr-rule mb-3.5" />

      <div className="mb-2.5">
        <div className="t-mono text-[10px] text-fg-soft mb-1">WORKING ON</div>
        <div className="flex items-center gap-2">
          <span className="src-dot src-tasks" />
          {editing ? (
            <input
              autoFocus
              defaultValue={project}
              onBlur={(e) => commitProject(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") commitProject((e.target as HTMLInputElement).value);
                if (e.key === "Escape") setEditing(false);
              }}
              className="flex-1 bg-transparent border-0 outline-0 text-[15px] font-medium text-fg"
              style={{ letterSpacing: "-0.01em" }}
            />
          ) : (
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="text-[15px] font-medium text-left hover:opacity-80"
              style={{ letterSpacing: "-0.01em" }}
            >
              {project}
            </button>
          )}
        </div>
      </div>

      <div className="flex gap-1 mb-3.5">
        {Array.from({ length: GOAL }, (_, i) => (
          <div
            key={i}
            className="flex-1 h-[5px] rounded-full"
            style={{
              background:
                i < today ? "var(--c-tasks)" : "oklch(from var(--fg) l c h / 0.10)",
            }}
          />
        ))}
      </div>

      <div className="flex gap-2">
        {state ? (
          <button
            type="button"
            onClick={stop}
            className="flex-1 text-[12.5px] font-medium text-white"
            style={{
              padding: "9px 12px",
              background: "var(--c-tasks)",
              border: 0,
              borderRadius: 6,
              letterSpacing: "-0.005em",
              cursor: "pointer",
            }}
          >
            ■ Stop {label}
          </button>
        ) : (
          <button
            type="button"
            onClick={start}
            className="flex-1 text-[12.5px] font-medium text-white"
            style={{
              padding: "9px 12px",
              background: "var(--c-tasks)",
              border: 0,
              borderRadius: 6,
              letterSpacing: "-0.005em",
              cursor: "pointer",
            }}
          >
            ▶ Start {label}
          </button>
        )}
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="text-[12px] text-fg-soft hover:text-fg"
          style={{ padding: "9px 12px", background: "transparent", border: 0, cursor: "pointer" }}
        >
          Change…
        </button>
      </div>
    </section>
  );
}
