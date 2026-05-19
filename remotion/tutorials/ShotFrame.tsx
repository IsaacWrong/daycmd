import type { CSSProperties, ReactNode } from "react";
import { AbsoluteFill, Img, interpolate, staticFile, useCurrentFrame } from "remotion";
import { Backdrop } from "../components/Backdrop";
import { Eyebrow } from "../components/Eyebrow";
import { ACCENTS, FONT_DISPLAY, FONT_MONO, FONT_SANS, TOD, type Palette, type ToD } from "../palette";

export const ShotFrame: React.FC<{
  tod?: ToD;
  eyebrow: string;
  title: string;
  footer?: ReactNode;
  children: ReactNode;
}> = ({ tod = "morning", eyebrow, title, footer, children }) => {
  const f = useCurrentFrame();
  const palette = TOD[tod];
  const titleIn = interpolate(f, [0, 14], [0, 1], { extrapolateRight: "clamp" });
  const titleShift = interpolate(f, [0, 14], [10, 0], {
    extrapolateRight: "clamp",
  });
  return (
    <AbsoluteFill>
      <Backdrop palette={palette} grain={false} />
      <AbsoluteFill
        style={{
          padding: "44px 60px 56px",
          display: "flex",
          flexDirection: "column",
          fontFamily: FONT_SANS,
          color: palette.fg,
        }}
      >
        <div style={{ opacity: titleIn, transform: `translateY(${titleShift}px)` }}>
          <Eyebrow palette={palette}>{eyebrow}</Eyebrow>
          <div
            style={{
              fontFamily: FONT_DISPLAY,
              fontSize: 40,
              letterSpacing: "-0.04em",
              lineHeight: 1.0,
              fontWeight: 600,
              marginTop: 6,
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
            position: "relative",
            marginTop: 16,
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
              marginTop: 12,
            }}
          >
            {footer}
          </div>
        ) : null}
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

export const Shot: React.FC<{
  src: string;
  width: number;
  shift?: number;
  fadeIn?: [number, number];
  fadeOut?: [number, number];
  style?: CSSProperties;
}> = ({ src, width, shift = 0, fadeIn, fadeOut, style }) => {
  const f = useCurrentFrame();
  let opacity = 1;
  if (fadeIn) {
    opacity *= interpolate(f, fadeIn, [0, 1], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    });
  }
  if (fadeOut) {
    opacity *= interpolate(f, fadeOut, [1, 0], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    });
  }
  return (
    <Img
      src={staticFile(src)}
      style={{
        width,
        height: "auto",
        borderRadius: 14,
        boxShadow:
          "0 30px 80px oklch(0.20 0.02 260 / 0.18), 0 2px 4px oklch(0.20 0.02 260 / 0.06)",
        opacity,
        transform: `translateY(${shift}px)`,
        ...style,
      }}
    />
  );
};

