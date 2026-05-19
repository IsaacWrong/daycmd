import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { Backdrop } from "../components/Backdrop";
import { todAt } from "../blend";
import { FONT_DISPLAY, FONT_MONO, FONT_SANS } from "../palette";

const TOTAL = 120;

export const Outro: React.FC = () => {
  const f = useCurrentFrame();
  const t = f / TOTAL;
  const palette = todAt(
    [
      { tod: "night", at: 0 },
      { tod: "deep", at: 1 },
    ],
    t,
  );

  const wordOpacity = interpolate(f, [4, 26], [0, 1], {
    extrapolateRight: "clamp",
  });
  const wordShift = interpolate(f, [4, 26], [10, 0], {
    extrapolateRight: "clamp",
  });

  const lineOpacity = interpolate(f, [22, 44], [0, 1], {
    extrapolateRight: "clamp",
  });
  const ctaOpacity = interpolate(f, [44, 72], [0, 1], {
    extrapolateRight: "clamp",
  });
  const fade = interpolate(f, [95, 120], [1, 0.55], {
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill>
      <Backdrop palette={palette} />
      <AbsoluteFill
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexDirection: "column",
          opacity: fade,
        }}
      >
        <div
          style={{
            fontFamily: FONT_DISPLAY,
            fontSize: 120,
            letterSpacing: "-0.045em",
            lineHeight: 0.9,
            fontWeight: 600,
            color: palette.fg,
            opacity: wordOpacity,
            transform: `translateY(${wordShift}px)`,
          }}
        >
          daycmd
        </div>
        <div
          style={{
            fontFamily: FONT_SANS,
            fontSize: 22,
            color: palette.fgSoft,
            marginTop: 24,
            letterSpacing: "0.02em",
            opacity: lineOpacity,
          }}
        >
          localhost · yours · open source
        </div>
        <div
          style={{
            marginTop: 36,
            display: "flex",
            gap: 28,
            fontFamily: FONT_MONO,
            fontSize: 14,
            color: palette.fgSoft,
            letterSpacing: "0.02em",
            opacity: ctaOpacity,
          }}
        >
          <span>github.com/IsaacWrong/daycmd</span>
          <span style={{ opacity: 0.4 }}>·</span>
          <span>github.com/sponsors/IsaacWrong</span>
          <span style={{ opacity: 0.4 }}>·</span>
          <span>MIT</span>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
