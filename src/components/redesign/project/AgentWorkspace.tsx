"use client";

import { Sun } from "../Glyph";
import { AgentBar, SkillStrip } from "../AgentBar";

export function AgentWorkspace({
  name,
  focus,
  onToggleFocus,
}: {
  name: string;
  focus: boolean;
  onToggleFocus: () => void;
}) {
  return (
    <main
      className="focus-keep flex flex-col"
      style={{ paddingLeft: 18, minHeight: 0 }}
    >
      <div className="flex items-center gap-2 mb-3">
        <span
          className="src-dot src-agent"
          style={{ width: 6, height: 6 }}
        />
        <span className="t-eyebrow">Agent · {name}</span>
        <span
          className="t-mono ml-2"
          style={{ fontSize: 10, color: "var(--fg-soft)" }}
        >
          claude opus 4.7
        </span>
        <span className="flex-1" />
        <button
          type="button"
          onClick={onToggleFocus}
          className="inline-flex items-center gap-1.5 hover:opacity-80"
          style={{
            background: "transparent",
            border: 0,
            padding: "2px 6px",
            fontSize: 11.5,
            cursor: "pointer",
            color: focus ? "var(--c-agent)" : "var(--fg-soft)",
          }}
        >
          <Sun s={11} /> Focus mode {focus ? "on" : "off"}
        </button>
      </div>

      <SkillStrip category={name} variant="workspace" />

      <AgentBar variant="workspace" category={name} focus={focus} onToggleFocus={onToggleFocus} />
    </main>
  );
}
