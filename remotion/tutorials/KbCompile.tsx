import { TOD, ACCENTS, FONT_MONO } from "../palette";
import { Callout, HighlightBox, Shot, ShotFrame } from "./ShotFrame";

const SHOT_W = 1050;
const SHOT_LEFT = (1600 - SHOT_W) / 2;
const SHOT_TOP = 158;
const S = SHOT_W / 3200;

// Left nav "Knowledge" item at raw y=820, x=140, w=260
const knNavRect = {
  x: SHOT_LEFT + 140 * S,
  y: SHOT_TOP + 800 * S,
  w: 260 * S,
  h: 60 * S,
};

// Knowledge list rows in home-knowledge.png at roughly x=720 to x=3060, y=520-820
const kbListRect = {
  x: SHOT_LEFT + 720 * S,
  y: SHOT_TOP + 500 * S,
  w: 2360 * S,
  h: 340 * S,
};

// "run" buttons on right side around x=2960-3060, y=540+i*60
const runColRect = {
  x: SHOT_LEFT + 2940 * S,
  y: SHOT_TOP + 520 * S,
  w: 140 * S,
  h: 320 * S,
};

export const KbCompileTutorial: React.FC = () => {
  const palette = TOD.morning;

  return (
    <ShotFrame
      tod="morning"
      eyebrow="Tutorial · 14s · knowledge base"
      title="raw → wiki → output · compile + lint"
      footer={
        <span>
          Cron · 06:00 compile / 06:30 lint per category. Manual{" "}
          <span style={{ fontFamily: FONT_MONO }}>run</span> per row. Lint
          findings flow to <span style={{ fontFamily: FONT_MONO }}>/errors</span>{" "}
          and mirror to{" "}
          <span style={{ fontFamily: FONT_MONO }}>Errors/&#123;date&#125;.md</span> in the vault.
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
          <Shot src="home-knowledge.png" width={SHOT_W} fadeIn={[110, 140]} />
        </div>
      </div>

      <HighlightBox
        palette={palette}
        rect={knNavRect}
        fadeIn={[30, 50]}
        fadeOut={[110, 130]}
        accent={ACCENTS.agent}
      />

      <Callout
        palette={palette}
        rect={{ x: SHOT_LEFT + 320 * S, y: SHOT_TOP + 380 * S }}
        text="Knowledge view lives in the left nav — one row per category."
        fadeIn={[40, 65]}
        fadeOut={[110, 130]}
        width={260}
        accent={ACCENTS.agent}
        arrow="left"
      />

      <HighlightBox
        palette={palette}
        rect={kbListRect}
        fadeIn={[150, 175]}
        fadeOut={[260, 280]}
        accent={ACCENTS.agent}
      />

      <Callout
        palette={palette}
        rect={{ x: SHOT_LEFT + 380 * S, y: SHOT_TOP + kbListRect.h + 240 * S }}
        text="Each row: category name · wiki page count · drift indicator. Pre-seeded automations compile + lint at 06:00."
        fadeIn={[160, 190]}
        fadeOut={[260, 280]}
        width={400}
        accent={ACCENTS.agent}
        arrow="up"
      />

      <HighlightBox
        palette={palette}
        rect={runColRect}
        fadeIn={[290, 315]}
        accent={ACCENTS.good}
      />

      <Callout
        palette={palette}
        rect={{ x: runColRect.x + runColRect.w - 320, y: runColRect.y + runColRect.h + 30 }}
        text="run compiles raw/ logs into wiki/ pages, then lints. Drift in wiki references shows in Errors."
        fadeIn={[300, 330]}
        width={300}
        accent={ACCENTS.good}
        arrow="up"
      />
    </ShotFrame>
  );
};
