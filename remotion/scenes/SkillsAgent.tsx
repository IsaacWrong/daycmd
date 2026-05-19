import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { Backdrop } from "../components/Backdrop";
import { HomeMockup, AgentDockMini } from "../components/HomeMockup";
import { Glass } from "../components/Glass";
import { Eyebrow } from "../components/Eyebrow";
import { todAt } from "../blend";
import { ACCENTS, FONT_DISPLAY, FONT_MONO, FONT_SANS } from "../palette";

const TOTAL = 180;

export const SkillsAgent: React.FC = () => {
  const f = useCurrentFrame();
  const t = f / TOTAL;
  const palette = todAt(
    [
      { tod: "dusk", at: 0 },
      { tod: "dusk", at: 0.5 },
      { tod: "night", at: 1 },
    ],
    t,
  );

  const homeFade = interpolate(f, [0, 18], [1, 0.18], {
    extrapolateRight: "clamp",
  });

  const cmdJOpacity = interpolate(f, [4, 18, 60, 76], [0, 1, 1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const cmdJScale = interpolate(f, [4, 18], [0.9, 1], {
    extrapolateRight: "clamp",
  });

  const dockExpand = interpolate(f, [20, 50], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const skillOpacity = interpolate(f, [60, 76], [0, 1], {
    extrapolateRight: "clamp",
  });

  const conversation = "Triaging inbox — 4 messages, 2 newsletters, 1 invoice…";
  const charsShown = Math.max(
    0,
    Math.min(
      conversation.length,
      Math.floor((f - 76) * 0.8),
    ),
  );

  const tools: { name: string; from: number }[] = [
    { name: "Gmail · list", from: 80 },
    { name: "Obsidian · write", from: 100 },
    { name: "Calendar · create", from: 122 },
    { name: "Gmail · archive", from: 142 },
  ];

  return (
    <AbsoluteFill>
      <Backdrop palette={palette} />
      <AbsoluteFill style={{ opacity: homeFade }}>
        <HomeMockup
          palette={palette}
          hideAgentDock
          reveal={{
            nav: 1,
            focus: 1,
            dayStrip: 1,
            heatmap: 1,
            rail: 1,
            dock: 1,
          }}
        />
      </AbsoluteFill>

      <AbsoluteFill
        style={{
          padding: "0 64px 28px",
          display: "flex",
          flexDirection: "column",
          justifyContent: "flex-end",
          gap: 16,
        }}
      >
        <div
          style={{
            position: "absolute",
            top: 90,
            left: "50%",
            transform: `translate(-50%, 0) scale(${cmdJScale})`,
            opacity: cmdJOpacity,
          }}
        >
          <Chord palette={palette} keys={["⌘", "J"]} caption="open agent" />
        </div>

        <div
          style={{
            position: "absolute",
            top: 90,
            left: "50%",
            transform: "translate(-50%, 0)",
            opacity: skillOpacity,
          }}
        >
          <Chord palette={palette} keys={["⌘", "1"]} caption="Triage Inbox" accent={ACCENTS.gmail} />
        </div>

        <div style={{ opacity: dockExpand, transform: `translateY(${(1 - dockExpand) * 24}px)` }}>
          <Glass
            palette={palette}
            radius={20}
            style={{
              padding: "22px 24px",
              display: "flex",
              flexDirection: "column",
              gap: 16,
              maxWidth: 1280,
              margin: "0 auto",
              width: "100%",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
              <div
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: "50%",
                  background: `linear-gradient(135deg, ${ACCENTS.agent}, ${ACCENTS.obsidian})`,
                }}
              />
              <Eyebrow palette={palette}>Agent · category: almanac · Opus 4.7</Eyebrow>
              <div
                style={{
                  marginLeft: "auto",
                  display: "flex",
                  gap: 8,
                }}
              >
                <span
                  style={{
                    padding: "4px 10px",
                    borderRadius: 999,
                    background: `oklch(from ${ACCENTS.good} l c h / 0.18)`,
                    color: ACCENTS.good,
                    fontSize: 11,
                    letterSpacing: "0.02em",
                  }}
                >
                  streaming
                </span>
              </div>
            </div>
            <div
              style={{
                background: `oklch(from ${palette.fg} l c h / 0.04)`,
                border: `1px solid ${palette.rule}`,
                borderRadius: 12,
                padding: "14px 16px",
                fontFamily: FONT_SANS,
                fontSize: 15,
                color: palette.fg,
                minHeight: 56,
                letterSpacing: "-0.005em",
              }}
            >
              {conversation.slice(0, charsShown)}
              <span
                style={{
                  display: "inline-block",
                  width: 7,
                  height: 16,
                  background: palette.fg,
                  verticalAlign: "-3px",
                  marginLeft: 2,
                  opacity:
                    charsShown < conversation.length &&
                    Math.floor(f / 8) % 2 === 0
                      ? 0.85
                      : 0,
                }}
              />
            </div>

            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {tools.map((tool) => {
                const local = f - tool.from;
                const on = local >= 0;
                const flash = local >= 0 && local < 12;
                const op = interpolate(local, [0, 8], [0, 1], {
                  extrapolateLeft: "clamp",
                  extrapolateRight: "clamp",
                });
                return (
                  <div
                    key={tool.name}
                    style={{
                      opacity: on ? op : 0,
                      padding: "6px 12px",
                      borderRadius: 999,
                      fontFamily: FONT_MONO,
                      fontSize: 12,
                      background: flash
                        ? `oklch(from ${ACCENTS.agent} l c h / 0.24)`
                        : `oklch(from ${palette.fg} l c h / 0.06)`,
                      border: `1px solid ${flash ? ACCENTS.agent : palette.rule}`,
                      color: palette.fg,
                      transition: "all 0.2s",
                      letterSpacing: "0.01em",
                    }}
                  >
                    {tool.name}
                  </div>
                );
              })}
            </div>
          </Glass>
        </div>

        <AgentDockMini
          palette={palette}
          progress={1}
          prompt="Triage Inbox · ⌘1 fired"
        />
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

const Chord: React.FC<{
  palette: ReturnType<typeof todAt>;
  keys: string[];
  caption: string;
  accent?: string;
}> = ({ palette, keys, caption, accent }) => {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 14,
      }}
    >
      <div style={{ display: "flex", gap: 12 }}>
        {keys.map((k) => (
          <div
            key={k}
            style={{
              minWidth: 84,
              height: 84,
              padding: "0 14px",
              borderRadius: 18,
              background: palette.glass,
              backdropFilter: "blur(28px) saturate(180%)",
              border: `1px solid ${palette.glassBd}`,
              boxShadow: `inset 0 1px 0 ${palette.glassHl}, 0 18px 40px ${palette.glassSh}`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontFamily: FONT_DISPLAY,
              fontSize: 46,
              fontWeight: 600,
              letterSpacing: "-0.04em",
              color: palette.fg,
            }}
          >
            {k}
          </div>
        ))}
      </div>
      <div
        style={{
          fontFamily: FONT_SANS,
          fontSize: 14,
          color: accent ?? palette.fgSoft,
          letterSpacing: "0.02em",
          textTransform: "uppercase",
          fontWeight: 500,
        }}
      >
        {caption}
      </div>
    </div>
  );
};
