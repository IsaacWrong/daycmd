"use client";

import { useEffect, useRef, useState } from "react";
import { migrateKey } from "@/lib/ls-migrate";
import { fetchState, putState } from "@/lib/vault-state-client";

const POMO_STATE_LS = "daycmd.pomo.state";
const POMO_TODAY_LS = "daycmd.pomo.today";
const POMO_DAY_LS = "daycmd.pomo.day";
const POMO_PROJECT_LS = "daycmd.pomo.project";
const POMO_STATE_KEY = "pomo";
const POMO_DUR_MIN = 25;
const GOAL = 6;

type PomoState = { startedAt: number; durationMs: number } | null;

type PomoVaultState = {
  state: PomoState;
  today: number;
  day: string;
  project: string;
};

function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

// One-shot pull from localStorage on first run, then clear LS so the vault is
// the only source of truth.
async function migrateLocalStorage(defaultProject: string): Promise<PomoVaultState | null> {
  if (typeof window === "undefined") return null;
  migrateKey("ai-os.pomo.state", POMO_STATE_LS);
  migrateKey("ai-os.pomo.today", POMO_TODAY_LS);
  migrateKey("ai-os.pomo.day", POMO_DAY_LS);
  migrateKey("ai-os.pomo.project", POMO_PROJECT_LS);
  const stateRaw = localStorage.getItem(POMO_STATE_LS);
  const todayRaw = localStorage.getItem(POMO_TODAY_LS);
  const dayRaw = localStorage.getItem(POMO_DAY_LS);
  const projectRaw = localStorage.getItem(POMO_PROJECT_LS);
  if (!stateRaw && !todayRaw && !dayRaw && !projectRaw) return null;
  let state: PomoState = null;
  try {
    state = stateRaw ? (JSON.parse(stateRaw) as PomoState) : null;
  } catch {}
  const migrated: PomoVaultState = {
    state,
    today: Number(todayRaw ?? "0"),
    day: dayRaw ?? todayKey(),
    project: projectRaw || defaultProject,
  };
  localStorage.removeItem(POMO_STATE_LS);
  localStorage.removeItem(POMO_TODAY_LS);
  localStorage.removeItem(POMO_DAY_LS);
  localStorage.removeItem(POMO_PROJECT_LS);
  return migrated;
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
  const [day, setDay] = useState<string>(() => todayKey());
  const [now, setNow] = useState<number>(() => Date.now());
  const [project, setProject] = useState(defaultProject);
  const [hydrated, setHydrated] = useState(false);
  const [editing, setEditing] = useState(false);
  const completedRef = useRef(false);

  function persist(patch: Partial<PomoVaultState>) {
    const next: PomoVaultState = {
      state: patch.state !== undefined ? patch.state : state,
      today: patch.today !== undefined ? patch.today : today,
      day: patch.day !== undefined ? patch.day : day,
      project: patch.project !== undefined ? patch.project : project,
    };
    void putState(POMO_STATE_KEY, next);
  }

  useEffect(() => {
    let cancelled = false;
    (async () => {
      let remote = await fetchState<PomoVaultState>(POMO_STATE_KEY);
      if (!remote) {
        const migrated = await migrateLocalStorage(defaultProject);
        if (migrated) {
          await putState(POMO_STATE_KEY, migrated);
          remote = migrated;
        }
      }
      if (cancelled) return;
      const today0 = todayKey();
      if (remote) {
        const sameDay = remote.day === today0;
        const newToday = sameDay ? remote.today : 0;
        setState(remote.state);
        setToday(newToday);
        setDay(today0);
        if (remote.project) setProject(remote.project);
        if (!sameDay) {
          await putState(POMO_STATE_KEY, {
            state: remote.state,
            today: 0,
            day: today0,
            project: remote.project || defaultProject,
          });
        }
      } else {
        setDay(today0);
      }
      setHydrated(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [defaultProject]);

  useEffect(() => {
    if (!state) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [state]);

  useEffect(() => {
    if (!hydrated) return;
    if (!state) {
      completedRef.current = false;
      return;
    }
    const remaining = state.startedAt + state.durationMs - now;
    if (remaining <= 0 && !completedRef.current) {
      completedRef.current = true;
      const nextCount = today + 1;
      const today0 = todayKey();
      setToday(nextCount);
      setDay(today0);
      setState(null);
      persist({ today: nextCount, day: today0, state: null });
      if (nextCount > 0 && nextCount % 4 === 0) {
        const note = `Pomodoro ${nextCount} done · ${project}`;
        fetch("/api/obsidian/daily", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ text: note }),
        }).catch(() => {});
      }
    }
  }, [state, now, today, project, hydrated]);

  function start() {
    const s = { startedAt: Date.now(), durationMs: POMO_DUR_MIN * 60_000 };
    setState(s);
    setNow(Date.now());
    completedRef.current = false;
    persist({ state: s });
  }

  function stop() {
    setState(null);
    persist({ state: null });
  }

  function commitProject(value: string) {
    const v = value.trim();
    if (v) {
      setProject(v);
      persist({ project: v });
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
