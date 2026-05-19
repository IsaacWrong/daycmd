import type { CSSProperties, ReactNode } from "react";
import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { Backdrop } from "../components/Backdrop";
import { Glass } from "../components/Glass";
import { Eyebrow } from "../components/Eyebrow";
import { ACCENTS, FONT_DISPLAY, FONT_MONO, FONT_SANS, type Palette, TOD } from "../palette";

export const TutorialFrame: React.FC<{
  palette?: Palette;
  eyebrow: string;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
}> = ({ palette = TOD.morning, eyebrow, title, children, footer }) => {
  const f = useCurrentFrame();
  const titleIn = interpolate(f, [0, 14], [0, 1], {
    extrapolateRight: "clamp",
  });
  const titleShift = interpolate(f, [0, 14], [8, 0], {
    extrapolateRight: "clamp",
  });
  return (
    <AbsoluteFill>
      <Backdrop palette={palette} grain={false} />
      <AbsoluteFill
        style={{
          padding: "56px 72px",
          display: "flex",
          flexDirection: "column",
          fontFamily: FONT_SANS,
          color: palette.fg,
        }}
      >
        <div
          style={{
            opacity: titleIn,
            transform: `translateY(${titleShift}px)`,
          }}
        >
          <Eyebrow palette={palette}>{eyebrow}</Eyebrow>
          <div
            style={{
              fontFamily: FONT_DISPLAY,
              fontSize: 44,
              letterSpacing: "-0.04em",
              lineHeight: 1.0,
              fontWeight: 600,
              marginTop: 8,
            }}
          >
            {title}
          </div>
        </div>
        <div
          style={{
            flex: 1,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            marginTop: 22,
          }}
        >
          {children}
        </div>
        {footer ? (
          <div
            style={{
              fontSize: 13,
              color: palette.fgSoft,
              letterSpacing: "-0.005em",
              minHeight: 18,
            }}
          >
            {footer}
          </div>
        ) : null}
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

export const KeyChip: React.FC<{
  palette: Palette;
  k: string;
  style?: CSSProperties;
}> = ({ palette, k, style }) => (
  <span
    style={{
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
      minWidth: 26,
      height: 26,
      padding: "0 8px",
      borderRadius: 6,
      background: `oklch(from ${palette.fg} l c h / 0.06)`,
      border: `1px solid ${palette.rule}`,
      fontFamily: FONT_MONO,
      fontSize: 13,
      color: palette.fg,
      ...style,
    }}
  >
    {k}
  </span>
);

export const StatusPill: React.FC<{
  palette: Palette;
  tone: "good" | "warn" | "muted";
  children: string;
  style?: CSSProperties;
}> = ({ palette, tone, children, style }) => {
  const color =
    tone === "good"
      ? ACCENTS.good
      : tone === "warn"
        ? ACCENTS.error
        : palette.fgSoft;
  return (
    <span
      style={{
        padding: "4px 10px",
        borderRadius: 999,
        fontSize: 11,
        letterSpacing: "0.04em",
        textTransform: "uppercase",
        fontFamily: FONT_SANS,
        color: tone === "muted" ? color : color,
        background:
          tone === "muted"
            ? "transparent"
            : `oklch(from ${color} l c h / 0.16)`,
        border:
          tone === "muted" ? `1px solid ${palette.rule}` : "none",
        ...style,
      }}
    >
      {children}
    </span>
  );
};

export const FieldRow: React.FC<{
  palette: Palette;
  label: string;
  value: ReactNode;
  meta?: string;
  accent?: string;
  highlight?: boolean;
  style?: CSSProperties;
}> = ({ palette, label, value, meta, accent, highlight, style }) => {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 16,
        padding: "12px 14px",
        borderRadius: 10,
        border: `1px solid ${highlight ? accent ?? palette.fg : palette.rule}`,
        background: highlight
          ? `oklch(from ${accent ?? palette.fg} l c h / 0.06)`
          : `oklch(from ${palette.fg} l c h / 0.03)`,
        transition: "all 0.2s",
        ...style,
      }}
    >
      <div style={{ flex: 1 }}>
        <div
          style={{
            fontFamily: FONT_MONO,
            fontSize: 12,
            color: palette.fgSoft,
            letterSpacing: "0.02em",
          }}
        >
          {label}
        </div>
        <div
          style={{
            fontFamily: FONT_MONO,
            fontSize: 15,
            color: palette.fg,
            marginTop: 3,
            letterSpacing: "-0.005em",
          }}
        >
          {value}
        </div>
        {meta ? (
          <div
            style={{
              fontSize: 11,
              color: palette.fgSoft,
              marginTop: 4,
            }}
          >
            {meta}
          </div>
        ) : null}
      </div>
    </div>
  );
};

export const Caret: React.FC<{ palette: Palette }> = ({ palette }) => {
  const f = useCurrentFrame();
  return (
    <span
      style={{
        display: "inline-block",
        width: 2,
        height: "1em",
        background: palette.fg,
        marginLeft: 1,
        verticalAlign: "-2px",
        opacity: Math.floor(f / 8) % 2 === 0 ? 0.85 : 0.1,
      }}
    />
  );
};

export { Glass, Backdrop };
