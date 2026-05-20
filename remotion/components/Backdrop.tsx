import { AbsoluteFill } from "remotion";
import type { Palette } from "../palette";

export const Backdrop: React.FC<{ palette: Palette; grain?: boolean }> = ({
  palette,
  grain = true,
}) => {
  return (
    <AbsoluteFill style={{ overflow: "hidden" }}>
      <AbsoluteFill
        style={{
          background: `linear-gradient(135deg, ${palette.bgA} 0%, ${palette.bgB} 100%)`,
        }}
      />
      <div
        style={{
          position: "absolute",
          width: 1100,
          height: 1100,
          left: -260,
          top: -360,
          borderRadius: "50%",
          background: palette.orb1,
          filter: "blur(80px)",
        }}
      />
      <div
        style={{
          position: "absolute",
          width: 1200,
          height: 1200,
          right: -300,
          bottom: -380,
          borderRadius: "50%",
          background: palette.orb2,
          filter: "blur(80px)",
        }}
      />
      {grain ? (
        <AbsoluteFill
          style={{
            mixBlendMode: "overlay",
            opacity: 0.18,
            backgroundImage:
              "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='240' height='240'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='1.6' numOctaves='2'/></filter><rect width='100%25' height='100%25' filter='url(%23n)'/></svg>\")",
            backgroundSize: "240px 240px",
          }}
        />
      ) : null}
    </AbsoluteFill>
  );
};
