import { Composition } from "remotion";
import { DURATION_FRAMES, FPS, HeroVideo } from "./HeroVideo";

export const Root: React.FC = () => {
  return (
    <Composition
      id="hero"
      component={HeroVideo}
      durationInFrames={DURATION_FRAMES}
      fps={FPS}
      width={1920}
      height={1080}
    />
  );
};
