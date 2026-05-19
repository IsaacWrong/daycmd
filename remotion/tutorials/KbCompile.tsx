import { interpolate, useCurrentFrame } from "remotion";
import { Glass } from "../components/Glass";
import { Eyebrow } from "../components/Eyebrow";
import { ACCENTS, FONT_DISPLAY, FONT_MONO, FONT_SANS, TOD } from "../palette";
import { StatusPill, TutorialFrame } from "./Common";

type FileDot = {
  id: string;
  label: string;
  bornAt: number;
  promoteAt?: number;
  outputAt?: number;
};

const FILES: FileDot[] = [
  { id: "r1", label: "log · 07:14", bornAt: 18, promoteAt: 130, outputAt: 290 },
  { id: "r2", label: "log · 09:02", bornAt: 36, promoteAt: 148 },
  { id: "r3", label: "log · 10:40", bornAt: 54, promoteAt: 166 },
  { id: "r4", label: "log · 12:15", bornAt: 72, promoteAt: 184, outputAt: 308 },
  { id: "r5", label: "log · 14:30", bornAt: 90 },
];

export const KbCompileTutorial: React.FC = () => {
  const f = useCurrentFrame();
  const palette = TOD.morning;

  const cronFlash = f >= 110 && f < 130;
  const lintFrom = 320;
  const dismissFrom = 380;

  return (
    <TutorialFrame
      palette={palette}
      eyebrow="Tutorial · 14s · knowledge base"
      title="raw → wiki → output, compile + lint at 06:00."
      footer={
        <span>
          Every agent run auto-logs to{" "}
          <span style={{ fontFamily: FONT_MONO }}>raw/</span>. Daily cron
          compiles to <span style={{ fontFamily: FONT_MONO }}>wiki/</span>,
          lints, files drift in{" "}
          <span style={{ fontFamily: FONT_MONO }}>Errors</span>.
        </span>
      }
    >
      <div style={{ width: 1320, display: "flex", flexDirection: "column", gap: 20 }}>
        <Glass palette={palette} style={{ padding: "22px 24px" }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 16,
              marginBottom: 18,
            }}
          >
            <Eyebrow palette={palette}>category · almanac</Eyebrow>
            <div
              style={{
                marginLeft: "auto",
                display: "flex",
                alignItems: "center",
                gap: 10,
              }}
            >
              <StatusPill
                palette={palette}
                tone={cronFlash ? "good" : "muted"}
              >
                cron · 06:00
              </StatusPill>
              <div
                style={{
                  padding: "8px 14px",
                  borderRadius: 8,
                  background: ACCENTS.agent,
                  color: "white",
                  fontSize: 12,
                  fontWeight: 500,
                  transform: cronFlash ? "scale(0.97)" : "scale(1)",
                  boxShadow: cronFlash
                    ? `0 0 0 4px oklch(from ${ACCENTS.agent} l c h / 0.28)`
                    : "none",
                }}
              >
                Run compile + lint
              </div>
            </div>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr 1fr",
              gap: 18,
              position: "relative",
            }}
          >
            <Tier
              palette={palette}
              title="raw/"
              subtitle="every agent run"
              accent={ACCENTS.tasks}
              count={FILES.filter((file) => f >= file.bornAt).length}
            >
              {FILES.map((file) => {
                const born = f >= file.bornAt;
                const promoted = file.promoteAt !== undefined && f >= file.promoteAt;
                const opacity = born && !promoted
                  ? interpolate(
                      f,
                      [file.bornAt, file.bornAt + 8],
                      [0, 1],
                      { extrapolateRight: "clamp" },
                    )
                  : promoted
                    ? 0.18
                    : 0;
                return (
                  <Row
                    key={file.id}
                    palette={palette}
                    label={file.label}
                    accent={ACCENTS.tasks}
                    opacity={opacity}
                  />
                );
              })}
            </Tier>

            <Tier
              palette={palette}
              title="wiki/"
              subtitle="compiled INDEX + pages"
              accent={ACCENTS.agent}
              count={
                FILES.filter(
                  (file) => file.promoteAt !== undefined && f >= file.promoteAt,
                ).length
              }
            >
              {FILES.filter((file) => file.promoteAt !== undefined).map(
                (file) => {
                  const promoted = file.promoteAt !== undefined && f >= file.promoteAt;
                  const sentToOutput =
                    file.outputAt !== undefined && f >= file.outputAt;
                  const opacity = promoted && !sentToOutput
                    ? interpolate(
                        f,
                        [file.promoteAt!, file.promoteAt! + 10],
                        [0, 1],
                        { extrapolateRight: "clamp" },
                      )
                    : sentToOutput
                      ? 0.22
                      : 0;
                  const label =
                    file.id === "r1"
                      ? "concept · daily-note flow"
                      : file.id === "r2"
                        ? "person · Maya"
                        : file.id === "r3"
                          ? "source · meeting"
                          : file.id === "r4"
                            ? "concept · KB compile"
                            : file.label;
                  return (
                    <Row
                      key={file.id}
                      palette={palette}
                      label={label}
                      accent={ACCENTS.agent}
                      opacity={opacity}
                    />
                  );
                },
              )}
            </Tier>

            <Tier
              palette={palette}
              title="output/"
              subtitle="polished deliverables"
              accent={ACCENTS.good}
              count={
                FILES.filter(
                  (file) => file.outputAt !== undefined && f >= file.outputAt,
                ).length
              }
            >
              {FILES.filter((file) => file.outputAt !== undefined).map(
                (file) => {
                  const here = file.outputAt !== undefined && f >= file.outputAt;
                  const opacity = here
                    ? interpolate(
                        f,
                        [file.outputAt!, file.outputAt! + 10],
                        [0, 1],
                        { extrapolateRight: "clamp" },
                      )
                    : 0;
                  const label =
                    file.id === "r1"
                      ? "almanac-handbook.md"
                      : "kb-compile-guide.md";
                  return (
                    <Row
                      key={file.id}
                      palette={palette}
                      label={label}
                      accent={ACCENTS.good}
                      opacity={opacity}
                    />
                  );
                },
              )}
            </Tier>
          </div>
        </Glass>

        <Glass
          palette={palette}
          style={{
            padding: "16px 22px",
            opacity: f >= lintFrom ? 1 : 0,
            transform: `translateY(${f >= lintFrom ? 0 : 8}px)`,
            transition: "all 0.3s",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              marginBottom: 10,
            }}
          >
            <Eyebrow palette={palette}>Errors · from lint pass</Eyebrow>
            <span
              style={{
                marginLeft: "auto",
                fontSize: 11,
                color: palette.fgSoft,
                fontFamily: FONT_MONO,
              }}
            >
              mirrored to Errors/2026-05-19.md
            </span>
          </div>
          {[
            { msg: "almanac · 3 wiki pages reference missing source", dismissed: f >= dismissFrom },
            { msg: "almanac · concept page has no INDEX backlink" },
          ].map((row, i) => (
            <div
              key={i}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                padding: "8px 12px",
                borderRadius: 8,
                border: `1px solid ${ACCENTS.error}`,
                background: `oklch(from ${ACCENTS.error} l c h / 0.05)`,
                marginTop: i === 0 ? 0 : 6,
                opacity: row.dismissed ? 0.4 : 1,
                textDecoration: row.dismissed ? "line-through" : "none",
              }}
            >
              <div
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: "50%",
                  background: ACCENTS.error,
                }}
              />
              <span
                style={{
                  fontSize: 13,
                  color: palette.fg,
                  fontFamily: FONT_SANS,
                  flex: 1,
                }}
              >
                {row.msg}
              </span>
              <span
                style={{
                  fontSize: 12,
                  color: palette.fgSoft,
                  fontFamily: FONT_MONO,
                }}
              >
                {row.dismissed ? "✓ dismissed" : "✓ dismiss"}
              </span>
            </div>
          ))}
        </Glass>
      </div>
    </TutorialFrame>
  );
};

