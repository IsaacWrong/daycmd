import type { CSSProperties } from "react";
import { useCurrentFrame } from "remotion";
import { FONT_MONO, type Palette } from "../palette";

type Line =
  | { kind: "prompt"; text: string; start: number; durFrames: number }
  | { kind: "stdout"; text: string; appearAt: number };

export const Terminal: React.FC<{
  palette: Palette;
  lines: Line[];
  style?: CSSProperties;
}> = ({ palette, lines, style }) => {
  const f = useCurrentFrame();
  return (
    <div
      style={{
        background: "oklch(0.13 0.02 260 / 0.92)",
        borderRadius: 12,
        border: `1px solid ${palette.glassBd}`,
        boxShadow: `0 24px 60px ${palette.glassSh}`,
        overflow: "hidden",
        ...style,
      }}
    >
      <div
        style={{
          padding: "10px 14px",
          borderBottom: "1px solid oklch(0.94 0.01 260 / 0.08)",
          display: "flex",
          gap: 6,
          alignItems: "center",
        }}
      >
        <div
          style={{
            width: 10,
            height: 10,
            borderRadius: 999,
            background: "oklch(0.72 0.18 25)",
          }}
        />
        <div
          style={{
            width: 10,
            height: 10,
            borderRadius: 999,
            background: "oklch(0.85 0.16 85)",
          }}
        />
        <div
          style={{
            width: 10,
            height: 10,
            borderRadius: 999,
            background: "oklch(0.72 0.16 145)",
          }}
        />
        <div
          style={{
            marginLeft: 14,
            fontFamily: FONT_MONO,
            fontSize: 11,
            color: "oklch(0.70 0.01 260)",
          }}
        >
          ~ / daycmd
        </div>
      </div>
      <div
        style={{
          padding: "18px 20px",
          fontFamily: FONT_MONO,
          fontSize: 17,
          lineHeight: 1.55,
          color: "oklch(0.94 0.01 260)",
        }}
      >
        {lines.map((line, i) => {
          if (line.kind === "prompt") {
            const local = f - line.start;
            if (local < 0) return <div key={i} style={{ height: 0 }} />;
            const chars = Math.max(
              0,
              Math.min(
                line.text.length,
                Math.floor((local / line.durFrames) * line.text.length),
              ),
            );
            const typed = line.text.slice(0, chars);
            const showCursor = local < line.durFrames + 10;
            return (
              <div key={i} style={{ whiteSpace: "pre" }}>
                <span style={{ color: "oklch(0.70 0.13 150)" }}>$ </span>
                <span>{typed}</span>
                {showCursor ? (
                  <span
                    style={{
                      display: "inline-block",
                      width: "0.55em",
                      height: "1em",
                      verticalAlign: "-2px",
                      background: "oklch(0.94 0.01 260)",
                      marginLeft: 1,
                      opacity: Math.floor(f / 8) % 2 === 0 ? 1 : 0.15,
                    }}
                  />
                ) : null}
              </div>
            );
          }
          const visible = f >= line.appearAt;
          if (!visible) return <div key={i} style={{ height: 0 }} />;
          return (
            <div
              key={i}
              style={{
                color: "oklch(0.70 0.01 260)",
                whiteSpace: "pre",
              }}
            >
              {line.text}
            </div>
          );
        })}
      </div>
    </div>
  );
};
