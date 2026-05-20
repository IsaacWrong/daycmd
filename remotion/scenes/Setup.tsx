import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { Backdrop } from "../components/Backdrop";
import { BrowserFrame } from "../components/BrowserFrame";
import { Terminal } from "../components/Terminal";
import { Eyebrow } from "../components/Eyebrow";
import { FONT_DISPLAY, FONT_MONO, FONT_SANS, TOD, ACCENTS } from "../palette";
import { mixPalettes } from "../blend";

export const Setup: React.FC = () => {
  const f = useCurrentFrame();
  const t = Math.min(1, f / 180);
  const palette = mixPalettes(TOD.dawn, TOD.morning, t);

  const titleOpacity = interpolate(f, [0, 16], [0, 1], {
    extrapolateRight: "clamp",
  });
  const terminalOpacity = interpolate(f, [4, 20], [0, 1], {
    extrapolateRight: "clamp",
  });
  const terminalShift = interpolate(f, [4, 20], [16, 0], {
    extrapolateRight: "clamp",
  });

  const browserOpacity = interpolate(f, [105, 130], [0, 1], {
    extrapolateRight: "clamp",
  });
  const browserShift = interpolate(f, [105, 130], [40, 0], {
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill>
      <Backdrop palette={palette} />
      <AbsoluteFill
        style={{
          padding: "70px 96px",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <div style={{ opacity: titleOpacity }}>
          <Eyebrow palette={palette}>First-time setup · ~60s</Eyebrow>
          <div
            style={{
              fontFamily: FONT_DISPLAY,
              fontSize: 56,
              letterSpacing: "-0.04em",
              lineHeight: 1.0,
              fontWeight: 600,
              color: palette.fg,
              marginTop: 10,
            }}
          >
            clone, install, point at your vault.
          </div>
        </div>

        <div
          style={{
            marginTop: 36,
            display: "grid",
            gridTemplateColumns: "1.05fr 1fr",
            columnGap: 44,
            alignItems: "flex-start",
            flex: 1,
          }}
        >
          <div
            style={{
              opacity: terminalOpacity,
              transform: `translateY(${terminalShift}px)`,
            }}
          >
            <Terminal
              palette={palette}
              lines={[
                {
                  kind: "prompt",
                  text: "git clone github.com/IsaacWrong/daycmd",
                  start: 14,
                  durFrames: 22,
                },
                { kind: "stdout", text: "  Cloning into 'daycmd'... done.", appearAt: 38 },
                {
                  kind: "prompt",
                  text: "cd daycmd && npm install",
                  start: 44,
                  durFrames: 18,
                },
                {
                  kind: "stdout",
                  text: "  added 840 packages in 43s",
                  appearAt: 66,
                },
                {
                  kind: "prompt",
                  text: "echo VAULT_PATH=\"$PWD/examples/sample-vault\" > .env.local",
                  start: 72,
                  durFrames: 26,
                },
                {
                  kind: "prompt",
                  text: "npm run dev",
                  start: 102,
                  durFrames: 10,
                },
                {
                  kind: "stdout",
                  text: "▲ Next.js 16.2.6  ·  ready on http://localhost:3000",
                  appearAt: 116,
                },
              ]}
              style={{ width: "100%" }}
            />
          </div>

          <div
            style={{
              opacity: browserOpacity,
              transform: `translateY(${browserShift}px)`,
            }}
          >
            <BrowserFrame palette={palette} url="http://localhost:3000/setup">
              <SetupWizard palette={palette} frame={f - 130} />
            </BrowserFrame>
          </div>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

const SetupWizard: React.FC<{
  palette: ReturnType<typeof mixPalettes>;
  frame: number;
}> = ({ palette, frame }) => {
  const checks: { label: string; meta: string; revealAt: number }[] = [
    { label: "VAULT_PATH", meta: "examples/sample-vault · 24 notes", revealAt: 4 },
    { label: "ANTHROPIC_API_KEY", meta: "sk-ant-… · validated", revealAt: 14 },
    { label: "GitHub PAT", meta: "optional · skip for now", revealAt: 24 },
    { label: "Google OAuth", meta: "optional · skip for now", revealAt: 34 },
  ];
  return (
    <div style={{ padding: "32px 36px 38px", color: palette.fg, minHeight: 420 }}>
      <Eyebrow palette={palette}>Setup wizard · step 2 of 3</Eyebrow>
      <div
        style={{
          fontFamily: FONT_DISPLAY,
          fontSize: 28,
          letterSpacing: "-0.03em",
          fontWeight: 600,
          marginTop: 10,
          marginBottom: 4,
        }}
      >
        ready when you are.
      </div>
      <div
        style={{
          fontFamily: FONT_SANS,
          fontSize: 13,
          color: palette.fgSoft,
          marginBottom: 18,
        }}
      >
        Required keys go in <span style={{ fontFamily: FONT_MONO }}>.env.local</span>.
        Optional feeds degrade gracefully when absent.
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {checks.map((c, i) => {
          const on = frame >= c.revealAt;
          const required = i < 2;
          const tickColor = required ? ACCENTS.good : palette.fgSoft;
          return (
            <div
              key={c.label}
              style={{
                opacity: on ? 1 : 0.25,
                transform: `translateY(${on ? 0 : 6}px)`,
                display: "flex",
                alignItems: "center",
                gap: 12,
                padding: "10px 12px",
                borderRadius: 10,
                border: `1px solid ${palette.rule}`,
                background: on
                  ? `oklch(from ${tickColor} l c h / 0.06)`
                  : "transparent",
              }}
            >
              <div
                style={{
                  width: 18,
                  height: 18,
                  borderRadius: "50%",
                  background: on ? tickColor : "transparent",
                  border: `1.5px solid ${on ? tickColor : palette.rule}`,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "white",
                  fontSize: 12,
                  fontWeight: 700,
                }}
              >
                {on ? (required ? "✓" : "·") : ""}
              </div>
              <div style={{ flex: 1 }}>
                <div
                  style={{
                    fontFamily: FONT_MONO,
                    fontSize: 13,
                    color: palette.fg,
                  }}
                >
                  {c.label}
                </div>
                <div
                  style={{
                    fontSize: 11,
                    color: palette.fgSoft,
                    marginTop: 2,
                  }}
                >
                  {c.meta}
                </div>
              </div>
              <div
                style={{
                  fontSize: 10,
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                  color: required ? ACCENTS.good : palette.fgSoft,
                  opacity: on ? 1 : 0,
                }}
              >
                {required ? "ready" : "skip"}
              </div>
            </div>
          );
        })}
      </div>
      <div
        style={{
          marginTop: 22,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <div style={{ fontSize: 11, color: palette.fgSoft }}>
          Restart <span style={{ fontFamily: FONT_MONO }}>npm run dev</span> after saving.
        </div>
        <div
          style={{
            padding: "9px 18px",
            borderRadius: 8,
            background: ACCENTS.good,
            color: "white",
            fontSize: 13,
            fontWeight: 500,
            letterSpacing: "-0.005em",
            opacity: frame >= 36 ? 1 : 0.4,
          }}
        >
          Open dashboard →
        </div>
      </div>
    </div>
  );
};
