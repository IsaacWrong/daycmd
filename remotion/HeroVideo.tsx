import { AbsoluteFill, Sequence } from "remotion";
import "./fonts";
import { ColdOpen } from "./scenes/ColdOpen";
import { Setup } from "./scenes/Setup";
import { HomeTour } from "./scenes/HomeTour";
import { SkillsAgent } from "./scenes/SkillsAgent";
import { Outro } from "./scenes/Outro";

export const FPS = 30;
export const DURATION_FRAMES = 900;

export const SCENES = {
  coldOpen: { from: 0, durationInFrames: 120 },
  setup: { from: 120, durationInFrames: 180 },
  homeTour: { from: 300, durationInFrames: 300 },
  skillsAgent: { from: 600, durationInFrames: 180 },
  outro: { from: 780, durationInFrames: 120 },
};

export const HeroVideo: React.FC = () => {
  return (
    <AbsoluteFill style={{ background: "oklch(0.10 0.02 260)" }}>
      <Sequence {...SCENES.coldOpen}>
        <ColdOpen />
      </Sequence>
      <Sequence {...SCENES.setup}>
        <Setup />
      </Sequence>
      <Sequence {...SCENES.homeTour}>
        <HomeTour />
      </Sequence>
      <Sequence {...SCENES.skillsAgent}>
        <SkillsAgent />
      </Sequence>
      <Sequence {...SCENES.outro}>
        <Outro />
      </Sequence>
    </AbsoluteFill>
  );
};
