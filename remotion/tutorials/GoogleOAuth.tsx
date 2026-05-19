import { interpolate, useCurrentFrame } from "remotion";
import { BrowserFrame } from "../components/BrowserFrame";
import { Glass } from "../components/Glass";
import { Eyebrow } from "../components/Eyebrow";
import { ACCENTS, FONT_DISPLAY, FONT_MONO, FONT_SANS, TOD } from "../palette";
import { FieldRow, StatusPill, TutorialFrame } from "./Common";

export const GoogleOAuthTutorial: React.FC = () => {
  const f = useCurrentFrame();
  const palette = TOD.morning;

  const clickConnect = f >= 90 && f < 110;
  const popupIn = interpolate(f, [110, 140], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const popupOut = interpolate(f, [220, 250], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const accountClick = f >= 195 && f < 215;
  const connected = f >= 240;
  const toolsLitFrom = 250;

  return (
    <TutorialFrame
      palette={palette}
      eyebrow="Tutorial · 12s · gmail + calendar"
      title="connect google."
      footer={
        <span>
          Redirect URI:{" "}
          <span style={{ fontFamily: FONT_MONO }}>
            http://localhost:3000/api/auth/google/callback
          </span>
        </span>
      }
    >
      <div style={{ position: "relative", width: 1180, height: 580 }}>
        <BrowserFrame
          palette={palette}
          url="localhost:3000/settings#google"
          style={{ width: "100%", height: "100%" }}
        >
          <div style={{ padding: "26px 30px" }}>
            <Eyebrow palette={palette}>Integrations</Eyebrow>
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
              Google · Gmail + Calendar
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 14,
                marginTop: 18,
              }}
            >
              <FieldRow
                palette={palette}
                label="GOOGLE_CLIENT_ID"
                value="437...apps.googleusercontent.com"
                meta=".env.local · loaded"
              />
              <FieldRow
                palette={palette}
                label="GOOGLE_CLIENT_SECRET"
                value="GOCSPX-•••••••••••"
                meta=".env.local · loaded"
              />
            </div>

            <Glass
              palette={palette}
              style={{
                marginTop: 16,
                padding: "16px 20px",
                display: "flex",
                alignItems: "center",
                gap: 16,
              }}
              radius={12}
            >
              <div style={{ flex: 1 }}>
                <div
                  style={{
                    fontFamily: FONT_SANS,
                    fontSize: 14,
                    color: palette.fg,
                  }}
                >
                  {connected ? "Connected as you@example.com" : "Not connected"}
                </div>
                <div
                  style={{
                    fontSize: 11,
                    color: palette.fgSoft,
                    marginTop: 2,
                  }}
                >
                  Scopes · gmail.modify · calendar.events
                </div>
              </div>
              {connected ? (
                <StatusPill palette={palette} tone="good">
                  ✓ connected
                </StatusPill>
              ) : (
                <div
                  style={{
                    padding: "10px 18px",
                    borderRadius: 8,
                    background: ACCENTS.calendar,
                    color: "white",
                    fontSize: 14,
                    fontWeight: 500,
                    transform: clickConnect ? "scale(0.96)" : "scale(1)",
                    boxShadow: clickConnect
                      ? `0 0 0 4px oklch(from ${ACCENTS.calendar} l c h / 0.28)`
                      : "none",
                  }}
                >
                  Connect Google
                </div>
              )}
            </Glass>

            <div
              style={{
                marginTop: 22,
                display: "flex",
                gap: 12,
                flexWrap: "wrap",
              }}
            >
              {[
                { name: "Gmail · list", on: f >= toolsLitFrom + 6 },
                { name: "Gmail · archive", on: f >= toolsLitFrom + 18 },
                { name: "Gmail · send", on: f >= toolsLitFrom + 30 },
                { name: "Calendar · read", on: f >= toolsLitFrom + 42 },
                { name: "Calendar · create", on: f >= toolsLitFrom + 54 },
              ].map((tool) => (
                <span
                  key={tool.name}
                  style={{
                    padding: "6px 12px",
                    borderRadius: 999,
                    fontFamily: FONT_MONO,
                    fontSize: 12,
                    background: tool.on
                      ? `oklch(from ${ACCENTS.good} l c h / 0.16)`
                      : `oklch(from ${palette.fg} l c h / 0.04)`,
                    color: tool.on ? ACCENTS.good : palette.fgSoft,
                    border: `1px solid ${tool.on ? ACCENTS.good : palette.rule}`,
                    transition: "all 0.2s",
                  }}
                >
                  {tool.on ? "✓ " : "· "}
                  {tool.name}
                </span>
              ))}
            </div>
          </div>
        </BrowserFrame>

        {popupIn > 0 && popupOut > 0 ? (
          <div
            style={{
              position: "absolute",
              top: 80,
              right: 64,
              opacity: popupIn * popupOut,
              transform: `translateY(${(1 - popupIn) * 16}px)`,
              width: 420,
              borderRadius: 14,
              background: "white",
              border: `1px solid oklch(0.85 0.01 260)`,
              boxShadow: "0 30px 80px oklch(0 0 0 / 0.30)",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                padding: "16px 22px",
                borderBottom: "1px solid oklch(0.92 0.005 260)",
                fontSize: 15,
                color: "oklch(0.25 0.02 260)",
                fontFamily: FONT_SANS,
              }}
            >
              <div style={{ fontSize: 11, color: "oklch(0.55 0.02 260)" }}>
                accounts.google.com
              </div>
              <div style={{ marginTop: 4, fontWeight: 500 }}>
                Choose an account
              </div>
              <div
                style={{
                  fontSize: 12,
                  color: "oklch(0.50 0.02 260)",
                  marginTop: 2,
                }}
              >
                to continue to <span style={{ fontWeight: 500 }}>daycmd</span>
              </div>
            </div>
            <div style={{ padding: "8px 0" }}>
              <AccountRow
                name="you@example.com"
                pressed={accountClick}
                tint="oklch(0.62 0.18 250)"
              />
              <AccountRow
                name="other@example.com"
                tint="oklch(0.68 0.14 320)"
              />
            </div>
          </div>
        ) : null}
      </div>
    </TutorialFrame>
  );
};

const AccountRow: React.FC<{
  name: string;
  pressed?: boolean;
  tint: string;
}> = ({ name, pressed, tint }) => (
  <div
    style={{
      display: "flex",
      alignItems: "center",
      gap: 12,
      padding: "10px 22px",
      background: pressed ? "oklch(0.96 0.005 260)" : "transparent",
      fontFamily: FONT_SANS,
      fontSize: 14,
      color: "oklch(0.25 0.02 260)",
    }}
  >
    <div
      style={{
        width: 28,
        height: 28,
        borderRadius: "50%",
        background: tint,
        color: "white",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontWeight: 600,
        fontSize: 13,
      }}
    >
      {name[0]!.toUpperCase()}
    </div>
    <span>{name}</span>
  </div>
);
