import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { Backdrop } from "../components/Backdrop";
import { HomeMockup } from "../components/HomeMockup";
import { todAt } from "../blend";

const TOTAL = 300;

export const HomeTour: React.FC = () => {
  const f = useCurrentFrame();
  const t = f / TOTAL;
  const palette = todAt(
    [
      { tod: "morning", at: 0 },
      { tod: "noon", at: 0.45 },
      { tod: "afternoon", at: 0.78 },
      { tod: "dusk", at: 1 },
    ],
    t,
  );

  const ease = (x: number) => 1 - Math.pow(1 - Math.max(0, Math.min(1, x)), 3);

  const reveal = {
    nav: ease((f - 0) / 22),
    focus: ease((f - 22) / 24),
    dayStrip: ease((f - 46) / 28),
    heatmap: ease((f - 74) / 40),
    rail: ease((f - 110) / 48),
    dock: ease((f - 200) / 36),
  };

  const containerOpacity = interpolate(f, [0, 14], [0, 1], {
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill>
      <Backdrop palette={palette} />
      <AbsoluteFill style={{ opacity: containerOpacity }}>
        <HomeMockup palette={palette} reveal={reveal} />
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
