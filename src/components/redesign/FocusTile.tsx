"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { migrateKey } from "@/lib/ls-migrate";
import { fetchState, putState } from "@/lib/vault-state-client";
import { usePoll } from "@/lib/hooks";
import { useActiveTimer } from "@/lib/timer";

type ProjectListItem = { name: string };
type ProjectsResp = { projects: ProjectListItem[] };

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

export function FocusTile({ defaultProject = "Daycmd" }: { defaultProject?: string }) {
  const [state, setState] = useState<PomoState>(null);
  const [today, setToday] = useState(0);
  const [day, setDay] = useState<string>(() => todayKey());
  const [now, setNow] = useState<number>(() => Date.now());
  const [project, setProject] = useState(defaultProject);
  const [hydrated, setHydrated] = useState(false);
  const completedRef = useRef(false);
  const { data: projectsResp } = usePoll<ProjectsResp>("/api/projects", 60_000);
  const projects = projectsResp?.projects ?? [];
  const timer = useActiveTimer();
  const [pickerOpen, setPickerOpen] = useState(false);
  const pickerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!pickerOpen) return;
    function onDown(e: MouseEvent) {
      if (!pickerRef.current) return;
      if (!pickerRef.current.contains(e.target as Node)) setPickerOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setPickerOpen(false);
    }
    window.addEventListener("mousedown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("mousedown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [pickerOpen]);

  const handlePick = useCallback(
    (value: string) => {
      setPickerOpen(false);
      if (!value) return;
      setProject(value);
      persist({ project: value });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [state, today, day],
  );

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
      void timer.stop(`Pomodoro ${nextCount} · ${project}`);
      if (nextCount > 0 && nextCount % 4 === 0) {
        const note = `Pomodoro ${nextCount} done · ${project}`;
        fetch("/api/obsidian/daily", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ text: note }),
        }).catch(() => {});
      }
    }
  }, [state, now, today, project, hydrated, timer]);

  function start() {
    const s = { startedAt: Date.now(), durationMs: POMO_DUR_MIN * 60_000 };
    setState(s);
    setNow(Date.now());
    completedRef.current = false;
    persist({ state: s });
    timer.start(project);
  }

  function stop() {
    setState(null);
    persist({ state: null });
    timer.discard();
  }


  const remaining = state ? state.startedAt + state.durationMs - now : POMO_DUR_MIN * 60_000;
  const label = state ? formatMS(remaining) : `${POMO_DUR_MIN}:00`;

  return (
    <section className="mb-8">
      <div className="flex items-center gap-2 mb-6">
        <span className="t-eyebrow" style={{ color: "var(--c-tasks)" }}>
          ● Focus
        </span>
        <span className="flex-1" />
        <span className="t-mono t-num text-[11px] text-fg-soft">
          {today}/{GOAL} pomodoros
        </span>
      </div>
      <hr className="hr-rule" style={{ marginBottom: 24 }} />

      <div className="mb-3">
        <div className="t-mono text-[10px] text-fg-soft mb-1">WORKING ON</div>
        <div className="flex items-center gap-2" ref={pickerRef} style={{ position: "relative" }}>
          <span className="src-dot src-tasks" />
          <button
            type="button"
            onClick={() => {
              if (state) return;
              setPickerOpen((v) => !v);
            }}
            disabled={!!state}
            className="text-[15px] font-medium text-fg inline-flex items-center"
            style={{
              letterSpacing: "-0.01em",
              background: "transparent",
              border: 0,
              padding: 0,
              outline: 0,
              gap: 6,
              cursor: state ? "default" : "pointer",
              opacity: state ? 0.7 : 1,
            }}
            aria-haspopup="listbox"
            aria-expanded={pickerOpen}
          >
            <span>{project || "Select project…"}</span>
            <svg
              width="10"
              height="6"
              viewBox="0 0 10 6"
              fill="none"
              style={{
                color: "var(--fg-soft)",
                transform: pickerOpen ? "rotate(180deg)" : "none",
                transition: "transform 0.15s",
              }}
            >
              <path
                d="M1 1l4 4 4-4"
                stroke="currentColor"
                strokeWidth="1.4"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
          {pickerOpen && (
            <ul
              role="listbox"
              style={{
                position: "absolute",
                top: "calc(100% + 6px)",
                left: 14,
                minWidth: 180,
                maxHeight: 240,
                overflowY: "auto",
                margin: 0,
                padding: 4,
                listStyle: "none",
                background: "oklch(from var(--bg) l c h / 0.96)",
                backdropFilter: "blur(10px)",
                border: "1px solid var(--rule)",
                borderRadius: 8,
                boxShadow: "0 10px 30px oklch(0 0 0 / 0.20)",
                zIndex: 30,
                fontSize: 13,
              }}
            >
              {projects.length === 0 && (
                <li
                  className="text-fg-soft"
                  style={{ padding: "6px 10px", fontSize: 12 }}
                >
                  No projects
                </li>
              )}
              {projects.map((p) => {
                const active = p.name === project;
                return (
                  <li key={p.name}>
                    <button
                      type="button"
                      onClick={() => handlePick(p.name)}
                      className="w-full text-left hover:bg-fg/5"
                      style={{
                        padding: "6px 10px",
                        background: active
                          ? "oklch(from var(--c-tasks) l c h / 0.12)"
                          : "transparent",
                        color: "var(--fg)",
                        border: 0,
                        borderRadius: 4,
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                      }}
                    >
                      <span
                        className="src-dot src-tasks"
                        style={{ width: 5, height: 5, opacity: active ? 1 : 0.4 }}
                      />
                      {p.name}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>

      <div className="flex gap-1 mb-4">
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
      </div>
    </section>
  );
}
