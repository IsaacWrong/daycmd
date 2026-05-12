"use client";

import { useEffect } from "react";
import { useFocusMode, useTod, TodFrame } from "@/components/redesign/TodFrame";
import { Masthead } from "@/components/redesign/Masthead";
import { FocusTile } from "@/components/redesign/FocusTile";
import {
  ProjectsList,
  Streaks,
  TodayInNumbers,
} from "@/components/redesign/LeftSpineSections";
import { Heatmap } from "@/components/redesign/Heatmap";
import { SectionMini } from "@/components/redesign/Section";
import { NowHero } from "@/components/redesign/NowHero";
import { TaskList } from "@/components/redesign/TaskList";
import { DailyNotePreview } from "@/components/redesign/DailyNotePreview";
import { RightStreams } from "@/components/redesign/RightStreams";
import { AgentBar, SkillStrip } from "@/components/redesign/AgentBar";

export default function Home() {
  const tod = useTod();
  const [focus, toggleFocus] = useFocusMode();

  // Fire stale KB auto-compile sweep on mount. Server-side dedupes (5-min debounce).
  useEffect(() => {
    fetch("/api/kb/auto-compile", { method: "POST" }).catch(() => {});
  }, []);

  return (
    <TodFrame tod={tod} focus={focus}>
      <Masthead tod={tod} />

      <div
        className="grid"
        style={{
          flex: 1,
          gridTemplateColumns: "300px 1fr 320px",
          gap: 40,
          padding: "20px 48px 140px",
          minHeight: 0,
        }}
      >
        <aside
          className="scroll dimmable"
          style={{
            paddingRight: 18,
            borderRight: "1px solid var(--rule)",
          }}
        >
          <FocusTile />
          <TodayInNumbers />
          <Streaks />
          <SectionMini title="Last 14 days · commits">
            <Heatmap />
          </SectionMini>
          <ProjectsList />
        </aside>

        <main className="scroll" style={{ overflowY: "auto", paddingRight: 8 }}>
          <NowHero />
          <div className="dimmable">
            <TaskList />
            <DailyNotePreview />
          </div>
        </main>

        <RightStreams />
      </div>

      <div
        className="focus-keep"
        style={{
          position: "fixed",
          left: 48,
          right: 48,
          bottom: 22,
          zIndex: 5,
          display: "flex",
          flexDirection: "column",
          gap: 14,
        }}
      >
        <div style={{ opacity: focus ? 1 : 0.85, transition: "opacity 320ms ease" }}>
          <SkillStrip />
        </div>
        <AgentBar variant="wide" focus={focus} onToggleFocus={toggleFocus} />
      </div>
    </TodFrame>
  );
}
