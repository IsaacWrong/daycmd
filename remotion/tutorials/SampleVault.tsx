import { useCurrentFrame } from "remotion";
import { BrowserFrame } from "../components/BrowserFrame";
import { Glass } from "../components/Glass";
import { Eyebrow } from "../components/Eyebrow";
import { ACCENTS, FONT_DISPLAY, FONT_MONO, FONT_SANS, TOD } from "../palette";
import { Caret, StatusPill, TutorialFrame } from "./Common";

export const SampleVaultTutorial: React.FC = () => {
  const f = useCurrentFrame();
  const palette = TOD.morning;

  const sampleShownFrom = 30;
  const swapFrom = 130;
  const fullPath = "/Users/you/Vaults/main";
  const typed = Math.max(0, Math.min(fullPath.length, Math.floor((f - swapFrom) * 0.9)));
  const restartFrom = 200;
  const realShownFrom = 240;

  return (
    <TutorialFrame
      palette={palette}
      eyebrow="Tutorial · 10s · vault"
      title="try the sample, then point at yours."
      footer={
        <span>
          The agent edits files. Test on{" "}
          <span style={{ fontFamily: FONT_MONO }}>examples/sample-vault</span>{" "}
          before you swap in your real notes.
        </span>
      }
    >
      <div
        style={{
          width: 1280,
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 22,
        }}
      >
        <Glass
          palette={palette}
          style={{
            padding: "22px 26px",
            display: "flex",
            flexDirection: "column",
            gap: 12,
          }}
        >
          <Eyebrow palette={palette}>~/daycmd/.env.local</Eyebrow>
          <div
            style={{
              background: "oklch(0.13 0.02 260 / 0.92)",
              borderRadius: 10,
              padding: "16px 18px",
              fontFamily: FONT_MONO,
              fontSize: 15,
              lineHeight: 1.65,
              color: "oklch(0.94 0.01 260)",
              minHeight: 110,
            }}
          >
            <div>
              <span style={{ color: "oklch(0.70 0.13 150)" }}>VAULT_PATH</span>
              <span style={{ color: "oklch(0.70 0.01 260)" }}>=</span>
              {f < swapFrom ? (
                <span style={{ color: "oklch(0.85 0.10 60)" }}>
                  "$PWD/examples/sample-vault"
                </span>
              ) : (
                <span style={{ color: "oklch(0.85 0.10 60)" }}>
                  "{fullPath.slice(0, typed)}"
                  {typed < fullPath.length ? (
                    <Caret palette={palette} />
                  ) : null}
                </span>
              )}
            </div>
            <div>
              <span style={{ color: "oklch(0.70 0.13 150)" }}>
                ANTHROPIC_API_KEY
              </span>
              <span style={{ color: "oklch(0.70 0.01 260)" }}>=</span>
              <span style={{ color: "oklch(0.85 0.10 60)" }}>"sk-ant-•••"</span>
            </div>
            {f >= restartFrom ? (
              <div style={{ marginTop: 14 }}>
                <span style={{ color: "oklch(0.70 0.13 150)" }}>$ </span>
                <span>npm run dev</span>
              </div>
            ) : null}
            {f >= restartFrom + 16 ? (
              <div style={{ color: "oklch(0.70 0.01 260)", marginTop: 4 }}>
                ▲ Next.js 16.2.6 · ready on http://localhost:3000
              </div>
            ) : null}
          </div>
          <div
            style={{
              display: "flex",
              gap: 10,
              alignItems: "center",
              flexWrap: "wrap",
            }}
          >
            {f < swapFrom ? (
              <StatusPill palette={palette} tone="muted">
                using sample vault
              </StatusPill>
            ) : f < realShownFrom ? (
              <StatusPill palette={palette} tone="warn">
                vault changed · restart dev
              </StatusPill>
            ) : (
              <StatusPill palette={palette} tone="good">
                ✓ your vault · 1,247 notes
              </StatusPill>
            )}
          </div>
        </Glass>

        <BrowserFrame
          palette={palette}
          url="localhost:3000"
          style={{ height: 380 }}
        >
          <div style={{ padding: "20px 24px" }}>
            <Eyebrow palette={palette}>Tasks · Today</Eyebrow>
            <div
              style={{
                marginTop: 10,
                display: "flex",
                flexDirection: "column",
                gap: 8,
              }}
            >
              {(f < realShownFrom
                ? f < sampleShownFrom
                  ? []
                  : SAMPLE_TASKS
                : YOUR_TASKS
              ).map((t, i) => (
                <div
                  key={i}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    fontSize: 13,
                    color: palette.fg,
                  }}
                >
                  <div
                    style={{
                      width: 14,
                      height: 14,
                      borderRadius: 4,
                      border: `1.5px solid ${palette.fgSoft}`,
                    }}
                  />
                  <span>{t}</span>
                </div>
              ))}
            </div>
            <div
              style={{
                fontSize: 11,
                color: palette.fgSoft,
                marginTop: 14,
                fontFamily: FONT_MONO,
              }}
            >
              {f < realShownFrom
                ? "vault · examples/sample-vault · 24 notes"
                : "vault · ~/Vaults/main · 1,247 notes"}
            </div>
          </div>
        </BrowserFrame>
      </div>
    </TutorialFrame>
  );
};

const SAMPLE_TASKS = [
  "(sample) read the README",
  "(sample) try the focus tile",
  "(sample) write your first daily note",
];

const YOUR_TASKS = [
  "ship hero video to README",
  "review #214 KB compile bug",
  "draft sponsor section",
  "archive Q1 receipts",
];
