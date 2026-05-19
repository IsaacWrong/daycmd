import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { Backdrop } from "../components/Backdrop";
import { FONT_DISPLAY, FONT_MONO, FONT_SANS, TOD } from "../palette";

export const ColdOpen: React.FC = () => {
  const f = useCurrentFrame();
  const palette = TOD.dawn;

  const bgIn = interpolate(f, [0, 20], [0, 1], { extrapolateRight: "clamp" });
  const chars = "daycmd";
  const totalChars = chars.length;
  const charsShown = Math.max(
    0,
    Math.min(totalChars, Math.floor((f - 22) / 5)),
  );
  const cursorOn = Math.floor(f / 10) % 2 === 0;

  const taglineOpacity = interpolate(f, [60, 88], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const taglineShift = interpolate(f, [60, 88], [8, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const subOpacity = interpolate(f, [82, 105], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const outFade = interpolate(f, [110, 120], [1, 1], {
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill style={{ opacity: outFade }}>
      <div style={{ opacity: bgIn }}>
        <Backdrop palette={palette} />
      </div>
      <AbsoluteFill
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexDirection: "column",
        }}
      >
        <div
          style={{
            fontFamily: FONT_DISPLAY,
            fontSize: 168,
            letterSpacing: "-0.045em",
            lineHeight: 0.9,
            fontWeight: 600,
            color: palette.fg,
            display: "flex",
            alignItems: "baseline",
          }}
        >
          <span>{chars.slice(0, charsShown)}</span>
          <span
            style={{
              display: "inline-block",
              width: "0.55ch",
              height: "0.9em",
              background: palette.fg,
              marginLeft: 4,
              opacity: cursorOn && charsShown < totalChars + 4 ? 0.85 : 0,
              transform: "translateY(0.05em)",
            }}
          />
        </div>
        <div
          style={{
            fontFamily: FONT_SANS,
            fontSize: 22,
            color: palette.fgSoft,
            marginTop: 28,
            letterSpacing: "-0.005em",
            maxWidth: 920,
            textAlign: "center",
            opacity: taglineOpacity,
            transform: `translateY(${taglineShift}px)`,
          }}
        >
          local-first new-tab page for people juggling work, personal,
          and side projects.
        </div>
        <div
          style={{
            marginTop: 26,
            display: "flex",
            gap: 18,
            fontFamily: FONT_MONO,
            fontSize: 13,
            color: palette.fgSoft,
            letterSpacing: "0.04em",
            textTransform: "uppercase",
            opacity: subOpacity,
          }}
        >
          <span>obsidian</span>
          <Dot palette={palette} />
          <span>gmail</span>
          <Dot palette={palette} />
          <span>calendar</span>
          <Dot palette={palette} />
          <span>github</span>
          <Dot palette={palette} />
          <span>claude</span>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

const Dot: React.FC<{ palette: typeof TOD.dawn }> = ({ palette }) => (
  <span
    style={{
      width: 4,
      height: 4,
      borderRadius: "50%",
      background: palette.fgSoft,
      display: "inline-block",
      alignSelf: "center",
      opacity: 0.5,
    }}
  />
);
