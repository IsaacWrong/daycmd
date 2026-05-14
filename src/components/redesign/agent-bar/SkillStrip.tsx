import { SKILLS, type SkillDef } from "@/lib/skills-defs";
import { RUN_SKILL_EVENT } from "../useAgent";

export const HOTKEY_LABELS = ["⌘1", "⌘2", "⌘3", "⌘4", "⌘5", "⌘6"];

export function SkillStrip({
  category,
  variant = "row",
}: {
  category?: string;
  variant?: "row" | "workspace";
}) {
  const items = category
    ? SKILLS.filter((s) => !s.category || s.category === category).slice(0, 6)
    : SKILLS.slice(0, 6);

  function run(s: SkillDef) {
    window.dispatchEvent(new CustomEvent<SkillDef>(RUN_SKILL_EVENT, { detail: s }));
  }

  const containerStyle: React.CSSProperties =
    variant === "workspace"
      ? {
          padding: "10px 0",
          borderTop: "1px solid var(--rule)",
          borderBottom: "1px solid var(--rule)",
          marginBottom: 16,
        }
      : {};

  return (
    <div
      className="flex items-center justify-center text-[12px] flex-wrap"
      style={containerStyle}
    >
      {items.map((s, i) => (
        <div key={s.id} className="flex items-center" style={{ flexShrink: 0 }}>
          {i > 0 && (
            <span
              className="inline-block"
              style={{
                width: 1,
                height: 11,
                background: "var(--rule)",
                margin: "0 14px",
                flexShrink: 0,
              }}
            />
          )}
          <button
            type="button"
            onClick={() => run(s)}
            className="inline-flex items-center gap-2 hover:text-fg"
            style={{
              background: "transparent",
              border: 0,
              padding: 0,
              fontSize: 12,
              color: "var(--fg-soft)",
              cursor: "pointer",
              letterSpacing: "-0.005em",
              whiteSpace: "nowrap",
            }}
          >
            {s.label}
            <span
              className="t-mono"
              style={{ fontSize: 10, opacity: 0.6 }}
            >
              {HOTKEY_LABELS[i]}
            </span>
          </button>
        </div>
      ))}
    </div>
  );
}
