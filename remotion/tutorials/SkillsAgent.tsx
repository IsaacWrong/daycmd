import { interpolate, useCurrentFrame } from "remotion";
import { BrowserFrame } from "../components/BrowserFrame";
import { Glass } from "../components/Glass";
import { Eyebrow } from "../components/Eyebrow";
import { ACCENTS, FONT_DISPLAY, FONT_MONO, FONT_SANS, TOD } from "../palette";
import { KeyChip, StatusPill, TutorialFrame } from "./Common";

export const SkillsAgentTutorial: React.FC = () => {
  const f = useCurrentFrame();
  const palette = TOD.dusk;

  const cmdJOpacity = interpolate(f, [10, 26, 60, 76], [0, 1, 1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const dockExpand = interpolate(f, [40, 70], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const cmd1Opacity = interpolate(f, [80, 96, 140, 156], [0, 1, 1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const conversation =
    "Triaging 4 inbox messages: archived 2 newsletters, drafted reply to Stripe invoice, kept GitHub PR notification.";
  const charsShown = Math.max(
    0,
    Math.min(conversation.length, Math.floor((f - 160) * 0.85)),
  );

  const tools: { name: string; from: number }[] = [
    { name: "Gmail · list(unread)", from: 170 },
    { name: "Gmail · archive(2)", from: 200 },
    { name: "Obsidian · write(daily)", from: 230 },
    { name: "Gmail · draft(reply)", from: 260 },
  ];

  return (
    <TutorialFrame
      palette={palette}
      eyebrow="Tutorial · 12s · agent"
      title="⌘J opens, ⌘1 fires a skill."
      footer={
        <span>
          Skills <span style={{ fontFamily: FONT_MONO }}>⌘1</span>–
          <span style={{ fontFamily: FONT_MONO }}>⌘6</span> · Triage · Brief ·
          Plan · Lint · Review · Compile. Each streams Opus 4.7 by default.
        </span>
      }
    >
      <div style={{ position: "relative", width: 1280, height: 580 }}>
        <BrowserFrame
          palette={palette}
          url="localhost:3000"
          style={{ width: "100%", height: "100%" }}
        >
          <div style={{ padding: "24px 28px", color: palette.fg }}>
            <Eyebrow palette={palette}>Inbox · 4 unread</Eyebrow>
            <div
              style={{
                marginTop: 10,
                display: "flex",
                flexDirection: "column",
                gap: 6,
              }}
            >
              {[
                { from: "Stripe", subject: "Monthly invoice ready" },
                { from: "noreply", subject: "Substack: weekly digest" },
                {
                  from: "GitHub",
                  subject: "@octocat opened pull request #214",
                },
                { from: "noreply", subject: "Newsletter: dev tooling weekly" },
              ].map((m, i) => (
                <div
                  key={i}
                  style={{
                    padding: "10px 12px",
                    borderRadius: 8,
                    border: `1px solid ${palette.rule}`,
                    background: `oklch(from ${palette.fg} l c h / 0.03)`,
                    display: "flex",
                    gap: 14,
                    alignItems: "center",
                    fontSize: 13,
                  }}
                >
                  <span
                    style={{
                      width: 60,
                      color: palette.fgSoft,
                      fontFamily: FONT_MONO,
                      fontSize: 11,
                    }}
                  >
                    {m.from}
                  </span>
                  <span>{m.subject}</span>
                </div>
              ))}
            </div>

            <div
              style={{
                position: "absolute",
                left: 22,
                right: 22,
                bottom: 22,
                opacity: dockExpand,
                transform: `translateY(${(1 - dockExpand) * 24}px)`,
              }}
            >
              <Glass
                palette={palette}
                radius={16}
                style={{
                  padding: "14px 18px",
                  display: "flex",
                  flexDirection: "column",
                  gap: 12,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                  <div
                    style={{
                      width: 24,
                      height: 24,
                      borderRadius: "50%",
                      background: `linear-gradient(135deg, ${ACCENTS.agent}, ${ACCENTS.obsidian})`,
                    }}
                  />
                  <Eyebrow palette={palette}>Agent · Opus 4.7</Eyebrow>
                  {f >= 170 ? (
                    <StatusPill
                      palette={palette}
                      tone="good"
                      style={{ marginLeft: "auto" }}
                    >
                      streaming
                    </StatusPill>
                  ) : null}
                </div>
                {f >= 160 ? (
                  <div
                    style={{
                      background: `oklch(from ${palette.fg} l c h / 0.05)`,
                      border: `1px solid ${palette.rule}`,
                      borderRadius: 10,
                      padding: "12px 14px",
                      fontSize: 14,
                      color: palette.fg,
                      minHeight: 42,
                      fontFamily: FONT_SANS,
                    }}
                  >
                    {conversation.slice(0, charsShown)}
                    <span
                      style={{
                        display: "inline-block",
                        width: 6,
                        height: 14,
                        background: palette.fg,
                        verticalAlign: "-2px",
                        marginLeft: 2,
                        opacity:
                          charsShown < conversation.length &&
                          Math.floor(f / 8) % 2 === 0
                            ? 0.85
                            : 0,
                      }}
                    />
                  </div>
                ) : null}
                <div
                  style={{ display: "flex", gap: 6, flexWrap: "wrap" }}
                >
                  {tools.map((tool) => {
                    const on = f >= tool.from;
                    const flash = f >= tool.from && f < tool.from + 14;
                    return (
                      <span
                        key={tool.name}
                        style={{
                          opacity: on ? 1 : 0,
                          padding: "4px 10px",
                          borderRadius: 999,
                          fontFamily: FONT_MONO,
                          fontSize: 11,
                          background: flash
                            ? `oklch(from ${ACCENTS.agent} l c h / 0.24)`
                            : `oklch(from ${palette.fg} l c h / 0.06)`,
                          border: `1px solid ${flash ? ACCENTS.agent : palette.rule}`,
                          color: palette.fg,
                          transition: "all 0.2s",
                        }}
                      >
                        {tool.name}
                      </span>
                    );
                  })}
                </div>
              </Glass>
            </div>
          </div>
        </BrowserFrame>

        {cmdJOpacity > 0 ? (
          <Chord
            palette={palette}
            keys={["⌘", "J"]}
            caption="open agent dock"
            style={{
              position: "absolute",
              top: 60,
              left: "50%",
              transform: "translateX(-50%)",
              opacity: cmdJOpacity,
            }}
          />
        ) : null}
        {cmd1Opacity > 0 ? (
          <Chord
            palette={palette}
            keys={["⌘", "1"]}
            caption="Triage Inbox"
            accent={ACCENTS.gmail}
            style={{
              position: "absolute",
              top: 60,
              left: "50%",
              transform: "translateX(-50%)",
              opacity: cmd1Opacity,
            }}
          />
        ) : null}
      </div>
    </TutorialFrame>
  );
};

const Chord: React.FC<{
  palette: typeof TOD.dawn;
  keys: string[];
  caption: string;
  accent?: string;
  style?: React.CSSProperties;
}> = ({ palette, keys, caption, accent, style }) => (
  <div
    style={{
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      gap: 10,
      ...style,
    }}
  >
    <div style={{ display: "flex", gap: 10 }}>
      {keys.map((k) => (
        <div
          key={k}
          style={{
            minWidth: 60,
            height: 60,
            padding: "0 12px",
            borderRadius: 14,
            background: palette.glass,
            backdropFilter: "blur(28px) saturate(180%)",
            border: `1px solid ${palette.glassBd}`,
            boxShadow: `inset 0 1px 0 ${palette.glassHl}, 0 14px 30px ${palette.glassSh}`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontFamily: FONT_DISPLAY,
            fontSize: 30,
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
        fontSize: 12,
        color: accent ?? palette.fgSoft,
        letterSpacing: "0.06em",
        textTransform: "uppercase",
        fontWeight: 500,
      }}
    >
      {caption}
    </div>
  </div>
);
