"use client";

import { useCallback, useEffect, useState } from "react";
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
const NAV_W_LS = "daycmd.dashboard.navWidth";
const NAV_MIN = 180;
const NAV_MAX = 480;
const NAV_DEFAULT = 260;
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
  const [agentWidthExpanded, setAgentWidthExpanded] = useState(false);

  useEffect(() => {
    if (agentOpen) {
      setAgentWidthExpanded(true);
      return;
    }
    const t = setTimeout(() => setAgentWidthExpanded(false), 540);
    return () => clearTimeout(t);
  }, [agentOpen]);
  const [section, setSection] = useState<SectionKey>("overview");
  const [navWidth, setNavWidth] = useState<number>(NAV_DEFAULT);
  const [dragging, setDragging] = useState(false);
  const router = useRouter();

  useEffect(() => {
    try {
      const stored = localStorage.getItem(SECTION_LS);
      if (stored && VALID.has(stored as SectionKey)) {
        setSection(stored as SectionKey);
      }
      const w = Number(localStorage.getItem(NAV_W_LS));
      if (Number.isFinite(w) && w >= NAV_MIN && w <= NAV_MAX) {
        setNavWidth(w);
      }
    } catch {}
  }, []);

  const startResize = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    e.preventDefault();
    const startX = e.clientX;
    const startW = navWidth;
    let armed = false;
    let lastW = startW;
    const THRESHOLD = 3;

    const onMove = (ev: PointerEvent) => {
      const dx = ev.clientX - startX;
      if (!armed) {
        if (Math.abs(dx) < THRESHOLD) return;
        armed = true;
        setDragging(true);
        document.body.style.cursor = "col-resize";
        document.body.style.userSelect = "none";
      }
      lastW = Math.min(NAV_MAX, Math.max(NAV_MIN, startW + dx));
      setNavWidth(lastW);
    };
    const onUp = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      setDragging(false);
      if (armed) {
        try { localStorage.setItem(NAV_W_LS, String(lastW)); } catch {}
      }
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
  }, [navWidth]);

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
          gridTemplateColumns: `${navWidth}px 1fr`,
          gap: 40,
          padding: "20px 56px 140px",
          minHeight: 0,
        }}
      >
        <aside
          className="scroll dimmable"
          style={{
            position: "relative",
            overflowY: "auto",
            overflowX: "hidden",
            minWidth: 0,
            paddingRight: 16,
            borderRight: "1px solid var(--rule)",
          }}
        >
          <DashboardNav selected={section} onSelect={selectSection} />
          <div
            className="nav-resizer"
            data-dragging={dragging ? "true" : "false"}
            role="separator"
            aria-orientation="vertical"
            aria-label="Resize sidebar"
            onPointerDown={startResize}
            style={{
              position: "absolute",
              top: 0,
              bottom: 0,
              right: -4,
              width: 8,
              cursor: "col-resize",
              touchAction: "none",
              zIndex: 5,
            }}
          />
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
              overflowX: "hidden",
              paddingTop: 24,
              paddingRight: 8,
              flex: 1,
              minHeight: 0,
            }}
          >
            <div key={section} className="section-view-enter">
              <SectionView k={section} onJump={selectSection} />
            </div>
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
          top: agentWidthExpanded ? 56 : undefined,
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
            maxWidth: agentWidthExpanded ? "70%" : "100%",
            alignSelf: agentWidthExpanded ? "center" : "stretch",
            display: "flex",
            flexDirection: "column",
            flex: agentWidthExpanded ? "1 1 auto" : "0 0 auto",
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
