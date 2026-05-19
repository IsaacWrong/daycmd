import { useCurrentFrame } from "remotion";
import { TOD, ACCENTS, FONT_MONO } from "../palette";
import { Callout, HighlightBox, Shot, ShotFrame } from "./ShotFrame";

const SHOT_W = 1280;
const SHOT_LEFT = (1600 - SHOT_W) / 2;
const SHOT_TOP = 170;
// section image is 1568x350, scale = 1280/1568 = 0.816
const S = SHOT_W / 1568;
// Daily cap input is around x=466, y=158, w=200, h=64 in raw px
const capRect = {
  x: SHOT_LEFT + 466 * S,
  y: SHOT_TOP + 158 * S,
  w: 200 * S,
  h: 64 * S,
};

export const BudgetCapTutorial: React.FC = () => {
  const f = useCurrentFrame();
  const palette = TOD.morning;

  return (
    <ShotFrame
      tod="morning"
      eyebrow="Tutorial · 8s · safety"
      title="set a budget cap"
      footer={
        <span>
          <span style={{ fontFamily: FONT_MONO }}>/settings</span> · Budget
          section. Save with{" "}
          <span style={{ fontFamily: FONT_MONO }}>Save to .env.local</span> in
          Keys above, then restart <span style={{ fontFamily: FONT_MONO }}>npm run dev</span>.
        </span>
      }
    >
      <div
        style={{
          position: "absolute",
          left: SHOT_LEFT,
          top: SHOT_TOP,
          width: SHOT_W,
        }}
      >
        <Shot src="budget-zero.png" width={SHOT_W} fadeOut={[110, 130]} />
        <div style={{ position: "absolute", left: 0, top: 0 }}>
          <Shot src="budget-ten.png" width={SHOT_W} fadeIn={[110, 130]} />
        </div>
      </div>

      <HighlightBox
        palette={palette}
        rect={capRect}
        fadeIn={[30, 50]}
        fadeOut={[200, 220]}
        accent={ACCENTS.error}
      />

      <Callout
        palette={palette}
        rect={{ x: capRect.x + capRect.w + 32, y: capRect.y - 24 }}
        text="$0 default = unlimited spend. A few Triage Inbox skills in a row would burn real money."
        fadeIn={[40, 60]}
        fadeOut={[105, 120]}
        width={300}
        accent={ACCENTS.error}
        arrow="left"
      />

      <Callout
        palette={palette}
        rect={{ x: capRect.x + capRect.w + 32, y: capRect.y - 12 }}
        text="Hard cap — once the day's spend hits this, new agent runs fail until tomorrow."
        fadeIn={[125, 145]}
        width={300}
        accent={ACCENTS.good}
        arrow="left"
      />
    </ShotFrame>
  );
};
