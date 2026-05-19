import { useCurrentFrame } from "remotion";
import { ACCENTS, FONT_DISPLAY, FONT_MONO, FONT_SANS, type Palette } from "../palette";
import { Glass } from "./Glass";
import { Eyebrow } from "./Eyebrow";

export const HomeMockup: React.FC<{
  palette: Palette;
  reveal: {
    nav: number;
    focus: number;
    dayStrip: number;
    heatmap: number;
    rail: number;
    dock: number;
  };
  hideAgentDock?: boolean;
}> = ({ palette, reveal, hideAgentDock = false }) => {
  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        display: "grid",
        gridTemplateColumns: "240px 1fr",
        columnGap: 36,
        padding: "44px 64px 120px 56px",
        fontFamily: FONT_SANS,
        color: palette.fg,
      }}
    >
      <Nav palette={palette} opacity={reveal.nav} />
      <Main
        palette={palette}
        reveal={reveal}
        hideAgentDock={hideAgentDock}
      />
    </div>
  );
};

const Nav: React.FC<{ palette: Palette; opacity: number }> = ({
  palette,
  opacity,
}) => {
  const items: { label: string; on?: boolean }[] = [
    { label: "Home", on: true },
    { label: "Vault" },
    { label: "Agent" },
    { label: "Knowledge" },
    { label: "Errors" },
    { label: "Automations" },
    { label: "Settings" },
  ];
  const projects = ["sol", "atlas", "ferry", "almanac"];
  return (
    <div style={{ opacity, paddingTop: 6 }}>
      <div
        style={{
          fontFamily: FONT_DISPLAY,
          fontSize: 26,
          letterSpacing: "-0.04em",
          fontWeight: 600,
          marginBottom: 36,
        }}
      >
        daycmd
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        {items.map((it) => (
          <div
            key={it.label}
            style={{
              padding: "8px 12px",
              borderRadius: 8,
              fontSize: 14,
              color: it.on ? palette.fg : palette.fgSoft,
              background: it.on
                ? `oklch(from ${palette.fg} l c h / 0.06)`
                : "transparent",
              letterSpacing: "-0.005em",
            }}
          >
            {it.label}
          </div>
        ))}
      </div>
      <Eyebrow palette={palette} style={{ marginTop: 30, marginBottom: 10, paddingLeft: 12 }}>
        Projects
      </Eyebrow>
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        {projects.map((p) => (
          <div
            key={p}
            style={{
              padding: "6px 12px",
              borderRadius: 8,
              fontSize: 13,
              color: palette.fgSoft,
              fontFamily: FONT_MONO,
            }}
          >
            / {p}
          </div>
        ))}
      </div>
    </div>
  );
};

const Main: React.FC<{
  palette: Palette;
  reveal: {
    focus: number;
    dayStrip: number;
    heatmap: number;
    rail: number;
    dock: number;
  };
  hideAgentDock: boolean;
}> = ({ palette, reveal, hideAgentDock }) => {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "1fr 360px",
        columnGap: 28,
      }}
    >
      <LeftMain palette={palette} reveal={reveal} />
      <RightRail palette={palette} opacity={reveal.rail} />
      {!hideAgentDock ? (
        <AgentDockMini
          palette={palette}
          progress={reveal.dock}
          style={{
            position: "absolute",
            left: 56,
            right: 64,
            bottom: 28,
          }}
        />
      ) : null}
    </div>
  );
};

const LeftMain: React.FC<{
  palette: Palette;
  reveal: { focus: number; dayStrip: number; heatmap: number };
}> = ({ palette, reveal }) => {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
      <Hero palette={palette} />
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          columnGap: 22,
        }}
      >
        <div style={{ opacity: reveal.focus, transform: `translateY(${(1 - reveal.focus) * 10}px)` }}>
          <FocusTile palette={palette} />
        </div>
        <div
          style={{
            opacity: reveal.heatmap,
            transform: `translateY(${(1 - reveal.heatmap) * 10}px)`,
          }}
        >
          <Numbers palette={palette} />
        </div>
      </div>
      <div style={{ opacity: reveal.dayStrip }}>
        <DayStrip palette={palette} />
      </div>
      <div style={{ opacity: reveal.heatmap }}>
        <HeatmapTile palette={palette} reveal={reveal.heatmap} />
      </div>
      <div style={{ opacity: reveal.heatmap }}>
        <TasksTile palette={palette} />
      </div>
    </div>
  );
};

