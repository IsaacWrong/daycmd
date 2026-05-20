import { TOD, ACCENTS, FONT_MONO } from "../palette";
import { Callout, HighlightBox, Keychord, Shot, ShotFrame } from "./ShotFrame";

// Home + agent-expanded screenshots are 3200x2000 → render at 1050x656
const SHOT_W = 1050;
const SHOT_LEFT = (1600 - SHOT_W) / 2;
const SHOT_TOP = 158;
const S = SHOT_W / 3200;
// Agent button (orange dot) at approx x=3050, y=1860 in raw px
const dockButtonRect = {
  x: SHOT_LEFT + 3040 * S,
  y: SHOT_TOP + 1840 * S,
  w: 80 * S,
  h: 80 * S,
};
// Skill bar in agent-expanded.png at approx y=1640, x=380, w=2380, h=80
const skillBarRect = {
  x: SHOT_LEFT + 320 * S,
  y: SHOT_TOP + 1620 * S,
  w: 2500 * S,
  h: 100 * S,
};
// Input row at y=1800
const inputRect = {
  x: SHOT_LEFT + 320 * S,
  y: SHOT_TOP + 1780 * S,
  w: 2500 * S,
  h: 100 * S,
};

export const SkillsAgentTutorial: React.FC = () => {
  const palette = TOD.dusk;

  return (
    <ShotFrame
      tod="dusk"
      eyebrow="Tutorial · 12s · agent"
      title="⌘J opens, ⌘1–⌘6 fire skills"
      footer={
        <span>
          Skills: Morning Brief · Triage Inbox · Plan Today · Research Topic ·
          Stale Tasks · Daily Reflection. Each streams Opus 4.7 by default with
          per-skill overrides in <span style={{ fontFamily: FONT_MONO }}>/settings</span>.
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
        <Shot src="home.png" width={SHOT_W} fadeOut={[110, 140]} />
        <div style={{ position: "absolute", left: 0, top: 0 }}>
          <Shot src="agent-expanded.png" width={SHOT_W} fadeIn={[110, 140]} />
        </div>
      </div>

      <HighlightBox
        palette={palette}
        rect={dockButtonRect}
        fadeIn={[20, 40]}
        fadeOut={[100, 120]}
        accent={ACCENTS.agent}
      />

      <Callout
        palette={palette}
        rect={{ x: dockButtonRect.x - 320, y: dockButtonRect.y - 12 }}
        text="Tap the dock or hit ⌘J — same thing."
        fadeIn={[30, 55]}
        fadeOut={[100, 120]}
        width={260}
        accent={ACCENTS.agent}
        arrow="right"
      />

      <Keychord
        palette={palette}
        keys={["⌘", "J"]}
        caption="open agent"
        position={{ x: SHOT_LEFT + SHOT_W / 2 - 86, y: SHOT_TOP + 200 }}
        fadeIn={[55, 80]}
        fadeOut={[110, 130]}
      />

      <HighlightBox
        palette={palette}
        rect={skillBarRect}
        fadeIn={[150, 180]}
        fadeOut={[330, 350]}
        accent={ACCENTS.gmail}
      />

      <Callout
        palette={palette}
        rect={{ x: SHOT_LEFT + 100, y: SHOT_TOP + 1480 * S }}
        text="Six skills, six chips. ⌘1–⌘6 fire them from anywhere — bubble streams into the dock."
        fadeIn={[160, 195]}
        fadeOut={[260, 285]}
        width={320}
        accent={ACCENTS.gmail}
        arrow="down"
      />

      <Keychord
        palette={palette}
        keys={["⌘", "2"]}
        caption="triage inbox"
        position={{ x: SHOT_LEFT + SHOT_W / 2 - 86, y: SHOT_TOP + 200 }}
        fadeIn={[260, 285]}
        fadeOut={[330, 350]}
        accent={ACCENTS.gmail}
      />

      <HighlightBox
        palette={palette}
        rect={inputRect}
        fadeIn={[280, 305]}
        accent={ACCENTS.calendar}
      />
    </ShotFrame>
  );
};