const Tier: React.FC<{
  palette: typeof TOD.morning;
  title: string;
  subtitle: string;
  accent: string;
  count: number;
  children: React.ReactNode;
}> = ({ palette, title, subtitle, accent, count, children }) => (
  <div
    style={{
      borderRadius: 14,
      border: `1px solid ${palette.rule}`,
      background: `oklch(from ${accent} l c h / 0.05)`,
      padding: "14px 16px",
      minHeight: 240,
    }}
  >
    <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
      <span
        style={{
          fontFamily: FONT_MONO,
          fontSize: 18,
          color: accent,
          fontWeight: 500,
        }}
      >
        {title}
      </span>
      <span
        style={{
          fontFamily: FONT_MONO,
          fontSize: 14,
          color: palette.fgSoft,
        }}
      >
        {count}
      </span>
    </div>
    <div
      style={{
        fontSize: 11,
        color: palette.fgSoft,
        letterSpacing: "0.04em",
        textTransform: "uppercase",
        marginTop: 2,
        marginBottom: 12,
      }}
    >
      {subtitle}
    </div>
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      {children}
    </div>
  </div>
);

const Row: React.FC<{
  palette: typeof TOD.morning;
  label: string;
  accent: string;
  opacity: number;
}> = ({ palette, label, accent, opacity }) =>
  opacity === 0 ? null : (
    <div
      style={{
        opacity,
        display: "flex",
        alignItems: "center",
        gap: 8,
        padding: "6px 10px",
        borderRadius: 6,
        background: `oklch(from ${accent} l c h / 0.10)`,
        border: `1px solid oklch(from ${accent} l c h / 0.20)`,
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
      <span
        style={{
          fontFamily: FONT_MONO,
          fontSize: 12,
          color: palette.fg,
        }}
      >
        {label}
      </span>
    </div>
  );