const Hero: React.FC<{ palette: Palette }> = ({ palette }) => {
  return (
    <div style={{ marginTop: 4 }}>
      <Eyebrow palette={palette}>Tuesday · May 19</Eyebrow>
      <div
        style={{
          fontFamily: FONT_DISPLAY,
          fontSize: 64,
          lineHeight: 0.95,
          letterSpacing: "-0.04em",
          fontWeight: 600,
          marginTop: 12,
          color: palette.fg,
        }}
      >
        Good morning.
      </div>
      <div
        style={{
          fontFamily: FONT_SANS,
          fontSize: 18,
          color: palette.fgSoft,
          marginTop: 10,
          letterSpacing: "-0.005em",
        }}
      >
        3 calendar blocks · 11 tasks due · 4 inbox · 2 PRs waiting
      </div>
    </div>
  );
};

const FocusTile: React.FC<{ palette: Palette }> = ({ palette }) => {
  const f = useCurrentFrame();
  const seconds = 25 * 60 - (f % (25 * 60));
  const mm = Math.floor(seconds / 60)
    .toString()
    .padStart(2, "0");
  const ss = (seconds % 60).toString().padStart(2, "0");
  return (
    <Glass palette={palette} style={{ padding: "20px 22px" }}>
      <Eyebrow palette={palette}>Focus</Eyebrow>
      <div
        style={{
          fontFamily: FONT_MONO,
          fontSize: 46,
          letterSpacing: "-0.02em",
          fontVariantNumeric: "tabular-nums",
          marginTop: 8,
          color: palette.fg,
        }}
      >
        {mm}:{ss}
      </div>
      <div
        style={{
          marginTop: 14,
          display: "flex",
          gap: 8,
          alignItems: "center",
        }}
      >
        <span
          style={{
            padding: "5px 10px",
            fontSize: 11,
            borderRadius: 6,
            background: `oklch(from ${ACCENTS.tasks} l c h / 0.16)`,
            color: ACCENTS.tasks,
            letterSpacing: "0.02em",
          }}
        >
          almanac · readme polish
        </span>
        <span style={{ fontSize: 11, color: palette.fgSoft }}>
          3 / 4 today
        </span>
      </div>
    </Glass>
  );
};

const Numbers: React.FC<{ palette: Palette }> = ({ palette }) => {
  const rows: { label: string; value: string }[] = [
    { label: "Tokens", value: "412k" },
    { label: "Tasks closed", value: "7" },
    { label: "Commits", value: "12" },
    { label: "Note words", value: "1,840" },
  ];
  return (
    <Glass palette={palette} style={{ padding: "20px 22px" }}>
      <Eyebrow palette={palette}>Today in numbers</Eyebrow>
      <div
        style={{
          marginTop: 10,
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          rowGap: 10,
          columnGap: 14,
        }}
      >
        {rows.map((r) => (
          <div key={r.label}>
            <div
              style={{
                fontFamily: FONT_MONO,
                fontSize: 22,
                letterSpacing: "-0.02em",
                color: palette.fg,
                fontVariantNumeric: "tabular-nums",
              }}
            >
              {r.value}
            </div>
            <div
              style={{
                fontSize: 11,
                color: palette.fgSoft,
                letterSpacing: "0.04em",
                textTransform: "uppercase",
              }}
            >
              {r.label}
            </div>
            <Sparkline palette={palette} />
          </div>
        ))}
      </div>
    </Glass>
  );
};