export const HighlightBox: React.FC<{
  palette: Palette;
  rect: { x: number; y: number; w: number; h: number };
  fadeIn: [number, number];
  fadeOut?: [number, number];
  accent?: string;
}> = ({ palette, rect, fadeIn, fadeOut, accent = ACCENTS.tasks }) => {
  const f = useCurrentFrame();
  let opacity = interpolate(f, fadeIn, [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  if (fadeOut) {
    opacity *= interpolate(f, fadeOut, [1, 0], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    });
  }
  const pulse = 1 + Math.sin(f * 0.18) * 0.02;
  return (
    <div
      style={{
        position: "absolute",
        left: rect.x,
        top: rect.y,
        width: rect.w,
        height: rect.h,
        borderRadius: 8,
        border: `2px solid ${accent}`,
        boxShadow: `0 0 0 4px oklch(from ${accent} l c h / 0.18), 0 0 24px oklch(from ${accent} l c h / 0.40)`,
        opacity,
        transform: `scale(${pulse})`,
        pointerEvents: "none",
      }}
    />
  );
};

export const Callout: React.FC<{
  palette: Palette;
  rect: { x: number; y: number };
  text: string;
  fadeIn: [number, number];
  fadeOut?: [number, number];
  width?: number;
  accent?: string;
  arrow?: "left" | "right" | "up" | "down";
}> = ({ palette, rect, text, fadeIn, fadeOut, width = 280, accent, arrow }) => {
  const f = useCurrentFrame();
  let opacity = interpolate(f, fadeIn, [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  if (fadeOut) {
    opacity *= interpolate(f, fadeOut, [1, 0], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    });
  }
  const shift = interpolate(f, fadeIn, [6, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  return (
    <div
      style={{
        position: "absolute",
        left: rect.x,
        top: rect.y,
        width,
        opacity,
        transform: `translateY(${shift}px)`,
        pointerEvents: "none",
      }}
    >
      <div
        style={{
          padding: "12px 14px",
          borderRadius: 12,
          background: `linear-gradient(180deg, ${palette.bgA} 0%, ${palette.bgB} 100%)`,
          border: `1px solid ${accent ?? palette.fg}`,
          color: palette.fg,
          fontFamily: FONT_SANS,
          fontSize: 13,
          letterSpacing: "-0.005em",
          lineHeight: 1.4,
          boxShadow: `0 18px 40px oklch(0.20 0.02 260 / 0.22)`,
        }}
      >
        {text}
      </div>
      {arrow ? (
        <div
          style={{
            position: "absolute",
            ...arrowPos(arrow),
            width: 0,
            height: 0,
            ...arrowSide(arrow, accent ?? palette.fg),
          }}
        />
      ) : null}
    </div>
  );
};

const arrowPos = (side: "left" | "right" | "up" | "down"): CSSProperties => {
  if (side === "left") return { left: -10, top: 16 };
  if (side === "right") return { right: -10, top: 16 };
  if (side === "up") return { top: -10, left: 24 };
  return { bottom: -10, left: 24 };
};
const arrowSide = (
  side: "left" | "right" | "up" | "down",
  color: string,
): CSSProperties => {
  if (side === "left")
    return {
      borderTop: "8px solid transparent",
      borderBottom: "8px solid transparent",
      borderRight: `10px solid ${color}`,
    };
  if (side === "right")
    return {
      borderTop: "8px solid transparent",
      borderBottom: "8px solid transparent",
      borderLeft: `10px solid ${color}`,
    };
  if (side === "up")
    return {
      borderLeft: "8px solid transparent",
      borderRight: "8px solid transparent",
      borderBottom: `10px solid ${color}`,
    };
  return {
    borderLeft: "8px solid transparent",
    borderRight: "8px solid transparent",
    borderTop: `10px solid ${color}`,
  };
};

export const Cursor: React.FC<{
  from: { x: number; y: number };
  to: { x: number; y: number };
  travel: [number, number];
  visibleFrom?: number;
  visibleTo?: number;
  click?: number;
}> = ({ from, to, travel, visibleFrom = 0, visibleTo = 9999, click }) => {
  const f = useCurrentFrame();
  const x = interpolate(f, travel, [from.x, to.x], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: (t) => 1 - Math.pow(1 - t, 3),
  });
  const y = interpolate(f, travel, [from.y, to.y], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: (t) => 1 - Math.pow(1 - t, 3),
  });
  const opacity = f >= visibleFrom && f <= visibleTo ? 1 : 0;
  const clickPulse =
    click !== undefined && f >= click && f < click + 20
      ? 1 + (f - click) * 0.05
      : 1;
  const clickRing =
    click !== undefined && f >= click && f < click + 24
      ? interpolate(f, [click, click + 24], [0.7, 0], {
          extrapolateRight: "clamp",
        })
      : 0;
  return (
    <div
      style={{
        position: "absolute",
        left: x,
        top: y,
        pointerEvents: "none",
        opacity,
      }}
    >
      {clickRing > 0 ? (
        <div
          style={{
            position: "absolute",
            left: -14,
            top: -14,
            width: 28 + (1 - clickRing) * 20,
            height: 28 + (1 - clickRing) * 20,
            borderRadius: "50%",
            border: `2px solid ${ACCENTS.tasks}`,
            opacity: clickRing,
            transform: "translate(-50%, -50%)",
          }}
        />
      ) : null}
      <svg
        width={26}
        height={26}
        viewBox="0 0 24 24"
        style={{ transform: `scale(${clickPulse})` }}
      >
        <path
          d="M 4 2 L 4 20 L 9 16 L 12 22 L 14 21 L 11 15 L 18 14 Z"
          fill="white"
          stroke="oklch(0.18 0.02 260)"
          strokeWidth={1.4}
          strokeLinejoin="round"
        />
      </svg>
    </div>
  );
};

export const Keychord: React.FC<{
  keys: string[];
  caption: string;
  position: { x: number; y: number };
  fadeIn: [number, number];
  fadeOut?: [number, number];
  accent?: string;
  palette: Palette;
}> = ({ keys, caption, position, fadeIn, fadeOut, accent, palette }) => {
  const f = useCurrentFrame();
  let opacity = interpolate(f, fadeIn, [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  if (fadeOut) {
    opacity *= interpolate(f, fadeOut, [1, 0], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    });
  }
  const scale = interpolate(f, fadeIn, [0.88, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  return (
    <div
      style={{
        position: "absolute",
        left: position.x,
        top: position.y,
        opacity,
        transform: `scale(${scale})`,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 10,
        pointerEvents: "none",
      }}
    >
      <div style={{ display: "flex", gap: 8 }}>
        {keys.map((k) => (
          <div
            key={k}
            style={{
              minWidth: 64,
              height: 64,
              padding: "0 12px",
              borderRadius: 14,
              background: palette.glass,
              backdropFilter: "blur(28px) saturate(180%)",
              border: `1px solid ${palette.glassBd}`,
              boxShadow: `inset 0 1px 0 ${palette.glassHl}, 0 16px 36px ${palette.glassSh}`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontFamily: FONT_DISPLAY,
              fontSize: 34,
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
          fontSize: 13,
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
};

export const TerminalStrip: React.FC<{
  palette: Palette;
  lines: { kind: "prompt" | "out"; text: string; at: number; dur?: number }[];
  style?: CSSProperties;
}> = ({ palette, lines, style }) => {
  const f = useCurrentFrame();
  return (
    <div
      style={{
        background: "oklch(0.13 0.02 260 / 0.94)",
        borderRadius: 12,
        border: `1px solid ${palette.glassBd}`,
        boxShadow: `0 30px 60px oklch(0.20 0.02 260 / 0.18)`,
        padding: "14px 18px 18px",
        fontFamily: FONT_MONO,
        fontSize: 15,
        lineHeight: 1.55,
        color: "oklch(0.94 0.01 260)",
        ...style,
      }}
    >
      <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
        {["oklch(0.72 0.18 25)", "oklch(0.85 0.16 85)", "oklch(0.72 0.16 145)"].map((c, i) => (
          <div key={i} style={{ width: 9, height: 9, borderRadius: 999, background: c }} />
        ))}
      </div>
      {lines.map((line, i) => {
        if (line.kind === "prompt") {
          const local = f - line.at;
          if (local < 0) return <div key={i} style={{ height: 0 }} />;
          const dur = line.dur ?? 24;
          const chars = Math.min(
            line.text.length,
            Math.max(0, Math.floor((local / dur) * line.text.length)),
          );
          return (
            <div key={i} style={{ whiteSpace: "pre" }}>
              <span style={{ color: "oklch(0.70 0.13 150)" }}>$ </span>
              {line.text.slice(0, chars)}
              {chars < line.text.length ? (
                <span
                  style={{
                    display: "inline-block",
                    width: 7,
                    height: 14,
                    background: "oklch(0.94 0.01 260)",
                    verticalAlign: "-2px",
                    opacity: Math.floor(f / 8) % 2 === 0 ? 0.85 : 0.2,
                  }}
                />
              ) : null}
            </div>
          );
        }
        if (f < line.at) return <div key={i} style={{ height: 0 }} />;
        return (
          <div key={i} style={{ color: "oklch(0.70 0.01 260)", whiteSpace: "pre" }}>
            {line.text}
          </div>
        );
      })}
    </div>
  );
};
