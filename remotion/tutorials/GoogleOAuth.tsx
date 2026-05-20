import { TOD, ACCENTS, FONT_MONO } from "../palette";
import { Callout, HighlightBox, Shot, ShotFrame } from "./ShotFrame";

const KEYS_W = 760;
const KEYS_LEFT = 70;
const KEYS_TOP = 180;
const KS = KEYS_W / 1568;
// Google client ID row at raw y=600; secret at y=700; input x=440 w=750
const idRect = {
  x: KEYS_LEFT + 440 * KS,
  y: KEYS_TOP + 590 * KS,
  w: 760 * KS,
  h: 60 * KS,
};
const secretRect = {
  x: KEYS_LEFT + 440 * KS,
  y: KEYS_TOP + 690 * KS,
  w: 760 * KS,
  h: 60 * KS,
};

const INT_W = 760;
const INT_LEFT = 1600 - INT_W - 70;
const INT_TOP = 180;
const IS = INT_W / 1568;
// "not configured" text at right side, around x=1450, y=110
const notConfRect = {
  x: INT_LEFT + 1300 * IS,
  y: INT_TOP + 100 * IS,
  w: 200 * IS,
  h: 30 * IS,
};

export const GoogleOAuthTutorial: React.FC = () => {
  const palette = TOD.morning;

  return (
    <ShotFrame
      tod="morning"
      eyebrow="Tutorial · 12s · gmail + calendar"
      title="connect google"
      footer={
        <span>
          Redirect URI:{" "}
          <span style={{ fontFamily: FONT_MONO }}>
            http://localhost:3000/api/auth/google/callback
          </span>{" "}
          · After saving env, the Integrations row shows a Connect button.
        </span>
      }
    >
      <div
        style={{
          position: "absolute",
          left: KEYS_LEFT,
          top: KEYS_TOP,
          width: KEYS_W,
        }}
      >
        <Shot src="keys-blank.png" width={KEYS_W} fadeOut={[180, 210]} />
        <div style={{ position: "absolute", left: 0, top: 0 }}>
          <Shot src="keys-all.png" width={KEYS_W} fadeIn={[180, 210]} />
        </div>
      </div>

      <div
        style={{
          position: "absolute",
          left: INT_LEFT,
          top: INT_TOP,
          width: INT_W,
        }}
      >
        <Shot src="int-empty.png" width={INT_W} />
      </div>

      <HighlightBox
        palette={palette}
        rect={idRect}
        fadeIn={[40, 60]}
        fadeOut={[200, 220]}
        accent={ACCENTS.calendar}
      />
      <HighlightBox
        palette={palette}
        rect={secretRect}
        fadeIn={[60, 80]}
        fadeOut={[200, 220]}
        accent={ACCENTS.calendar}
      />

      <Callout
        palette={palette}
        rect={{ x: KEYS_LEFT + KEYS_W / 2 - 130, y: KEYS_TOP + KEYS_W * 0.45 + 70 }}
        text="Create an OAuth web client in Google Cloud Console. Paste client ID + secret into .env.local."
        fadeIn={[50, 80]}
        fadeOut={[170, 195]}
        width={300}
        accent={ACCENTS.calendar}
        arrow="up"
      />

      <HighlightBox
        palette={palette}
        rect={notConfRect}
        fadeIn={[20, 40]}
        fadeOut={[330, 350]}
        accent={ACCENTS.error}
      />

      <Callout
        palette={palette}
        rect={{ x: INT_LEFT - 20, y: INT_TOP + 160 * IS + 30 }}
        text="Until the env vars are set, Integrations stays 'not configured' — no Connect button appears."
        fadeIn={[60, 90]}
        fadeOut={[220, 245]}
        width={300}
        accent={ACCENTS.error}
        arrow="up"
      />

      <Callout
        palette={palette}
        rect={{ x: INT_LEFT - 20, y: INT_TOP + 160 * IS + 30 }}
        text="Save .env.local → restart npm run dev → Integrations flips to ready, click Connect, grant scopes."
        fadeIn={[240, 270]}
        width={300}
        accent={ACCENTS.good}
        arrow="up"
      />
    </ShotFrame>
  );
};
