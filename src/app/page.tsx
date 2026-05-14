"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
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
import { AgentBar } from "@/components/redesign/AgentBar";
import { CalendarOverlayProvider } from "@/components/calendar/CalendarOverlayProvider";
import { MailOverlayProvider } from "@/components/mail/MailOverlayProvider";

export default function Home() {
  const tod = useTod();
  const [focus, toggleFocus] = useFocusMode();
  const [agentOpen, setAgentOpen] = useState(false);
  const router = useRouter();

  // Bounce to /setup if VAULT_PATH or ANTHROPIC_API_KEY is missing.
  useEffect(() => {
    fetch("/api/setup")
      .then((r) => r.json())
      .then((s: { ready?: boolean }) => {
        if (s && !s.ready) router.replace("/setup");
      })
      .catch(() => {});
  }, [router]);

  // Fire stale KB auto-compile sweep on mount. Server-side dedupes (5-min debounce).
  useEffect(() => {
    fetch("/api/kb/auto-compile", { method: "POST" }).catch(() => {});
  }, []);

  return (
    <CalendarOverlayProvider>
    <MailOverlayProvider>
    <TodFrame tod={tod} focus={focus}>
      <Masthead tod={tod} />

      <div
        className="grid"
        style={{
          flex: 1,
          gridTemplateColumns: "320px 1fr 340px",
          gap: 56,
          padding: "32px 56px 160px",
          minHeight: 0,
        }}
      >
        <aside
          className="scroll dimmable"
          style={{
            paddingRight: 24,
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
          left: 56,
          right: 56,
          bottom: 28,
          top: agentOpen ? 56 : undefined,
          zIndex: 50,
          display: "flex",
          flexDirection: "column",
          justifyContent: "flex-end",
          alignItems: "stretch",
          gap: 16,
          pointerEvents: "none",
        }}
      >
        <div
          style={{
            pointerEvents: "auto",
            width: "100%",
            display: "flex",
            flexDirection: "column",
            flex: agentOpen ? "1 1 auto" : "0 0 auto",
            minHeight: 0,
            justifyContent: "flex-end",
          }}
        >
          <AgentBar
            variant="wide"
            focus={focus}
            onToggleFocus={toggleFocus}
            open={agentOpen}
            onOpenChange={setAgentOpen}
          />
        </div>
      </div>
    </TodFrame>
    </MailOverlayProvider>
    </CalendarOverlayProvider>
  );
}
