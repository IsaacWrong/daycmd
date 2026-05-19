import { useCurrentFrame } from "remotion";
import { BrowserFrame } from "../components/BrowserFrame";
import { Glass } from "../components/Glass";
import { Eyebrow } from "../components/Eyebrow";
import { ACCENTS, FONT_DISPLAY, FONT_MONO, FONT_SANS, TOD } from "../palette";
import { StatusPill, TutorialFrame } from "./Common";

export const GithubPATTutorial: React.FC = () => {
  const f = useCurrentFrame();
  const palette = TOD.morning;

  const scopes: { name: string; from: number }[] = [
    { name: "repo", from: 30 },
    { name: "notifications", from: 50 },
    { name: "read:user", from: 70 },
  ];
  const generateClick = f >= 90 && f < 108;
  const tokenAt = 108;
  const tokenChars =
    f >= tokenAt
      ? Math.min(40, Math.floor((f - tokenAt) * 1.4))
      : 0;
  const fullToken = "ghp_1A2b3C4d5E6F7g8H9i0J1k2L3m4N5o6P7q8R";
  const tokenShown = fullToken.slice(0, tokenChars);
  const pastedFrom = 175;
  const feedFrom = 220;

  return (
    <TutorialFrame
      palette={palette}
      eyebrow="Tutorial · 10s · github"
      title="paste a PAT, watch the heatmap fill."
      footer={
        <span>
          Token stays local in{" "}
          <span style={{ fontFamily: FONT_MONO }}>.env.local</span>. Octokit
          uses it for repos, notifications, and your user feed.
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
        <BrowserFrame
          palette={palette}
          url="github.com/settings/tokens/new"
        >
          <div style={{ padding: "22px 26px" }}>
            <Eyebrow palette={palette}>github</Eyebrow>
            <div
              style={{
                fontFamily: FONT_DISPLAY,
                fontSize: 20,
                letterSpacing: "-0.03em",
                fontWeight: 600,
                marginTop: 4,
                color: palette.fg,
              }}
            >
              New personal access token (classic)
            </div>

            <div
              style={{
                marginTop: 16,
                fontSize: 12,
                color: palette.fgSoft,
                letterSpacing: "0.04em",
                textTransform: "uppercase",
              }}
            >
              Select scopes
            </div>
            <div
              style={{
                marginTop: 8,
                display: "flex",
                flexDirection: "column",
                gap: 8,
              }}
            >
              {scopes.map((s) => {
                const on = f >= s.from;
                return (
                  <div
                    key={s.name}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 12,
                      padding: "10px 12px",
                      borderRadius: 8,
                      border: `1px solid ${
                        on ? ACCENTS.github : palette.rule
                      }`,
                      background: on
                        ? `oklch(from ${ACCENTS.github} l c h / 0.08)`
                        : "transparent",
                      transition: "all 0.2s",
                    }}
                  >
                    <div
                      style={{
                        width: 18,
                        height: 18,
                        borderRadius: 4,
                        background: on ? ACCENTS.github : "transparent",
                        border: `1.5px solid ${
                          on ? ACCENTS.github : palette.fgSoft
                        }`,
                        color: "white",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: 12,
                        fontWeight: 700,
                      }}
                    >
                      {on ? "✓" : ""}
                    </div>
                    <span
                      style={{
                        fontFamily: FONT_MONO,
                        fontSize: 14,
                        color: palette.fg,
                      }}
                    >
                      {s.name}
                    </span>
                    <span
                      style={{
                        marginLeft: "auto",
                        fontSize: 11,
                        color: palette.fgSoft,
                      }}
                    >
                      {s.name === "repo"
                        ? "full control of private repositories"
                        : s.name === "notifications"
                          ? "access notifications"
                          : "read user profile"}
                    </span>
                  </div>
                );
              })}
            </div>

            <div
              style={{
                marginTop: 20,
                display: "flex",
                alignItems: "center",
                gap: 14,
              }}
            >
              <div
                style={{
                  padding: "9px 16px",
                  borderRadius: 8,
                  background: ACCENTS.good,
                  color: "white",
                  fontSize: 13,
                  fontWeight: 500,
                  transform: generateClick ? "scale(0.96)" : "scale(1)",
                  boxShadow: generateClick
                    ? `0 0 0 4px oklch(from ${ACCENTS.good} l c h / 0.28)`
                    : "none",
                }}
              >
                Generate token
              </div>
              {tokenChars > 0 ? (
                <span
                  style={{
                    fontFamily: FONT_MONO,
                    fontSize: 12,
                    color: ACCENTS.github,
                    padding: "5px 10px",
                    borderRadius: 6,
                    background: `oklch(from ${ACCENTS.github} l c h / 0.12)`,
                    border: `1px solid ${ACCENTS.github}`,
                    letterSpacing: "0.01em",
                  }}
                >
                  {tokenShown}
                </span>
              ) : null}
            </div>
          </div>
        </BrowserFrame>

        <Glass
          palette={palette}
          style={{
            padding: "22px 26px",
            display: "flex",
            flexDirection: "column",
            gap: 14,
          }}
        >
          <Eyebrow palette={palette}>~/daycmd/.env.local</Eyebrow>
          <div
            style={{
              background: "oklch(0.13 0.02 260 / 0.92)",
              borderRadius: 10,
              padding: "16px 18px",
              fontFamily: FONT_MONO,
              fontSize: 14,
              lineHeight: 1.7,
              color: "oklch(0.94 0.01 260)",
              minHeight: 96,
            }}
          >
            <div>
              <span style={{ color: "oklch(0.70 0.13 150)" }}>VAULT_PATH</span>
              <span style={{ color: "oklch(0.70 0.01 260)" }}>=</span>
              <span style={{ color: "oklch(0.85 0.10 60)" }}>"~/notes"</span>
            </div>
            <div>
              <span style={{ color: "oklch(0.70 0.13 150)" }}>
                ANTHROPIC_API_KEY
              </span>
              <span style={{ color: "oklch(0.70 0.01 260)" }}>=</span>
              <span style={{ color: "oklch(0.85 0.10 60)" }}>
                "sk-ant-•••••••"
              </span>
            </div>
            {f >= pastedFrom ? (
              <div
                style={{
                  background: `oklch(from ${ACCENTS.github} l c h / 0.18)`,
                  marginLeft: -6,
                  paddingLeft: 6,
                  marginRight: -6,
                  paddingRight: 6,
                  borderRadius: 4,
                }}
              >
                <span style={{ color: "oklch(0.70 0.13 150)" }}>
                  GITHUB_TOKEN
                </span>
                <span style={{ color: "oklch(0.70 0.01 260)" }}>=</span>
                <span style={{ color: "oklch(0.85 0.10 60)" }}>
                  "{fullToken.slice(0, 18)}…"
                </span>
              </div>
            ) : null}
          </div>
          <div
            style={{
              fontSize: 11,
              color: palette.fgSoft,
              letterSpacing: "0.04em",
              textTransform: "uppercase",
              marginTop: 4,
            }}
          >
            GitHub heatmap · last 14 days
          </div>
          <Heatmap palette={palette} progress={(f - feedFrom) / 60} />
          {f >= feedFrom + 36 ? (
            <StatusPill palette={palette} tone="good" style={{ alignSelf: "flex-start" }}>
              ✓ 5 repos · 12 commits today
            </StatusPill>
          ) : null}
        </Glass>
      </div>
    </TutorialFrame>
  );
};

const Heatmap: React.FC<{
  palette: ReturnType<typeof Object>;
  progress: number;
}> = ({ progress }) => {
  const days = 14;
  const rows = 5;
  const total = days * rows;
  const shown = Math.max(0, Math.min(total, Math.floor(progress * total)));
  const cells: number[] = [];
  for (let i = 0; i < total; i++) {
    cells.push(Math.max(0, Math.sin(i * 0.7) * 0.5 + 0.5));
  }
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: `repeat(${days}, 1fr)`,
        gap: 4,
      }}
    >
      {cells.map((v, i) => {
        const on = i < shown;
        const a = on ? 0.1 + v * 0.6 : 0.04;
        return (
          <div
            key={i}
            style={{
              height: 22,
              background: `oklch(from ${ACCENTS.tasks} l c h / ${a})`,
              borderRadius: 3,
            }}
          />
        );
      })}
    </div>
  );
};