const Sparkline: React.FC<{ palette: Palette }> = ({ palette }) => {
  const points = [4, 6, 3, 7, 5, 8, 6, 9, 7, 10, 8, 11];
  const w = 120;
  const h = 22;
  const max = Math.max(...points);
  const step = w / (points.length - 1);
  const d = points
    .map(
      (p, i) =>
        `${i === 0 ? "M" : "L"} ${i * step} ${h - (p / max) * (h - 2) - 1}`,
    )
    .join(" ");
  return (
    <svg width={w} height={h} style={{ marginTop: 4, display: "block" }}>
      <path
        d={d}
        fill="none"
        stroke={`oklch(from ${palette.fg} l c h / 0.45)`}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
};

const DayStrip: React.FC<{ palette: Palette }> = ({ palette }) => {
  const blocks: { start: number; len: number; color: string; label: string }[] = [
    { start: 0.05, len: 0.12, color: ACCENTS.calendar, label: "standup" },
    { start: 0.22, len: 0.18, color: ACCENTS.tasks, label: "almanac polish" },
    { start: 0.45, len: 0.08, color: ACCENTS.calendar, label: "1:1" },
    { start: 0.6, len: 0.15, color: ACCENTS.agent, label: "kb compile" },
    { start: 0.82, len: 0.12, color: ACCENTS.calendar, label: "review" },
  ];
  const now = 0.38;
  return (
    <div>
      <Eyebrow palette={palette} style={{ marginBottom: 8 }}>
        Today · 09:00 → 18:00
      </Eyebrow>
      <div
        style={{
          position: "relative",
          height: 40,
          background: `oklch(from ${palette.fg} l c h / 0.04)`,
          border: `1px solid ${palette.rule}`,
          borderRadius: 8,
        }}
      >
        {blocks.map((b, i) => (
          <div
            key={i}
            style={{
              position: "absolute",
              top: 4,
              bottom: 4,
              left: `calc(${b.start * 100}% + 2px)`,
              width: `calc(${b.len * 100}% - 4px)`,
              background: `oklch(from ${b.color} l c h / 0.30)`,
              borderLeft: `2px solid ${b.color}`,
              borderRadius: 4,
              paddingLeft: 8,
              display: "flex",
              alignItems: "center",
              fontSize: 11,
              color: palette.fg,
              overflow: "hidden",
              whiteSpace: "nowrap",
            }}
          >
            {b.label}
          </div>
        ))}
        <div
          style={{
            position: "absolute",
            top: -4,
            bottom: -4,
            left: `${now * 100}%`,
            width: 2,
            background: palette.fg,
            opacity: 0.85,
          }}
        />
        <div
          style={{
            position: "absolute",
            bottom: -7,
            left: `calc(${now * 100}% - 5px)`,
            width: 10,
            height: 10,
            borderRadius: "50%",
            background: palette.fg,
          }}
        />
      </div>
    </div>
  );
};

const HeatmapTile: React.FC<{ palette: Palette; reveal: number }> = ({
  palette,
  reveal,
}) => {
  const days = 14;
  const repos = 5;
  const cells: number[][] = [];
  for (let r = 0; r < repos; r++) {
    const row: number[] = [];
    for (let c = 0; c < days; c++) {
      const v = Math.max(0, Math.sin((r + 1) * 1.7 + c * 0.9) * 0.5 + 0.5);
      row.push(v);
    }
    cells.push(row);
  }
  const totalCells = days * repos;
  const visibleCells = Math.floor(reveal * totalCells);
  return (
    <Glass palette={palette} style={{ padding: "18px 22px" }}>
      <Eyebrow palette={palette}>Last 14 days · 5 repos</Eyebrow>
      <div
        style={{
          marginTop: 10,
          display: "grid",
          gridTemplateColumns: `repeat(${days}, 1fr)`,
          gridTemplateRows: `repeat(${repos}, 22px)`,
          gap: 4,
        }}
      >
        {cells.flatMap((row, r) =>
          row.map((v, c) => {
            const idx = r * days + c;
            const shown = idx < visibleCells;
            const a = shown ? 0.08 + v * 0.6 : 0.04;
            return (
              <div
                key={`${r}-${c}`}
                style={{
                  background: `oklch(from ${ACCENTS.tasks} l c h / ${a})`,
                  borderRadius: 3,
                }}
              />
            );
          }),
        )}
      </div>
    </Glass>
  );
};

const TasksTile: React.FC<{ palette: Palette }> = ({ palette }) => {
  const tasks: { text: string; due: string; pri?: boolean; done?: boolean }[] = [
    { text: "ship hero video to README", due: "today", pri: true },
    { text: "review #214 KB compile bug", due: "today" },
    { text: "draft sponsor section", due: "tmrw" },
    { text: "archive Q1 receipts", due: "fri", done: true },
  ];
  return (
    <Glass palette={palette} style={{ padding: "18px 22px" }}>
      <Eyebrow palette={palette}>Tasks · Today</Eyebrow>
      <div
        style={{
          marginTop: 10,
          display: "flex",
          flexDirection: "column",
          gap: 8,
        }}
      >
        {tasks.map((t, i) => (
          <div
            key={i}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              fontSize: 13,
              color: t.done ? palette.fgSoft : palette.fg,
            }}
          >
            <div
              style={{
                width: 14,
                height: 14,
                borderRadius: 4,
                border: `1.5px solid ${
                  t.done ? ACCENTS.good : palette.fgSoft
                }`,
                background: t.done ? ACCENTS.good : "transparent",
              }}
            />
            <span
              style={{
                textDecoration: t.done ? "line-through" : "none",
                opacity: t.done ? 0.6 : 1,
              }}
            >
              {t.text}
            </span>
            {t.pri ? (
              <span
                style={{
                  marginLeft: 4,
                  fontSize: 10,
                  letterSpacing: "0.06em",
                  textTransform: "uppercase",
                  color: ACCENTS.error,
                  padding: "2px 6px",
                  borderRadius: 4,
                  background: `oklch(from ${ACCENTS.error} l c h / 0.12)`,
                }}
              >
                priority
              </span>
            ) : null}
            <span
              style={{
                marginLeft: "auto",
                fontSize: 11,
                color: palette.fgSoft,
                fontFamily: FONT_MONO,
              }}
            >
              {t.due}
            </span>
          </div>
        ))}
      </div>
    </Glass>
  );
};

