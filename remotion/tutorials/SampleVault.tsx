import { TOD, ACCENTS, FONT_MONO } from "../palette";
import { Callout, HighlightBox, Shot, ShotFrame, TerminalStrip } from "./ShotFrame";

const SHOT_W = 820;
const SHOT_LEFT = 1600 - SHOT_W - 60;
const SHOT_TOP = 180;
const S = SHOT_W / 1568;
// Vault path row at raw y=300, x=440, w=750
const vaultRect = {
  x: SHOT_LEFT + 440 * S,
  y: SHOT_TOP + 290 * S,
  w: 760 * S,
  h: 60 * S,
};
// "vault" pill at x=85, y=200, w=70, h=32
const vaultPillRect = {
  x: SHOT_LEFT + 80 * S,
  y: SHOT_TOP + 195 * S,
  w: 85 * S,
  h: 38 * S,
};

export const SampleVaultTutorial: React.FC = () => {
  const palette = TOD.morning;

  return (
    <ShotFrame
      tod="morning"
      eyebrow="Tutorial · 10s · vault"
      title="sample first, then your vault"
      footer={
        <span>
          The agent edits files in <span style={{ fontFamily: FONT_MONO }}>VAULT_PATH</span>.
          Test on <span style={{ fontFamily: FONT_MONO }}>examples/sample-vault</span> before
          pointing at real notes.
        </span>
      }
    >
      <div
        style={{
          position: "absolute",
          left: 60,
          top: 200,
          width: 620,
        }}
      >
        <TerminalStrip
          palette={palette}
          lines={[
            { kind: "prompt", text: 'echo VAULT_PATH=examples/sample-vault > .env.local', at: 20, dur: 36 },
            { kind: "prompt", text: "npm run dev", at: 60, dur: 12 },
            { kind: "out", text: "▲ ready · localhost:3000", at: 82 },
            { kind: "prompt", text: 'vim .env.local  # swap to your vault', at: 150, dur: 28 },
            { kind: "prompt", text: "# restart dev to apply", at: 220, dur: 22 },
          ]}
        />
      </div>

      <div
        style={{
          position: "absolute",
          left: SHOT_LEFT,
          top: SHOT_TOP,
          width: SHOT_W,
        }}
      >
        <Shot src="keys-blank.png" width={SHOT_W} fadeOut={[140, 165]} />
        <div style={{ position: "absolute", left: 0, top: 0 }}>
          <Shot src="keys-vault.png" width={SHOT_W} fadeIn={[140, 165]} />
        </div>
      </div>

      <HighlightBox
        palette={palette}
        rect={vaultRect}
        fadeIn={[40, 70]}
        fadeOut={[260, 280]}
        accent={ACCENTS.tasks}
      />

      <HighlightBox
        palette={palette}
        rect={vaultPillRect}
        fadeIn={[180, 210]}
        fadeOut={[270, 290]}
        accent={ACCENTS.good}
      />

      <Callout
        palette={palette}
        rect={{ x: SHOT_LEFT + SHOT_W * 0.55, y: SHOT_TOP + 320 * S }}
        text="Vault path resolves at server boot. Or just edit via /settings once the wizard runs."
        fadeIn={[200, 230]}
        width={280}
        accent={ACCENTS.good}
        arrow="up"
      />
    </ShotFrame>
  );
};
