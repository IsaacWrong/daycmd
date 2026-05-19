import type { CSSProperties, ReactNode } from "react";
import { FONT_MONO, type Palette } from "../palette";

export const BrowserFrame: React.FC<{
  palette: Palette;
  url?: string;
  children: ReactNode;
  style?: CSSProperties;
}> = ({ palette, url = "localhost:3000", children, style }) => {
  return (
    <div
      style={{
        background: palette.glass,
        backdropFilter: "blur(28px) saturate(180%)",
        border: `1px solid ${palette.glassBd}`,
        borderRadius: 14,
        overflow: "hidden",
        boxShadow: `0 30px 80px ${palette.glassSh}`,
        ...style,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 14,
          padding: "12px 16px",
          borderBottom: `1px solid ${palette.rule}`,
        }}
      >
        <div style={{ display: "flex", gap: 6 }}>
          <Dot color="oklch(0.72 0.18 25)" />
          <Dot color="oklch(0.85 0.16 85)" />
          <Dot color="oklch(0.72 0.16 145)" />
        </div>
        <div
          style={{
            flex: 1,
            background: `oklch(from ${palette.fg} l c h / 0.05)`,
            border: `1px solid ${palette.rule}`,
            borderRadius: 8,
            padding: "5px 12px",
            fontFamily: FONT_MONO,
            fontSize: 12,
            color: palette.fgSoft,
            letterSpacing: "0.01em",
          }}
        >
          {url}
        </div>
      </div>
      <div style={{ position: "relative" }}>{children}</div>
    </div>
  );
};

const Dot: React.FC<{ color: string }> = ({ color }) => (
  <div
    style={{
      width: 12,
      height: 12,
      borderRadius: "50%",
      background: color,
      opacity: 0.85,
    }}
  />
);
