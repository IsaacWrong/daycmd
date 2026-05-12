"use client";

import { useEffect, useState } from "react";
import type { SkillDef } from "@/lib/skills-defs";

const BUSY_EVENT = "ai-os:agent-busy";
const RUN_EVENT = "ai-os:run-skill";

export function SkillsPanel() {
  const [skills, setSkills] = useState<SkillDef[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetch("/api/agent/skills")
      .then((r) => r.json())
      .then((j) => setSkills(j.skills ?? []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    function onBusy(e: Event) {
      setBusy(Boolean((e as CustomEvent<boolean>).detail));
    }
    window.addEventListener(BUSY_EVENT, onBusy);
    return () => window.removeEventListener(BUSY_EVENT, onBusy);
  }, []);

  function run(s: SkillDef) {
    if (busy) return;
    window.dispatchEvent(
      new CustomEvent(RUN_EVENT, { detail: s }),
    );
  }

  return (
    <section className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4 lg:col-span-1 flex flex-col">
      <h2 className="text-sm font-medium uppercase tracking-wider text-zinc-400 mb-3">
        Skills
      </h2>
      <ul className="space-y-1 flex-1 overflow-y-auto">
        {skills.length === 0 && (
          <li className="text-xs text-zinc-500">Loading…</li>
        )}
        {skills.map((s) => (
          <li key={s.id}>
            <button
              onClick={() => run(s)}
              disabled={busy}
              title={`${s.description}${s.category ? ` → ${s.category}` : ""}${s.model ? ` · ${s.model.replace("claude-", "")}` : ""}`}
              className="w-full text-left p-2 rounded-md hover:bg-zinc-800/60 disabled:opacity-40 disabled:cursor-not-allowed transition-colors group"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm text-zinc-100 truncate">
                  {s.label}
                </span>
                {s.category && (
                  <span className="text-[9px] text-zinc-600 font-mono shrink-0 group-hover:text-zinc-500">
                    {s.category}
                  </span>
                )}
              </div>
              <p className="text-[11px] text-zinc-500 line-clamp-2 mt-0.5">
                {s.description}
              </p>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
