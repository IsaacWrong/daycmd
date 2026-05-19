import { interpolate, useCurrentFrame } from "remotion";
import { BrowserFrame } from "../components/BrowserFrame";
import { Glass } from "../components/Glass";
import { Eyebrow } from "../components/Eyebrow";
import { ACCENTS, FONT_DISPLAY, FONT_MONO, FONT_SANS, TOD } from "../palette";
import { Caret, StatusPill, TutorialFrame } from "./Common";

export const BudgetCapTutorial: React.FC = () => {
  const f = useCurrentFrame();
  const palette = TOD.morning;

  const capValue = (() => {
    if (f < 70) return "$0";
    const local = Math.max(0, Math.min(40, f - 70));
    const partials = ["$1", "$1", "$10"];
    if (local < 14) return partials[0]!;
    if (local < 28) return partials[1]!;
    return partials[2]!;
  })();

  const warnVal = interpolate(f, [120, 160], [75, 80], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const savePulse = f >= 175 && f < 195;
  const saved = f >= 195;

  return (
    <TutorialFrame
      palette={palette}
      eyebrow="Tutorial · 8s · safety"
      title="set a budget cap first."
      footer={
        <span>
          Hard cap blocks new agent runs once exceeded. Default{" "}
          <span style={{ fontFamily: FONT_MONO }}>$0</span> = unlimited.
        </span>
      }
    >
      <BrowserFrame
        palette={palette}
        url="localhost:3000/settings"
        style={{ width: 980 }}
      >
        <div style={{ padding: "26px 30px 30px" }}>
          <Eyebrow palette={palette}>Anthropic spend</Eyebrow>
          <div
            style={{
              fontFamily: FONT_DISPLAY,
              fontSize: 24,
              letterSpacing: "-0.03em",
              fontWeight: 600,
              marginTop: 6,
              color: palette.fg,
            }}
          >
            Daily cap
          </div>
          <div
            style={{
              fontSize: 13,
              color: palette.fgSoft,
              marginTop: 6,
              marginBottom: 18,
            }}
          >
            Stop new agent runs after this much spend on Anthropic API calls.
          </div>

          <Glass
            palette={palette}
            style={{ padding: "20px 24px", marginBottom: 14 }}
            radius={14}
          >
            <Eyebrow palette={palette}>Daily cap (USD)</Eyebrow>
            <div
              style={{
                display: "flex",
                alignItems: "baseline",
                gap: 12,
                marginTop: 8,
              }}
            >
              <span
                style={{
                  fontFamily: FONT_MONO,
                  fontSize: 48,
                  letterSpacing: "-0.02em",
                  color:
                    capValue === "$0"
                      ? ACCENTS.error
                      : palette.fg,
                  fontVariantNumeric: "tabular-nums",
                }}
              >
                {capValue}
                {f >= 60 && f < 168 ? <Caret palette={palette} /> : null}
              </span>
              {capValue === "$0" ? (
                <StatusPill palette={palette} tone="warn">
                  no cap · unlimited spend
                </StatusPill>
              ) : (
                <StatusPill palette={palette} tone="good">
                  cap active
                </StatusPill>
              )}
            </div>
          </Glass>

          <Glass
            palette={palette}
            style={{ padding: "16px 24px" }}
            radius={14}
          >
            <Eyebrow palette={palette}>Warn at</Eyebrow>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 14,
                marginTop: 10,
              }}
            >
              <span
                style={{
                  fontFamily: FONT_MONO,
                  fontSize: 22,
                  color: palette.fg,
                  width: 64,
                  fontVariantNumeric: "tabular-nums",
                }}
              >
                {Math.round(warnVal)}%
              </span>
              <div
                style={{
                  flex: 1,
                  height: 6,
                  borderRadius: 999,
                  background: `oklch(from ${palette.fg} l c h / 0.08)`,
                  position: "relative",
                }}
              >
                <div
                  style={{
                    position: "absolute",
                    left: 0,
                    top: 0,
                    bottom: 0,
                    width: `${warnVal}%`,
                    borderRadius: 999,
                    background: ACCENTS.tasks,
                  }}
                />
                <div
                  style={{
                    position: "absolute",
                    left: `calc(${warnVal}% - 8px)`,
                    top: -6,
                    width: 16,
                    height: 16,
                    borderRadius: "50%",
                    background: palette.fg,
                    boxShadow: `0 2px 6px ${palette.glassSh}`,
                  }}
                />
              </div>
              <span style={{ fontSize: 11, color: palette.fgSoft }}>
                warn @ ${capValue === "$0" ? "0" : ((+capValue.slice(1) * warnVal) / 100).toFixed(2)}
              </span>
            </div>
          </Glass>

          <div
            style={{
              marginTop: 22,
              display: "flex",
              alignItems: "center",
              justifyContent: "flex-end",
              gap: 14,
            }}
          >
            {saved ? (
              <StatusPill palette={palette} tone="good">
                ✓ saved · cap enforced
              </StatusPill>
            ) : null}
            <div
              style={{
                padding: "10px 22px",
                borderRadius: 8,
                background: saved ? ACCENTS.good : ACCENTS.tasks,
                color: "white",
                fontFamily: FONT_SANS,
                fontSize: 14,
                fontWeight: 500,
                transform: savePulse ? "scale(0.96)" : "scale(1)",
                boxShadow: savePulse
                  ? `0 0 0 4px oklch(from ${ACCENTS.tasks} l c h / 0.25)`
                  : "none",
              }}
            >
              {saved ? "Saved" : "Save"}
            </div>
          </div>
        </div>
      </BrowserFrame>
    </TutorialFrame>
  );
};
