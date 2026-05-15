"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useFocusMode, useTod, TodFrame } from "@/components/redesign/TodFrame";
import { Masthead } from "@/components/redesign/Masthead";
import { NowHero } from "@/components/redesign/NowHero";
import { TaskList } from "@/components/redesign/TaskList";
import { DailyNotePreview } from "@/components/redesign/DailyNotePreview";
import {
  CalendarSection,
  InboxSection,
  GitHubSection,
  ErrorsSection,
  KnowledgeSection,
} from "@/components/redesign/RightStreams";
import {
  ProjectsList,
  Streaks,
} from "@/components/redesign/LeftSpineSections";
import { Heatmap } from "@/components/redesign/Heatmap";
import { SectionMini } from "@/components/redesign/Section";
import {
  DashboardNav,
  type SectionKey,
  SECTIONS,
} from "@/components/redesign/DashboardNav";
import { Overview } from "@/components/redesign/Overview";
import { AgentBar } from "@/components/redesign/AgentBar";
import { CalendarOverlayProvider } from "@/components/calendar/CalendarOverlayProvider";
import { MailOverlayProvider } from "@/components/mail/MailOverlayProvider";

const SECTION_LS = "daycmd.dashboard.section";
const VALID = new Set<SectionKey>(SECTIONS.map((s) => s.key));

function SectionView({
  k,
  onJump,
}: {
  k: SectionKey;
  onJump: (key: SectionKey) => void;
}) {
  switch (k) {
    case "overview":
      return <Overview onJump={onJump} />;
    case "tasks":
      return <TaskList />;
    case "note":
      return <DailyNotePreview />;
    case "calendar":
      return <CalendarSection />;
    case "mail":
      return <InboxSection />;
    case "github":
      return (
        <>
          <GitHubSection />
          <SectionMini title="Last 14 days · commits" accent="github">
            <Heatmap />
          </SectionMini>
          <Streaks />
          <ProjectsList />
        </>
      );
    case "errors":
      return <ErrorsSection />;
    case "knowledge":
      return <KnowledgeSection />;
  }
}

export default function Home() {
  const tod = useTod();
  const [focus, toggleFocus] = useFocusMode();
  const [agentOpen, setAgentOpen] = useState(false);
  const [section, setSection] = useState<SectionKey>("overview");
  const router = useRouter();

  useEffect(() => {
    try {
      const stored = localStorage.getItem(SECTION_LS);
      if (stored && VALID.has(stored as SectionKey)) {
        setSection(stored as SectionKey);
      }
    } catch {}
  }, []);

  function selectSection(k: SectionKey) {
    setSection(k);
    try {
      localStorage.setItem(SECTION_LS, k);
    } catch {}
  }

  useEffect(() => {
    fetch("/api/setup")
      .then((r) => r.json())
      .then((s: { ready?: boolean }) => {
        if (s && !s.ready) router.replace("/setup");
      })
      .catch(() => {});
  }, [router]);

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
          gridTemplateColumns: "minmax(220px, 1fr) 4fr",
          gap: 40,
          padding: "20px 56px 140px",
          minHeight: 0,
        }}
      >
        <aside
          className="scroll dimmable"
          style={{
            overflowY: "auto",
            paddingRight: 16,
            borderRight: "1px solid var(--rule)",
          }}
        >
          <DashboardNav selected={section} onSelect={selectSection} />
        </aside>

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            minHeight: 0,
            minWidth: 0,
          }}
        >
          <div className="dimmable" style={{ paddingBottom: 4 }}>
            <NowHero />
          </div>
          <section
            className="scroll dimmable"
            style={{
              overflowY: "auto",
              paddingTop: 24,
              paddingRight: 8,
              flex: 1,
              minHeight: 0,
            }}
          >
            <SectionView k={section} onJump={selectSection} />
          </section>
        </div>
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
            maxWidth: agentOpen ? "70%" : "100%",
            alignSelf: agentOpen ? "center" : "stretch",
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
