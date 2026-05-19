import { TOD, ACCENTS, FONT_MONO } from "../palette";
import { Callout, HighlightBox, Shot, ShotFrame } from "./ShotFrame";

const SHOT_W = 1100;
const SHOT_LEFT = (1600 - SHOT_W) / 2;
const SHOT_TOP = 170;
const S = SHOT_W / 1568;
// GitHub token row at raw y=500, input x=440, w=750
const ghRect = {
  x: SHOT_LEFT + 440 * S,
  y: SHOT_TOP + 490 * S,
  w: 760 * S,
  h: 60 * S,
};
// "github" pill at approx x=325, y=200, w=85, h=32
const ghPillRect = {
  x: SHOT_LEFT + 320 * S,
  y: SHOT_TOP + 195 * S,
  w: 95 * S,
  h: 38 * S,
};

export const GithubPATTutorial: React.FC = () => {
  const palette = TOD.morning;

  return (
    <ShotFrame
      tod="morning"
      eyebrow="Tutorial · 10s · github"
      title="paste a github PAT"
      footer={
        <span>
          Generate at{" "}
          <span style={{ fontFamily: FONT_MONO }}>
            github.com/settings/tokens/new
          </span>{" "}
          (classic) with{" "}
          <span style={{ fontFamily: FONT_MONO }}>repo</span>,{" "}
          <span style={{ fontFamily: FONT_MONO }}>notifications</span>,{" "}
          <span style={{ fontFamily: FONT_MONO }}>read:user</span>.
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
        <Shot src="keys-anth.png" width={SHOT_W} fadeOut={[140, 165]} />
        <div style={{ position: "absolute", left: 0, top: 0 }}>
          <Shot src="keys-gh.png" width={SHOT_W} fadeIn={[140, 165]} />
        </div>
      </div>

      <HighlightBox
        palette={palette}
        rect={ghRect}
        fadeIn={[30, 50]}
        fadeOut={[260, 280]}
        accent={ACCENTS.github}
      />

      <Callout
        palette={palette}
        rect={{ x: SHOT_LEFT + SHOT_W * 0.55, y: SHOT_TOP + 420 * S }}
        text="GITHUB_TOKEN — Octokit uses it for repos, notifications, and the heatmap."
        fadeIn={[40, 65]}
        fadeOut={[130, 155]}
        width={280}
        accent={ACCENTS.github}
        arrow="up"
      />

      <HighlightBox
        palette={palette}
        rect={ghPillRect}
        fadeIn={[170, 200]}
        fadeOut={[270, 290]}
        accent={ACCENTS.good}
      />

      <Callout
        palette={palette}
        rect={{ x: SHOT_LEFT + 100 * S, y: SHOT_TOP + 240 * S }}
        text="Pill dot fills once the value is saved to .env.local — restart npm run dev to load it."
        fadeIn={[185, 215]}
        width={280}
        accent={ACCENTS.good}
        arrow="up"
      />
    </ShotFrame>
  );
};
