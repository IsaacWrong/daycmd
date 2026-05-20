import { Composition } from "remotion";
import { DURATION_FRAMES, FPS, HeroVideo } from "./HeroVideo";
import { BudgetCapTutorial } from "./tutorials/BudgetCap";
import { GoogleOAuthTutorial } from "./tutorials/GoogleOAuth";
import { GithubPATTutorial } from "./tutorials/GithubPAT";
import { SampleVaultTutorial } from "./tutorials/SampleVault";
import { SkillsAgentTutorial } from "./tutorials/SkillsAgent";
import { KbCompileTutorial } from "./tutorials/KbCompile";

const TUTORIAL_W = 1600;
const TUTORIAL_H = 900;

export const Root: React.FC = () => {
  return (
    <>
      <Composition
        id="hero"
        component={HeroVideo}
        durationInFrames={DURATION_FRAMES}
        fps={FPS}
        width={1920}
        height={1080}
      />
      <Composition
        id="tut-budget"
        component={BudgetCapTutorial}
        durationInFrames={240}
        fps={FPS}
        width={TUTORIAL_W}
        height={TUTORIAL_H}
      />
      <Composition
        id="tut-google"
        component={GoogleOAuthTutorial}
        durationInFrames={360}
        fps={FPS}
        width={TUTORIAL_W}
        height={TUTORIAL_H}
      />
      <Composition
        id="tut-github"
        component={GithubPATTutorial}
        durationInFrames={300}
        fps={FPS}
        width={TUTORIAL_W}
        height={TUTORIAL_H}
      />
      <Composition
        id="tut-vault"
        component={SampleVaultTutorial}
        durationInFrames={300}
        fps={FPS}
        width={TUTORIAL_W}
        height={TUTORIAL_H}
      />
      <Composition
        id="tut-skills"
        component={SkillsAgentTutorial}
        durationInFrames={360}
        fps={FPS}
        width={TUTORIAL_W}
        height={TUTORIAL_H}
      />
      <Composition
        id="tut-kb"
        component={KbCompileTutorial}
        durationInFrames={420}
        fps={FPS}
        width={TUTORIAL_W}
        height={TUTORIAL_H}
      />
    </>
  );
};
