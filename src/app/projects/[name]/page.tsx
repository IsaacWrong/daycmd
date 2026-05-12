"use client";

import { use } from "react";
import { useFocusMode, useTod, TodFrame } from "@/components/redesign/TodFrame";
import { ProjectMasthead } from "@/components/redesign/project/ProjectMasthead";
import { ProjectHero } from "@/components/redesign/project/ProjectHero";
import { ProjectLeft } from "@/components/redesign/project/ProjectLeft";
import { AgentWorkspace } from "@/components/redesign/project/AgentWorkspace";

export default function ProjectPage({
  params,
}: {
  params: Promise<{ name: string }>;
}) {
  const { name } = use(params);
  const decoded = decodeURIComponent(name);
  const tod = useTod();
  const [focus, toggleFocus] = useFocusMode();

  return (
    <TodFrame tod={tod} focus={focus}>
      <ProjectMasthead name={decoded} />
      <ProjectHero name={decoded} />

      <div
        className="grid"
        style={{
          flex: 1,
          gridTemplateColumns: "440px 1fr",
          gap: 40,
          padding: "8px 48px 28px",
          minHeight: 0,
        }}
      >
        <ProjectLeft name={decoded} />
        <AgentWorkspace name={decoded} focus={focus} onToggleFocus={toggleFocus} />
      </div>
    </TodFrame>
  );
}