const RightRail: React.FC<{ palette: Palette; opacity: number }> = ({
  palette,
  opacity,
}) => {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 16,
        opacity,
        transform: `translateX(${(1 - opacity) * 8}px)`,
      }}
    >
      <RailSection
        palette={palette}
        title="Calendar"
        accent={ACCENTS.calendar}
        rows={[
          { primary: "Standup", meta: "9:30 · Daily" },
          { primary: "Pair w/ Maya", meta: "11:00 · Almanac" },
          { primary: "Roadmap review", meta: "14:00 · Internal" },
        ]}
      />
      <RailSection
        palette={palette}
        title="Inbox · 4"
        accent={ACCENTS.gmail}
        rows={[
          { primary: "Stripe", meta: "Monthly invoice ready" },
          { primary: "GitHub", meta: "@octocat opened #214" },
          { primary: "Vercel", meta: "Build succeeded" },
        ]}
      />
      <RailSection
        palette={palette}
        title="PRs"
        accent={ACCENTS.github}
        rows={[
          { primary: "#214 KB compile race", meta: "waiting on you" },
          { primary: "#211 fix sparkline", meta: "ci green" },
        ]}
      />
      <RailSection
        palette={palette}
        title="Knowledge"
        accent={ACCENTS.agent}
        rows={[
          { primary: "almanac", meta: "compiled · 06:00 ✓" },
          { primary: "atlas", meta: "drift · 3 new raw" },
          { primary: "ferry", meta: "compiled · 06:00 ✓" },
        ]}
      />
    </div>
  );
};

const RailSection: React.FC<{
  palette: Palette;
  title: string;
  accent: string;
  rows: { primary: string; meta: string }[];
}> = ({ palette, title, accent, rows }) => {
  return (
    <div>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          marginBottom: 8,
        }}
      >
        <div
          style={{
            width: 6,
            height: 6,
            borderRadius: "50%",
            background: accent,
          }}
        />
        <div
          style={{
            fontSize: 10,
            letterSpacing: "0.12em",
            textTransform: "uppercase",
            color: palette.fgSoft,
          }}
        >
          {title}
        </div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {rows.map((r, i) => (
          <div
            key={i}
            style={{
              padding: "8px 10px",
              borderRadius: 8,
              background: `oklch(from ${palette.fg} l c h / 0.03)`,
              border: `1px solid ${palette.rule}`,
            }}
          >
            <div style={{ fontSize: 12, color: palette.fg }}>{r.primary}</div>
            <div
              style={{
                fontSize: 11,
                color: palette.fgSoft,
                marginTop: 2,
              }}
            >
              {r.meta}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export const AgentDockMini: React.FC<{
  palette: Palette;
  progress: number;
  expanded?: boolean;
  style?: React.CSSProperties;
  prompt?: string;
}> = ({ palette, progress, expanded = false, style, prompt }) => {
  const skills = ["Triage", "Brief", "Plan", "Lint", "Review", "Compile"];
  return (
    <div
      style={{
        ...style,
        opacity: progress,
        transform: `translateY(${(1 - progress) * 30}px)`,
      }}
    >
      <Glass
        palette={palette}
        radius={16}
        style={{
          padding: expanded ? "16px 18px 18px" : "12px 18px",
          display: "flex",
          flexDirection: "column",
          gap: 12,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div
            style={{
              width: 26,
              height: 26,
              borderRadius: "50%",
              background: `linear-gradient(135deg, ${ACCENTS.agent}, ${ACCENTS.obsidian})`,
              flexShrink: 0,
            }}
          />
          <div
            style={{
              flex: 1,
              fontFamily: FONT_SANS,
              fontSize: 14,
              color: prompt ? palette.fg : palette.fgSoft,
              letterSpacing: "-0.005em",
            }}
          >
            {prompt || "ask Claude · ⌘J to expand"}
          </div>
          {skills.map((s, i) => (
            <div
              key={s}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                padding: "5px 10px",
                borderRadius: 999,
                background: `oklch(from ${palette.fg} l c h / 0.05)`,
                border: `1px solid ${palette.rule}`,
              }}
            >
              <span
                style={{
                  fontFamily: FONT_MONO,
                  fontSize: 10,
                  color: palette.fgSoft,
                }}
              >
                ⌘{i + 1}
              </span>
              <span
                style={{
                  fontSize: 11,
                  color: palette.fg,
                  letterSpacing: "-0.005em",
                }}
              >
                {s}
              </span>
            </div>
          ))}
        </div>
      </Glass>
    </div>
  );
};
